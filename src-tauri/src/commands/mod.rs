use crate::error::{AppError, Result};
use crate::git::{self, BranchInfo, CommitActivity, CommitGraph, CommitInfo, FileDiff, RepositoryInfo, StatusInfo, UnifiedDiff, WorktreeInfo, WorktreeCreateOptions, MergeStatus, FileConflictInfo, StashEntry, AheadBehind, ChangelogCommit, ReflogEntry};
use std::process::Command;
use std::path::PathBuf;
use std::fs;
use tauri::Manager;
use tracing::instrument;

// Skills-related types
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source_url: Option<String>,
}

/// Remote skill from skills.sh leaderboard
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSkill {
    pub owner: String,
    pub repo: String,
    pub skill: String,
    pub url: String,
    pub installs: Option<String>,
}

// Cache for remote skills list
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

struct RemoteSkillsCache {
    skills: Vec<RemoteSkill>,
    fetched_at: Instant,
}

static REMOTE_SKILLS_CACHE: OnceLock<Mutex<Option<RemoteSkillsCache>>> = OnceLock::new();
const CACHE_TTL: Duration = Duration::from_secs(10 * 60); // 10 minutes

/// Parse skills.sh HTML and extract skill links
fn parse_skills_html(html: &str) -> Vec<RemoteSkill> {
    let mut skills = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Look for links matching the pattern /owner/repo/skill (exactly 3 segments)
    // The HTML contains links like: href="https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices"
    // or relative: href="/vercel-labs/agent-skills/vercel-react-best-practices"
    
    // Simple regex-like pattern matching for href attributes
    let mut pos = 0;
    while let Some(href_start) = html[pos..].find("href=\"") {
        let abs_pos = pos + href_start + 6; // skip href="
        if let Some(href_end) = html[abs_pos..].find('"') {
            let href = &html[abs_pos..abs_pos + href_end];
            
            // Extract path from URL
            let path = if href.starts_with("https://skills.sh/") {
                href.strip_prefix("https://skills.sh/").unwrap_or("")
            } else if href.starts_with('/') && !href.starts_with("//") {
                href.strip_prefix('/').unwrap_or("")
            } else {
                ""
            };
            
            // Check if path has exactly 3 segments (owner/repo/skill)
            let segments: Vec<&str> = path.trim_end_matches('/').split('/').collect();
            if segments.len() == 3 && !segments[0].is_empty() && !segments[1].is_empty() && !segments[2].is_empty() {
                // Skip docs and other non-skill paths
                if segments[0] != "docs" && segments[0] != "trending" && segments[0] != "agents" {
                    let key = format!("{}/{}/{}", segments[0], segments[1], segments[2]);
                    if !seen.contains(&key) {
                        seen.insert(key);
                        
                        skills.push(RemoteSkill {
                            owner: segments[0].to_string(),
                            repo: segments[1].to_string(),
                            skill: segments[2].to_string(),
                            url: format!("https://skills.sh/{}/{}/{}", segments[0], segments[1], segments[2]),
                            installs: None,
                        });
                    }
                }
            }
            
            pos = abs_pos + href_end;
        } else {
            break;
        }
    }
    
    skills
}

/// Fetch remote skills from skills.sh with caching
async fn fetch_remote_skills_cached() -> Result<Vec<RemoteSkill>> {
    let cache = REMOTE_SKILLS_CACHE.get_or_init(|| Mutex::new(None));
    
    // Check cache
    {
        let guard = cache.lock().map_err(|e| AppError::io(format!("Cache lock error: {}", e)))?;
        if let Some(ref cached) = *guard {
            if cached.fetched_at.elapsed() < CACHE_TTL {
                return Ok(cached.skills.clone());
            }
        }
    }
    
    // Fetch fresh data
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::network(format!("Failed to create HTTP client: {}", e)))?;
    
    let mut all_skills = Vec::new();
    
    // Fetch main leaderboard
    match client.get("https://skills.sh/").send().await {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(html) = response.text().await {
                    all_skills.extend(parse_skills_html(&html));
                }
            }
        }
        Err(e) => {
            tracing::warn!("Failed to fetch skills.sh main page: {}", e);
        }
    }
    
    // Fetch trending page
    match client.get("https://skills.sh/trending").send().await {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(html) = response.text().await {
                    let trending = parse_skills_html(&html);
                    // Add only new skills not already in all_skills
                    let existing: std::collections::HashSet<_> = all_skills.iter().map(|s| s.url.clone()).collect();
                    for skill in trending {
                        if !existing.contains(&skill.url) {
                            all_skills.push(skill);
                        }
                    }
                }
            }
        }
        Err(e) => {
            tracing::warn!("Failed to fetch skills.sh trending page: {}", e);
        }
    }
    
    // Update cache
    {
        let mut guard = cache.lock().map_err(|e| AppError::io(format!("Cache lock error: {}", e)))?;
        *guard = Some(RemoteSkillsCache {
            skills: all_skills.clone(),
            fetched_at: Instant::now(),
        });
    }
    
    Ok(all_skills)
}

/// Get the skills directory path
fn get_skills_dir_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| AppError::io(format!("Failed to get app data dir: {}", e)))?;
    Ok(app_data_dir.join("skills"))
}

/// Parse YAML frontmatter from skill markdown content
fn parse_skill_frontmatter(content: &str) -> (String, String, String) {
    // Default values
    let mut name = String::from("Unnamed Skill");
    let mut description = String::new();
    let mut body = content.to_string();

    // Check for YAML frontmatter (starts with ---)
    if content.starts_with("---") {
        if let Some(end_idx) = content[3..].find("---") {
            let frontmatter = &content[3..3 + end_idx];
            body = content[3 + end_idx + 3..].trim_start().to_string();

            // Simple YAML parsing for name and description
            for line in frontmatter.lines() {
                let line = line.trim();
                if let Some(value) = line.strip_prefix("name:") {
                    name = value.trim().trim_matches('"').trim_matches('\'').to_string();
                } else if let Some(value) = line.strip_prefix("description:") {
                    description = value.trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
        }
    }

    (name, description, body)
}

/// Generate a skill ID from a name
fn generate_skill_id(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Find the claude CLI binary by checking common installation paths
fn find_claude_binary() -> Result<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_default();

    let candidates = [
        format!("{}/.claude/local/claude", home),
        format!("{}/.local/bin/claude", home),
        format!("{}/.bun/bin/claude", home),
        format!("{}/.npm-global/bin/claude", home),
        "/usr/local/bin/claude".to_string(),
        "/opt/homebrew/bin/claude".to_string(),
    ];

    for path in candidates {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Ok(p);
        }
    }

    // Fall back to PATH lookup (works in dev mode)
    Ok(PathBuf::from("claude"))
}


/// Extract a JSON object from text that may contain additional content.
/// Looks for the outermost { } pair and returns the content between them.
fn extract_json_object(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let mut depth = 0;
    let mut in_string = false;
    let mut escape_next = false;

    for (i, ch) in text[start..].char_indices() {
        if escape_next {
            escape_next = false;
            continue;
        }

        match ch {
            '\\' if in_string => escape_next = true,
            '"' => in_string = !in_string,
            '{' if !in_string => depth += 1,
            '}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    return Some(&text[start..start + i + 1]);
                }
            }
            _ => {}
        }
    }

    None
}

#[tauri::command]
#[instrument(skip_all, fields(path = %path), err(Debug))]
pub async fn open_repository(path: String) -> Result<RepositoryInfo> {
    let repo = git::open_repo(&path)?;
    Ok(git::get_repository_info(&repo)?)
}

#[tauri::command]
#[instrument(skip_all, fields(start_path = %start_path), err(Debug))]
pub async fn discover_repository(start_path: String) -> Result<RepositoryInfo> {
    let repo = git::discover_repo(&start_path)?;
    Ok(git::get_repository_info(&repo)?)
}

#[tauri::command]
pub async fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        Ok(git::list_all_branches(&repo)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
pub async fn checkout_branch(repo_path: String, branch_name: String) -> Result<()> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::checkout_branch(&repo, &branch_name)?)
}

#[tauri::command]
pub async fn create_branch(repo_path: String, branch_name: String, checkout: bool) -> Result<()> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::create_branch(&repo, &branch_name, checkout)?)
}

#[tauri::command]
#[instrument(skip_all, fields(branch = ?branch, limit, offset), err(Debug))]
pub async fn get_commit_history(
    repo_path: String,
    branch: Option<String>,
    limit: usize,
    offset: usize,
) -> Result<Vec<CommitInfo>> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        Ok(git::get_commits(&repo, branch.as_deref(), limit, offset)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[instrument(skip_all, fields(limit, offset), err(Debug))]
pub async fn get_commit_history_all_branches(
    repo_path: String,
    limit: usize,
    offset: usize,
) -> Result<Vec<CommitInfo>> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        Ok(git::get_commits_all_branches(&repo, limit, offset)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[instrument(skip_all, fields(since, until), err(Debug))]
pub async fn get_commit_activity_all_branches(
    repo_path: String,
    since: i64,
    until: i64,
) -> Result<Vec<CommitActivity>> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        Ok(git::get_commit_activity_all_branches(&repo, since, until)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[instrument(skip_all, fields(since, until), err(Debug))]
pub async fn get_changelog_commits_all_branches(
    repo_path: String,
    since: i64,
    until: i64,
) -> Result<Vec<ChangelogCommit>> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        Ok(git::get_changelog_commits_all_branches(&repo, since, until)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[instrument(skip_all, fields(commit_count = commit_ids.len()), err(Debug))]
pub async fn get_commit_graph(repo_path: String, commit_ids: Vec<String>) -> Result<CommitGraph> {
    use std::time::Instant;
    let cmd_start = Instant::now();
    let commit_count = commit_ids.len();
    
    // Run blocking git operation on dedicated thread pool
    let result = tokio::task::spawn_blocking(move || {
        let spawn_start = Instant::now();
        let repo = git::open_repo(&repo_path)?;
        let graph = git::build_commit_graph(&repo, &commit_ids)?;
        tracing::info!("get_commit_graph spawn_blocking inner took {:?} for {} commits", spawn_start.elapsed(), commit_count);
        Ok(graph)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?;
    
    tracing::info!("get_commit_graph command total took {:?}", cmd_start.elapsed());
    result
}

#[tauri::command]
#[instrument(skip_all, fields(commit_id = %commit_id), err(Debug))]
pub async fn get_commit_diff(repo_path: String, commit_id: String) -> Result<UnifiedDiff> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::get_commit_diff(&repo, &commit_id)?)
}

#[tauri::command]
pub async fn get_file_diff(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<FileDiff> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::get_file_diff(&repo, &commit_id, &file_path)?)
}

#[tauri::command]
#[instrument(skip_all, fields(staged), err(Debug))]
pub async fn get_working_diff(repo_path: String, staged: bool) -> Result<UnifiedDiff> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        Ok(git::get_working_diff(&repo, staged)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn get_status(repo_path: String) -> Result<StatusInfo> {
    use std::time::Instant;
    let cmd_start = Instant::now();
    
    // Run blocking git operation on dedicated thread pool to avoid blocking async runtime
    let result = tokio::task::spawn_blocking(move || {
        let spawn_start = Instant::now();
        let repo = git::open_repo(&repo_path)?;
        let status = git::get_status(&repo)?;
        tracing::info!("get_status spawn_blocking inner took {:?}", spawn_start.elapsed());
        Ok(status)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?;
    
    tracing::info!("get_status command total took {:?}", cmd_start.elapsed());
    result
}

#[tauri::command]
#[instrument(skip_all, fields(file_count = paths.len()), err(Debug))]
pub async fn stage_files(repo_path: String, paths: Vec<String>) -> Result<()> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::stage_files(&repo, &paths)?)
}

#[tauri::command]
#[instrument(skip_all, fields(file_count = paths.len()), err(Debug))]
pub async fn unstage_files(repo_path: String, paths: Vec<String>) -> Result<()> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::unstage_files(&repo, &paths)?)
}

#[tauri::command]
pub async fn discard_changes(repo_path: String, paths: Vec<String>) -> Result<()> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::discard_changes(&repo, &paths)?)
}

#[tauri::command]
pub async fn create_commit(repo_path: String, message: String) -> Result<String> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::create_commit(&repo, &message)?)
}

#[tauri::command]
pub async fn git_fetch(repo_path: String) -> Result<String> {
    Ok(git::git_fetch(&repo_path)?)
}

#[tauri::command]
pub async fn git_pull(repo_path: String) -> Result<String> {
    Ok(git::git_pull(&repo_path)?)
}

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<String> {
    Ok(git::git_push(&repo_path)?)
}

#[tauri::command]
pub async fn git_remote_action(repo_path: String, action: String) -> Result<String> {
    Ok(git::git_remote_action(&repo_path, &action)?)
}

#[tauri::command]
pub async fn checkout_commit(repo_path: String, commit_id: String) -> Result<String> {
    Ok(git::checkout_commit(&repo_path, &commit_id)?)
}

#[tauri::command]
pub async fn cherry_pick(repo_path: String, commit_id: String) -> Result<String> {
    Ok(git::cherry_pick(&repo_path, &commit_id)?)
}

#[tauri::command]
pub async fn reset_hard(repo_path: String, commit_id: String) -> Result<String> {
    Ok(git::reset_hard(&repo_path, &commit_id)?)
}

#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn generate_commit_message(repo_path: String) -> Result<String> {
    // Get the staged diff
    let repo = git::open_repo(&repo_path)?;
    let diff = git::get_working_diff(&repo, true)?;

    if diff.patch.is_empty() {
        return Err(AppError::validation("No staged changes to generate a commit message for"));
    }

    // Truncate diff if too long (Claude has context limits)
    let max_diff_len = 8000;
    let truncated_diff = if diff.patch.len() > max_diff_len {
        format!("{}...\n[diff truncated]", &diff.patch[..max_diff_len])
    } else {
        diff.patch.clone()
    };

    let prompt = format!(
        "Generate a concise git commit message (max 72 chars for title) for these changes. \
        Use conventional commit format (feat:, fix:, refactor:, etc) if appropriate. \
        Only output the commit message, nothing else:\n\n{}",
        truncated_diff
    );

    // Call claude CLI with -p flag for non-interactive mode
    let claude_path = find_claude_binary()?;
    let output = Command::new(&claude_path)
        .args(["-p", &prompt])
        .output()
        .map_err(|e| AppError::ai(format!("Failed to run claude at {:?}: {}", claude_path, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::ai(format!("Claude failed: {}", stderr)));
    }

    let message = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(message)
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AIReviewIssue {
    pub id: String,
    pub category: String,
    pub severity: String,
    pub title: String,
    pub problem: String,
    pub why: String,
    pub suggestion: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIReviewData {
    pub overview: String,
    pub issues: Vec<AIReviewIssue>,
    pub generated_at: u64,
}

/// Normalize a category string to a known value, defaulting to "other".
fn normalize_category(cat: &str) -> String {
    match cat.to_lowercase().as_str() {
        "logic_bugs" | "logic" | "bugs" | "bug" => "logic_bugs".to_string(),
        "edge_cases" | "edge" | "edge_case" => "edge_cases".to_string(),
        "security" | "sec" => "security".to_string(),
        "performance" | "perf" => "performance".to_string(),
        "accidental_code" | "accidental" | "cleanup" => "accidental_code".to_string(),
        _ => "other".to_string(),
    }
}

/// Normalize a severity string to a known value, defaulting to "medium".
fn normalize_severity(sev: &str) -> String {
    match sev.to_lowercase().as_str() {
        "low" | "info" => "low".to_string(),
        "medium" | "warning" | "warn" => "medium".to_string(),
        "high" | "error" => "high".to_string(),
        "critical" | "crit" => "critical".to_string(),
        _ => "medium".to_string(),
    }
}

#[tauri::command]
#[instrument(skip_all, fields(commit_id = ?commit_id, skill_count = skill_ids.as_ref().map(|s| s.len()).unwrap_or(0)), err(Debug))]
pub async fn generate_ai_review(
    app: tauri::AppHandle,
    repo_path: String,
    commit_id: Option<String>,
    skill_ids: Option<Vec<String>>,
) -> Result<AIReviewData> {
    let repo = git::open_repo(&repo_path)?;

    // Get diff based on whether we're reviewing a commit or working changes
    let diff_patch = if let Some(ref cid) = commit_id {
        let diff = git::get_commit_diff(&repo, cid)?;
        diff.patch
    } else {
        // Get combined staged and unstaged diff for working changes
        let staged = git::get_working_diff(&repo, true)?;
        let unstaged = git::get_working_diff(&repo, false)?;
        format!("{}\n{}", staged.patch, unstaged.patch)
    };

    if diff_patch.trim().is_empty() {
        return Err(AppError::validation("No changes to review"));
    }

    // Truncate diff if too long
    let max_diff_len = 12000;
    let truncated_diff = if diff_patch.len() > max_diff_len {
        format!("{}...\n[diff truncated]", &diff_patch[..max_diff_len])
    } else {
        diff_patch
    };

    // Load skill content if skills provided
    let skills_context = if let Some(ids) = &skill_ids {
        let skills_dir = get_skills_dir_path(&app)?;
        let mut context = String::new();
        for id in ids {
            let path = skills_dir.join(format!("{}.md", id));
            if path.exists() {
                if let Ok(content) = fs::read_to_string(&path) {
                    // Extract body after frontmatter
                    let (_name, _desc, body) = parse_skill_frontmatter(&content);
                    context.push_str(&format!("\n\n{}", body));
                }
            }
        }
        context
    } else {
        String::new()
    };

    let prompt = format!(
        r#"You are an expert code reviewer. Your goal is to provide actionable feedback.{skills_context}

Analyze this git diff and provide a PR-style review with specific, actionable issues.

For each issue you find, explain:
- **problem**: What is wrong or concerning
- **why**: Why it matters (impact on correctness, security, performance, maintainability)
- **suggestion**: A concrete fix or improvement

Categories: logic_bugs, edge_cases, security, performance, accidental_code, other
Severities: low, medium, high, critical

Respond ONLY with valid JSON (no markdown, no code blocks):
{{
  "overview": "1-2 sentence summary of the changes",
  "issues": [
    {{
      "id": "issue-1",
      "category": "logic_bugs",
      "severity": "high",
      "title": "brief title",
      "problem": "what is wrong",
      "why": "why it matters",
      "suggestion": "how to fix it",
      "filePath": "path/to/file.ts"
    }}
  ]
}}

If there are no issues, use an empty array for "issues".

Diff to review:
{diff}"#,
        skills_context = skills_context,
        diff = truncated_diff
    );

    // Call claude CLI
    let claude_path = find_claude_binary()?;
    let output = Command::new(&claude_path)
        .args(["-p", &prompt])
        .output()
        .map_err(|e| AppError::ai(format!("Failed to run claude at {:?}: {}", claude_path, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::ai(format!("Claude failed: {}", stderr)));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if response.is_empty() {
        return Err(AppError::ai("Claude returned an empty response"));
    }

    // Try to extract JSON from the response (Claude sometimes includes explanation text)
    let json_str = extract_json_object(&response)
        .ok_or_else(|| AppError::parse(format!("Could not find valid JSON in response: {}", response)))?;

    // Parse the JSON response
    let json: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| AppError::parse(format!("Failed to parse AI response as JSON: {}. JSON was: {}", e, json_str)))?;

    let overview = json["overview"]
        .as_str()
        .unwrap_or("Unable to generate overview")
        .to_string();

    // Parse issues with graceful defaulting
    let issues: Vec<AIReviewIssue> = json["issues"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter_map(|(idx, issue)| {
                    // Require at least a title or problem to be valid
                    let title = issue["title"].as_str()
                        .or_else(|| issue["problem"].as_str().map(|p| &p[..p.len().min(50)]))
                        .map(|s| s.to_string())?;

                    let id = issue["id"].as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("issue-{}", idx + 1));

                    let category = issue["category"].as_str()
                        .map(normalize_category)
                        .unwrap_or_else(|| "other".to_string());

                    let severity = issue["severity"].as_str()
                        .map(normalize_severity)
                        .unwrap_or_else(|| "medium".to_string());

                    let problem = issue["problem"].as_str()
                        .or_else(|| issue["description"].as_str())
                        .unwrap_or("")
                        .to_string();

                    let why = issue["why"].as_str()
                        .or_else(|| issue["explanation"].as_str())
                        .unwrap_or("")
                        .to_string();

                    let suggestion = issue["suggestion"].as_str()
                        .or_else(|| issue["fix"].as_str())
                        .unwrap_or("")
                        .to_string();

                    let file_path = issue["filePath"].as_str()
                        .or_else(|| issue["file_path"].as_str())
                        .or_else(|| issue["file"].as_str())
                        .map(|s| s.to_string());

                    Some(AIReviewIssue {
                        id,
                        category,
                        severity,
                        title,
                        problem,
                        why,
                        suggestion,
                        file_path,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let generated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(AIReviewData {
        overview,
        issues,
        generated_at,
    })
}

#[tauri::command]
#[instrument(skip_all, fields(since, until, contributor_email = ?contributor_email), err(Debug))]
pub async fn generate_changelog_summary(
    repo_path: String,
    since: i64,
    until: i64,
    contributor_email: Option<String>,
) -> Result<String> {
    // Fetch commits in range
    let repo = git::open_repo(&repo_path)?;
    let all_commits = git::get_changelog_commits_all_branches(&repo, since, until)?;

    // Filter by contributor if specified
    let commits: Vec<_> = if let Some(ref email) = contributor_email {
        all_commits.into_iter().filter(|c| c.author_email == *email).collect()
    } else {
        all_commits
    };

    if commits.is_empty() {
        return Ok("No commits found in this time range.".to_string());
    }

    // Build contributor stats
    let mut author_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for commit in &commits {
        *author_counts.entry(commit.author_name.clone()).or_insert(0) += 1;
    }
    let mut top_authors: Vec<_> = author_counts.into_iter().collect();
    top_authors.sort_by(|a, b| b.1.cmp(&a.1));
    let top_authors_str: String = top_authors.iter()
        .take(5)
        .map(|(name, count)| format!("{} ({})", name, count))
        .collect::<Vec<_>>()
        .join(", ");

    // Build commit summaries with truncation safeguards
    // Cap at ~100 commits or 6000 chars to stay within reasonable prompt limits
    let max_commits = 100;
    let max_summary_chars = 6000;
    let mut commit_lines = Vec::new();
    let mut total_chars = 0;

    for commit in commits.iter().take(max_commits) {
        let line = format!("- {} ({})", commit.summary, commit.author_name);
        total_chars += line.len();
        if total_chars > max_summary_chars {
            commit_lines.push(format!("... and {} more commits", commits.len() - commit_lines.len()));
            break;
        }
        commit_lines.push(line);
    }

    let commits_section = commit_lines.join("\n");

    // Format date range for context
    let start_date = chrono::DateTime::from_timestamp(since, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let end_date = chrono::DateTime::from_timestamp(until, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let prompt = format!(
        r#"Generate a concise changelog summary in Markdown format for a software project.

Time period: {start_date} to {end_date}
Total commits: {commit_count}
Top contributors: {top_authors_str}

Commit summaries:
{commits_section}

Instructions:
- Write 2-4 bullet points summarizing the key changes, improvements, and fixes
- Group related changes together (e.g., "Bug fixes", "New features", "Improvements")
- Be concise but informative - this is for a weekly changelog
- Use Markdown formatting with headers and bullet points
- Do not include any preamble or explanation, just output the changelog content directly"#,
        start_date = start_date,
        end_date = end_date,
        commit_count = commits.len(),
        top_authors_str = top_authors_str,
        commits_section = commits_section
    );

    // Call claude CLI
    let claude_path = find_claude_binary()?;
    let output = Command::new(&claude_path)
        .args(["-p", &prompt])
        .output()
        .map_err(|e| AppError::ai(format!("Failed to run claude at {:?}: {}", claude_path, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::ai(format!("Claude failed: {}", stderr)));
    }

    let summary = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if summary.is_empty() {
        return Err(AppError::ai("Claude returned an empty response"));
    }

    Ok(summary)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueToFix {
    pub issue_type: String, // "bug" or "file_comment"
    pub title: String,
    pub description: String,
    pub file_path: Option<String>,
}

#[tauri::command]
pub async fn fix_ai_review_issues(repo_path: String, issues: Vec<IssueToFix>) -> Result<String> {
    if issues.is_empty() {
        return Err(AppError::validation("No issues selected to fix"));
    }

    // Collect unique file paths from issues
    let mut file_paths: Vec<String> = issues
        .iter()
        .filter_map(|i| i.file_path.clone())
        .collect();
    file_paths.sort();
    file_paths.dedup();

    // Read file contents
    let mut file_contents: Vec<(String, String)> = Vec::new();
    let mut missing_files: Vec<String> = Vec::new();
    for path in &file_paths {
        let full_path = std::path::Path::new(&repo_path).join(path);
        if full_path.exists() {
            let content = std::fs::read_to_string(&full_path)
                .map_err(|e| AppError::io(format!("Failed to read {}: {}", path, e)))?;
            file_contents.push((path.clone(), content));
        } else {
            missing_files.push(path.clone());
        }
    }

    // Check if we have any file contents to work with
    if file_contents.is_empty() && !file_paths.is_empty() {
        return Err(AppError::validation(format!(
            "Cannot fix issues: none of the referenced files exist. Missing files: {}",
            missing_files.join(", ")
        )));
    }

    // Build the issues description
    let issues_desc: Vec<String> = issues
        .iter()
        .enumerate()
        .map(|(i, issue)| {
            let file_info = issue.file_path.as_ref()
                .map(|p| format!(" in {}", p))
                .unwrap_or_default();
            format!("{}. [{}]{}: {}", i + 1, issue.title, file_info, issue.description)
        })
        .collect();

    // Build the file contents section
    let files_section: String = file_contents
        .iter()
        .map(|(path, content)| format!("=== {} ===\n{}\n", path, content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"Fix the following issues in the code. Apply minimal, targeted changes to address each issue.

Issues to fix:
{}

Current file contents:
{}

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{{
  "files": [
    {{"path": "path/to/file", "content": "full corrected file content"}}
  ],
  "summary": "brief description of changes made"
}}

Include only files that need changes. Preserve all existing code that doesn't need to change."#,
        issues_desc.join("\n"),
        files_section
    );

    // Call claude CLI
    let claude_path = find_claude_binary()?;
    let output = Command::new(&claude_path)
        .args(["-p", &prompt])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| AppError::ai(format!("Failed to run claude at {:?}: {}", claude_path, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let exit_code = output.status.code().map(|c| c.to_string()).unwrap_or("unknown".to_string());

        let mut error_msg = format!("Claude CLI failed (exit code {})", exit_code);
        if !stderr.is_empty() {
            error_msg.push_str(&format!(": {}", stderr));
        } else if !stdout.is_empty() {
            // Sometimes errors are written to stdout
            error_msg.push_str(&format!(": {}", stdout));
        } else {
            error_msg.push_str(". No error output captured - the Claude CLI may not be installed or configured correctly.");
        }
        return Err(AppError::ai(error_msg));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if response.is_empty() {
        return Err(AppError::ai("Claude returned an empty response. This may indicate an issue with the Claude CLI or the prompt was too large."));
    }

    // Try to extract JSON from the response (Claude sometimes includes explanation text)
    let json_str = extract_json_object(&response)
        .ok_or_else(|| AppError::parse(format!("Could not find valid JSON in response. Response was: {}", response)))?;

    // Parse the JSON response
    let json: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| AppError::parse(format!("Failed to parse AI response as JSON: {}. JSON was: {}", e, json_str)))?;

    // Apply the fixes
    let files = json["files"].as_array()
        .ok_or_else(|| AppError::parse("Invalid response: missing files array"))?;

    let mut fixed_count = 0;
    for file in files {
        let path = file["path"].as_str()
            .ok_or_else(|| AppError::parse("Invalid response: file missing path"))?;
        let content = file["content"].as_str()
            .ok_or_else(|| AppError::parse("Invalid response: file missing content"))?;

        let full_path = std::path::Path::new(&repo_path).join(path);
        std::fs::write(&full_path, content)
            .map_err(|e| AppError::io(format!("Failed to write {}: {}", path, e)))?;
        fixed_count += 1;
    }

    let summary = json["summary"].as_str().unwrap_or("Fixes applied");
    Ok(format!("{} file(s) updated: {}", fixed_count, summary))
}

// Skills commands
#[tauri::command]
pub async fn get_skills_dir(app: tauri::AppHandle) -> Result<String> {
    let skills_dir = get_skills_dir_path(&app)?;
    Ok(skills_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_skills(app: tauri::AppHandle) -> Result<Vec<SkillMetadata>> {
    let skills_dir = get_skills_dir_path(&app)?;

    if !skills_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();
    let entries = fs::read_dir(&skills_dir)
        .map_err(|e| AppError::io(format!("Failed to read skills directory: {}", e)))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "md").unwrap_or(false) {
            if let Ok(content) = fs::read_to_string(&path) {
                let (name, description, _body) = parse_skill_frontmatter(&content);
                let id = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Try to read source URL from metadata file
                let meta_path = skills_dir.join(format!("{}.meta.json", id));
                let source_url = if meta_path.exists() {
                    fs::read_to_string(&meta_path)
                        .ok()
                        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                        .and_then(|v| v["source_url"].as_str().map(|s| s.to_string()))
                } else {
                    None
                };

                skills.push(SkillMetadata {
                    id,
                    name,
                    description,
                    source_url,
                });
            }
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn list_remote_skills() -> Result<Vec<RemoteSkill>> {
    fetch_remote_skills_cached().await
}

/// Generate possible raw GitHub URLs for a skills.sh URL
fn get_skill_url_candidates(url: &str) -> Vec<String> {
    let mut candidates = Vec::new();

    // Handle skills.sh URLs: https://skills.sh/{owner}/{repo}/{skill-name}
    if url.contains("skills.sh/") {
        if let Some(path) = url.strip_prefix("https://skills.sh/") {
            let parts: Vec<&str> = path.trim_end_matches('/').split('/').collect();
            if parts.len() >= 3 {
                let owner = parts[0];
                let repo = parts[1];
                let skill_name = parts[2];

                // Try the exact name first
                candidates.push(format!(
                    "https://raw.githubusercontent.com/{}/{}/main/skills/{}/SKILL.md",
                    owner, repo, skill_name
                ));

                // Try without common prefixes (skills.sh often uses prefixed names)
                for prefix in ["vercel-", "anthropic-", "openai-", "next-", "react-"] {
                    if let Some(stripped) = skill_name.strip_prefix(prefix) {
                        candidates.push(format!(
                            "https://raw.githubusercontent.com/{}/{}/main/skills/{}/SKILL.md",
                            owner, repo, stripped
                        ));
                    }
                }

                // Try adding common suffixes
                if !skill_name.ends_with("-best-practices") {
                    candidates.push(format!(
                        "https://raw.githubusercontent.com/{}/{}/main/skills/{}-best-practices/SKILL.md",
                        owner, repo, skill_name
                    ));
                }
            }
        }
    }

    // If no skills.sh transformation, just use the original URL
    if candidates.is_empty() {
        candidates.push(url.to_string());
    }

    candidates
}

#[tauri::command]
pub async fn install_skill_from_url(app: tauri::AppHandle, url: String) -> Result<SkillMetadata> {
    let skills_dir = get_skills_dir_path(&app)?;

    // Ensure skills directory exists
    fs::create_dir_all(&skills_dir)
        .map_err(|e| AppError::io(format!("Failed to create skills directory: {}", e)))?;

    // Get candidate URLs to try (for skills.sh URL transformation)
    let candidates = get_skill_url_candidates(&url);

    // Try each candidate URL until one works
    let mut last_error = String::new();
    let mut content = None;
    let mut successful_url = String::new();

    for candidate_url in &candidates {
        match reqwest::get(candidate_url).await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.text().await {
                        Ok(text) => {
                            if text.trim().starts_with("---") {
                                content = Some(text);
                                successful_url = candidate_url.clone();
                                break;
                            } else {
                                last_error = format!(
                                    "Content at {} is not a valid skill file (no YAML frontmatter)",
                                    candidate_url
                                );
                            }
                        }
                        Err(e) => {
                            last_error = format!("Failed to read response from {}: {}", candidate_url, e);
                        }
                    }
                } else {
                    last_error = format!("HTTP {} for {}", response.status(), candidate_url);
                }
            }
            Err(e) => {
                last_error = format!("Failed to fetch {}: {}", candidate_url, e);
            }
        }
    }

    let content = match content {
        Some(c) => c,
        None => {
            return Err(AppError::network(format!(
                "Could not fetch skill from URL. {}. \
                For skills.sh URLs, make sure the skill exists. \
                You can also try using a direct raw GitHub URL.",
                last_error
            )));
        }
    };

    // Parse frontmatter to get name (content already validated to have frontmatter)
    let (name, description, _body) = parse_skill_frontmatter(&content);

    // Validate we got a proper name
    if name == "Unnamed Skill" {
        return Err(AppError::skill(
            "Invalid skill file: could not parse name from frontmatter. \
            The file should have YAML frontmatter with a 'name' field."
        ));
    }

    let id = generate_skill_id(&name);

    // Save the skill file
    let skill_path = skills_dir.join(format!("{}.md", id));
    fs::write(&skill_path, &content)
        .map_err(|e| AppError::io(format!("Failed to save skill file: {}", e)))?;

    // Save metadata with source URL
    let meta_path = skills_dir.join(format!("{}.meta.json", id));
    let meta = serde_json::json!({
        "source_url": url,
        "fetch_url": successful_url
    });
    fs::write(&meta_path, meta.to_string())
        .map_err(|e| AppError::io(format!("Failed to save skill metadata: {}", e)))?;

    Ok(SkillMetadata {
        id,
        name,
        description,
        source_url: Some(url),
    })
}

#[tauri::command]
pub async fn delete_skill(app: tauri::AppHandle, skill_id: String) -> Result<()> {
    let skills_dir = get_skills_dir_path(&app)?;

    let skill_path = skills_dir.join(format!("{}.md", skill_id));
    let meta_path = skills_dir.join(format!("{}.meta.json", skill_id));

    if skill_path.exists() {
        fs::remove_file(&skill_path)
            .map_err(|e| AppError::io(format!("Failed to delete skill file: {}", e)))?;
    }

    if meta_path.exists() {
        fs::remove_file(&meta_path)
            .map_err(|e| AppError::io(format!("Failed to delete skill metadata: {}", e)))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_skill_content(app: tauri::AppHandle, skill_id: String) -> Result<String> {
    let skills_dir = get_skills_dir_path(&app)?;
    let skill_path = skills_dir.join(format!("{}.md", skill_id));

    if !skill_path.exists() {
        return Err(AppError::skill(format!("Skill '{}' not found", skill_id)));
    }

    let content = fs::read_to_string(&skill_path)
        .map_err(|e| AppError::io(format!("Failed to read skill file: {}", e)))?;

    // Return just the body (after frontmatter)
    let (_name, _description, body) = parse_skill_frontmatter(&content);
    Ok(body)
}

#[tauri::command]
pub async fn get_skill_raw(app: tauri::AppHandle, skill_id: String) -> Result<String> {
    let skills_dir = get_skills_dir_path(&app)?;
    let skill_path = skills_dir.join(format!("{}.md", skill_id));

    if !skill_path.exists() {
        return Err(AppError::skill(format!("Skill '{}' not found", skill_id)));
    }

    fs::read_to_string(&skill_path)
        .map_err(|e| AppError::io(format!("Failed to read skill file: {}", e)))
}

#[tauri::command]
pub async fn update_skill(
    app: tauri::AppHandle,
    skill_id: String,
    content: String,
    new_id: Option<String>,
) -> Result<SkillMetadata> {
    let skills_dir = get_skills_dir_path(&app)?;
    let old_path = skills_dir.join(format!("{}.md", skill_id));
    let old_meta_path = skills_dir.join(format!("{}.meta.json", skill_id));

    if !old_path.exists() {
        return Err(AppError::skill(format!("Skill '{}' not found", skill_id)));
    }

    // Parse the new content to get metadata
    let (name, description, _body) = parse_skill_frontmatter(&content);

    // Determine the new ID
    let final_id = new_id.unwrap_or_else(|| generate_skill_id(&name));

    // Validate the content has frontmatter
    if !content.trim().starts_with("---") {
        return Err(AppError::validation("Invalid skill content: must start with YAML frontmatter (---)"));
    }

    if name == "Unnamed Skill" {
        return Err(AppError::validation("Invalid skill content: frontmatter must include a 'name' field"));
    }

    // Read existing metadata
    let source_url = if old_meta_path.exists() {
        fs::read_to_string(&old_meta_path)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .and_then(|v| v["source_url"].as_str().map(|s| s.to_string()))
    } else {
        None
    };

    // If ID changed, we need to rename the files
    if final_id != skill_id {
        let new_path = skills_dir.join(format!("{}.md", final_id));
        let new_meta_path = skills_dir.join(format!("{}.meta.json", final_id));

        // Check if new ID already exists
        if new_path.exists() {
            return Err(AppError::validation(format!("A skill with ID '{}' already exists", final_id)));
        }

        // Write to new path
        fs::write(&new_path, &content)
            .map_err(|e| AppError::io(format!("Failed to save skill file: {}", e)))?;

        // Move metadata if exists
        if let Some(ref url) = source_url {
            let meta = serde_json::json!({ "source_url": url });
            fs::write(&new_meta_path, meta.to_string())
                .map_err(|e| AppError::io(format!("Failed to save skill metadata: {}", e)))?;
        }

        // Delete old files
        fs::remove_file(&old_path).ok();
        if old_meta_path.exists() {
            fs::remove_file(&old_meta_path).ok();
        }
    } else {
        // Just update the content in place
        fs::write(&old_path, &content)
            .map_err(|e| AppError::io(format!("Failed to save skill file: {}", e)))?;
    }

    Ok(SkillMetadata {
        id: final_id,
        name,
        description,
        source_url,
    })
}

// Worktree commands
#[tauri::command]
pub async fn list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>> {
    // Use CLI-based listing which works correctly from any worktree
    Ok(git::list_worktrees_cli(&repo_path)?)
}

#[tauri::command]
pub async fn create_worktree(
    repo_path: String,
    name: String,
    path: String,
    branch: Option<String>,
    new_branch: Option<String>,
) -> Result<WorktreeInfo> {
    let options = WorktreeCreateOptions {
        name,
        path,
        branch,
        new_branch,
    };
    Ok(git::create_worktree(&repo_path, options)?)
}

#[tauri::command]
pub async fn remove_worktree(repo_path: String, worktree_name: String, force: bool) -> Result<()> {
    Ok(git::remove_worktree(&repo_path, &worktree_name, force)?)
}

#[tauri::command]
pub async fn lock_worktree(repo_path: String, worktree_name: String, reason: Option<String>) -> Result<()> {
    Ok(git::lock_worktree(&repo_path, &worktree_name, reason.as_deref())?)
}

#[tauri::command]
pub async fn unlock_worktree(repo_path: String, worktree_name: String) -> Result<()> {
    Ok(git::unlock_worktree(&repo_path, &worktree_name)?)
}

// Stash commands
#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn list_stashes(repo_path: String) -> Result<Vec<StashEntry>> {
    let mut repo = git::open_repo(&repo_path)?;
    Ok(git::list_stashes(&mut repo)?)
}

#[tauri::command]
#[instrument(skip_all, fields(message = ?message), err(Debug))]
pub async fn create_stash(repo_path: String, message: Option<String>) -> Result<()> {
    let mut repo = git::open_repo(&repo_path)?;

    // Check if there are any changes to stash
    let status = git::get_status(&repo)?;
    if status.staged.is_empty() && status.unstaged.is_empty() {
        return Err(AppError::validation("No local changes to stash"));
    }

    git::create_stash(&mut repo, message.as_deref())?;
    Ok(())
}

#[tauri::command]
#[instrument(skip_all, fields(stash_index), err(Debug))]
pub async fn apply_stash(repo_path: String, stash_index: usize) -> Result<()> {
    let mut repo = git::open_repo(&repo_path)?;
    git::apply_stash(&mut repo, stash_index).map_err(|e| {
        // Check if the error is due to conflicts
        let err_msg = e.to_string();
        if err_msg.contains("conflict") || err_msg.contains("CONFLICT") {
            AppError::validation("Stash apply failed due to conflicts. Resolve conflicts in the affected files and stage them.")
        } else {
            AppError::from(e)
        }
    })?;
    Ok(())
}

#[tauri::command]
#[instrument(skip_all, fields(stash_index), err(Debug))]
pub async fn pop_stash(repo_path: String, stash_index: usize) -> Result<()> {
    let mut repo = git::open_repo(&repo_path)?;
    git::pop_stash(&mut repo, stash_index).map_err(|e| {
        // Check if the error is due to conflicts
        let err_msg = e.to_string();
        if err_msg.contains("conflict") || err_msg.contains("CONFLICT") {
            AppError::validation("Stash pop failed due to conflicts. Resolve conflicts in the affected files and stage them.")
        } else {
            AppError::from(e)
        }
    })?;
    Ok(())
}

#[tauri::command]
#[instrument(skip_all, fields(stash_index), err(Debug))]
pub async fn drop_stash(repo_path: String, stash_index: usize) -> Result<()> {
    let mut repo = git::open_repo(&repo_path)?;
    git::drop_stash(&mut repo, stash_index)?;
    Ok(())
}

// Reflog command
#[tauri::command]
#[instrument(skip_all, fields(limit), err(Debug))]
pub async fn get_reflog(repo_path: String, limit: usize) -> Result<Vec<ReflogEntry>> {
    // Run blocking git operation on dedicated thread pool
    tokio::task::spawn_blocking(move || {
        Ok(git::get_reflog(&repo_path, limit)?)
    })
    .await
    .map_err(|e| AppError::io(format!("Task join error: {}", e)))?
}

#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn get_ahead_behind(repo_path: String) -> Result<Option<AheadBehind>> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::get_ahead_behind(&repo)?)
}

// Merge conflict commands
#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn get_merge_status(repo_path: String) -> Result<MergeStatus> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::get_merge_status(&repo)?)
}

#[tauri::command]
pub async fn parse_file_conflicts(repo_path: String, file_path: String) -> Result<FileConflictInfo> {
    Ok(git::parse_file_conflicts(&repo_path, &file_path)?)
}

#[tauri::command]
pub async fn save_resolved_file(repo_path: String, file_path: String, content: String) -> Result<()> {
    Ok(git::save_resolved_file(&repo_path, &file_path, &content)?)
}

#[tauri::command]
pub async fn mark_file_resolved(repo_path: String, file_path: String) -> Result<()> {
    let repo = git::open_repo(&repo_path)?;
    Ok(git::mark_file_resolved(&repo, &file_path)?)
}

#[tauri::command]
pub async fn abort_merge(repo_path: String) -> Result<String> {
    Ok(git::abort_merge(&repo_path)?)
}

#[tauri::command]
pub async fn continue_merge(repo_path: String) -> Result<String> {
    Ok(git::continue_merge(&repo_path)?)
}

#[tauri::command]
pub async fn merge_branch(repo_path: String, branch_name: String) -> Result<String> {
    Ok(git::merge_branch(&repo_path, &branch_name)?)
}

#[derive(serde::Serialize)]
pub struct AIResolveConflictResponse {
    pub resolved: String,
    pub explanation: String,
}

#[tauri::command]
pub async fn ai_resolve_conflict(
    file_path: String,
    ours_content: String,
    theirs_content: String,
    instructions: Option<String>,
) -> Result<AIResolveConflictResponse> {
    let instructions_text = instructions.unwrap_or_default();
    
    let prompt = format!(
        r#"You are resolving a Git merge conflict.

File: {file_path}

## Current Branch (Ours)
```
{ours_content}
```

## Incoming Branch (Theirs)
```
{theirs_content}
```

{instructions_section}

Analyze both versions and produce a merged result that:
1. Preserves all intended functionality from both branches
2. Resolves any conflicts logically
3. Maintains code style consistency

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{{"resolved": "the merged code here", "explanation": "brief explanation of how you resolved the conflict"}}"#,
        file_path = file_path,
        ours_content = ours_content,
        theirs_content = theirs_content,
        instructions_section = if instructions_text.is_empty() {
            String::new()
        } else {
            format!("## User Instructions\n{}\n", instructions_text)
        }
    );

    // Call claude CLI
    let claude_path = find_claude_binary()?;
    let output = Command::new(&claude_path)
        .args(["-p", &prompt])
        .output()
        .map_err(|e| AppError::ai(format!("Failed to run claude at {:?}: {}", claude_path, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::ai(format!("Claude failed: {}", stderr)));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if response.is_empty() {
        return Err(AppError::ai("Claude returned an empty response"));
    }

    // Extract JSON from response
    let json_str = extract_json_object(&response)
        .ok_or_else(|| AppError::parse(format!("Could not find valid JSON in response: {}", response)))?;

    let json: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| AppError::parse(format!("Failed to parse AI response as JSON: {}. JSON was: {}", e, json_str)))?;

    let resolved = json["resolved"]
        .as_str()
        .ok_or_else(|| AppError::parse("Invalid response: missing 'resolved' field"))?
        .to_string();

    let explanation = json["explanation"]
        .as_str()
        .unwrap_or("Conflict resolved")
        .to_string();

    Ok(AIResolveConflictResponse {
        resolved,
        explanation,
    })
}

// =============================================================================
// File Watcher Commands
// =============================================================================

use crate::watcher::WatcherState;

// Contributor review types
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributorReviewData {
    pub grade: String,
    pub commentary: String,
    pub highlights: Vec<String>,
    pub generated_at: i64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributorReviewRequest {
    pub contributor_name: String,
    pub contributor_email: String,
    pub time_range_label: String,
    pub commit_summaries: Vec<String>,
    pub total_commits: usize,
    pub total_files_changed: usize,
    pub total_additions: usize,
    pub total_deletions: usize,
}

#[tauri::command]
#[instrument(skip_all, fields(contributor = %request.contributor_email, commits = request.total_commits), err(Debug))]
pub async fn generate_contributor_review(
    request: ContributorReviewRequest,
) -> Result<ContributorReviewData> {
    if request.commit_summaries.is_empty() {
        return Err(AppError::validation("No commits to review"));
    }

    // Build commit list for prompt (limit to avoid token overflow)
    let max_commits = 50;
    let commit_list: String = request.commit_summaries
        .iter()
        .take(max_commits)
        .map(|s| format!("- {}", s))
        .collect::<Vec<_>>()
        .join("\n");

    let truncation_note = if request.commit_summaries.len() > max_commits {
        format!("\n(showing {} of {} commits)", max_commits, request.commit_summaries.len())
    } else {
        String::new()
    };

    let prompt = format!(
        r#"You are a engineering manager reviewing a contributor's work.

Analyze this contributor's activity and provide a performance assessment.

Contributor: {name} ({email})
Time Period: {time_range}
Statistics:
- Total Commits: {total_commits}
- Files Changed: {files_changed}
- Lines Added: {additions}
- Lines Deleted: {deletions}

Recent Commit Messages:
{commits}{truncation}

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{{
  "grade": "A|A-|B+|B|B-|C+|C|C-|D|F",
  "commentary": "2-3 sentences summarizing their contributions, work patterns, and impact. Be specific about what they worked on based on the commit messages.",
  "highlights": ["up to 3 notable contributions or patterns observed"]
}}

Grading guidelines:
- A/A-: Exceptional productivity, clear impactful features, consistent quality
- B+/B/B-: Good productivity, meaningful contributions
- C+/C/C-: Average activity, routine maintenance work
- D/F: Minimal activity or unclear contributions

Be constructive and professional. Focus on the work, not the person."#,
        name = request.contributor_name,
        email = request.contributor_email,
        time_range = request.time_range_label,
        total_commits = request.total_commits,
        files_changed = request.total_files_changed,
        additions = request.total_additions,
        deletions = request.total_deletions,
        commits = commit_list,
        truncation = truncation_note,
    );

    // Call claude CLI
    let claude_path = find_claude_binary()?;
    let output = Command::new(&claude_path)
        .args(["-p", &prompt])
        .output()
        .map_err(|e| AppError::ai(format!("Failed to run claude at {:?}: {}", claude_path, e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::ai(format!("Claude failed: {}", stderr)));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Parse the JSON response
    let json: serde_json::Value = serde_json::from_str(&response)
        .map_err(|e| AppError::parse(format!("Failed to parse AI response as JSON: {}. Response was: {}", e, response)))?;

    let grade = json["grade"]
        .as_str()
        .unwrap_or("N/A")
        .to_string();

    let commentary = json["commentary"]
        .as_str()
        .unwrap_or("Unable to generate commentary")
        .to_string();

    let highlights: Vec<String> = json["highlights"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|h| h.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(ContributorReviewData {
        grade,
        commentary,
        highlights,
        generated_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
    })
}

#[tauri::command]
#[instrument(skip_all, fields(repo_path = %repo_path), err(Debug))]
pub async fn start_watching(
    app: tauri::AppHandle,
    state: tauri::State<'_, WatcherState>,
    repo_path: String,
) -> Result<()> {
    let path = PathBuf::from(&repo_path);
    state
        .watch(path, app)
        .map_err(|e| AppError::io(format!("Failed to start watcher: {}", e)))
}

#[tauri::command]
#[instrument(skip_all, err(Debug))]
pub async fn stop_watching(state: tauri::State<'_, WatcherState>) -> Result<()> {
    state
        .unwatch()
        .map_err(|e| AppError::io(format!("Failed to stop watcher: {}", e)))
}
