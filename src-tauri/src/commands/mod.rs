use crate::git::{self, BranchInfo, CommitGraph, CommitInfo, FileDiff, RepositoryInfo, StatusInfo, UnifiedDiff, WorktreeInfo, WorktreeCreateOptions};
use std::process::Command;
use std::path::PathBuf;
use std::fs;
use tauri::Manager;

type Result<T> = std::result::Result<T, String>;

// Skills-related types
#[derive(serde::Serialize, Clone)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source_url: Option<String>,
}

/// Get the skills directory path
fn get_skills_dir_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
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

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
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
pub async fn open_repository(path: String) -> Result<RepositoryInfo> {
    let repo = git::open_repo(&path).map_err(map_err)?;
    git::get_repository_info(&repo).map_err(map_err)
}

#[tauri::command]
pub async fn discover_repository(start_path: String) -> Result<RepositoryInfo> {
    let repo = git::discover_repo(&start_path).map_err(map_err)?;
    git::get_repository_info(&repo).map_err(map_err)
}

#[tauri::command]
pub async fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::list_all_branches(&repo).map_err(map_err)
}

#[tauri::command]
pub async fn checkout_branch(repo_path: String, branch_name: String) -> Result<()> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::checkout_branch(&repo, &branch_name).map_err(map_err)
}

#[tauri::command]
pub async fn get_commit_history(
    repo_path: String,
    branch: Option<String>,
    limit: usize,
    offset: usize,
) -> Result<Vec<CommitInfo>> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::get_commits(&repo, branch.as_deref(), limit, offset).map_err(map_err)
}

#[tauri::command]
pub async fn get_commit_graph(repo_path: String, commit_ids: Vec<String>) -> Result<CommitGraph> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::build_commit_graph(&repo, &commit_ids).map_err(map_err)
}

#[tauri::command]
pub async fn get_commit_diff(repo_path: String, commit_id: String) -> Result<UnifiedDiff> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::get_commit_diff(&repo, &commit_id).map_err(map_err)
}

#[tauri::command]
pub async fn get_file_diff(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<FileDiff> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::get_file_diff(&repo, &commit_id, &file_path).map_err(map_err)
}

#[tauri::command]
pub async fn get_working_diff(repo_path: String, staged: bool) -> Result<UnifiedDiff> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::get_working_diff(&repo, staged).map_err(map_err)
}

#[tauri::command]
pub async fn get_status(repo_path: String) -> Result<StatusInfo> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::get_status(&repo).map_err(map_err)
}

#[tauri::command]
pub async fn stage_files(repo_path: String, paths: Vec<String>) -> Result<()> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::stage_files(&repo, &paths).map_err(map_err)
}

#[tauri::command]
pub async fn unstage_files(repo_path: String, paths: Vec<String>) -> Result<()> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::unstage_files(&repo, &paths).map_err(map_err)
}

#[tauri::command]
pub async fn discard_changes(repo_path: String, paths: Vec<String>) -> Result<()> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::discard_changes(&repo, &paths).map_err(map_err)
}

#[tauri::command]
pub async fn create_commit(repo_path: String, message: String) -> Result<String> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::create_commit(&repo, &message).map_err(map_err)
}

#[tauri::command]
pub async fn git_fetch(repo_path: String) -> Result<String> {
    git::git_fetch(&repo_path).map_err(map_err)
}

#[tauri::command]
pub async fn git_pull(repo_path: String) -> Result<String> {
    git::git_pull(&repo_path).map_err(map_err)
}

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<String> {
    git::git_push(&repo_path).map_err(map_err)
}

#[tauri::command]
pub async fn generate_commit_message(repo_path: String) -> Result<String> {
    // Get the staged diff
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    let diff = git::get_working_diff(&repo, true).map_err(map_err)?;

    if diff.patch.is_empty() {
        return Err("No staged changes to generate a commit message for".to_string());
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
        .map_err(|e| format!("Failed to run claude at {:?}: {}", claude_path, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude failed: {}", stderr));
    }

    let message = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(message)
}

#[derive(serde::Serialize)]
pub struct AIReviewBug {
    pub title: String,
    pub description: String,
    pub severity: String,
}

#[derive(serde::Serialize)]
pub struct AIReviewFileComment {
    pub file_path: String,
    pub severity: String,
    pub title: String,
    pub explanation: String,
}

#[derive(serde::Serialize)]
pub struct AIReviewData {
    pub overview: String,
    pub potential_bugs: Vec<AIReviewBug>,
    pub file_comments: Vec<AIReviewFileComment>,
    pub generated_at: u64,
}

#[tauri::command]
pub async fn generate_ai_review(
    app: tauri::AppHandle,
    repo_path: String,
    commit_id: Option<String>,
    skill_ids: Option<Vec<String>>,
) -> Result<AIReviewData> {
    let repo = git::open_repo(&repo_path).map_err(map_err)?;

    // Get diff based on whether we're reviewing a commit or working changes
    let diff_patch = if let Some(ref cid) = commit_id {
        let diff = git::get_commit_diff(&repo, cid).map_err(map_err)?;
        diff.patch
    } else {
        // Get combined staged and unstaged diff for working changes
        let staged = git::get_working_diff(&repo, true).map_err(map_err)?;
        let unstaged = git::get_working_diff(&repo, false).map_err(map_err)?;
        format!("{}\n{}", staged.patch, unstaged.patch)
    };

    if diff_patch.trim().is_empty() {
        return Err("No changes to review".to_string());
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
        r#"You are a code reviewer.{skills_context}

Analyze this git diff and provide a PR-style review.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{{
  "overview": "1-2 sentence summary of the changes",
  "potentialBugs": [
    {{"title": "brief title", "description": "explanation", "severity": "low|medium|high"}}
  ],
  "fileComments": [
    {{"filePath": "path/to/file", "severity": "info|warning|error", "title": "brief title", "explanation": "detailed explanation"}}
  ]
}}

If there are no bugs or comments, use empty arrays.

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
        .map_err(|e| format!("Failed to run claude at {:?}: {}", claude_path, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude failed: {}", stderr));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Parse the JSON response
    let json: serde_json::Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse AI response as JSON: {}. Response was: {}", e, response))?;

    let overview = json["overview"]
        .as_str()
        .unwrap_or("Unable to generate overview")
        .to_string();

    let potential_bugs: Vec<AIReviewBug> = json["potentialBugs"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|bug| {
                    Some(AIReviewBug {
                        title: bug["title"].as_str()?.to_string(),
                        description: bug["description"].as_str()?.to_string(),
                        severity: bug["severity"].as_str().unwrap_or("medium").to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let file_comments: Vec<AIReviewFileComment> = json["fileComments"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|comment| {
                    Some(AIReviewFileComment {
                        file_path: comment["filePath"].as_str()?.to_string(),
                        severity: comment["severity"].as_str().unwrap_or("info").to_string(),
                        title: comment["title"].as_str()?.to_string(),
                        explanation: comment["explanation"].as_str()?.to_string(),
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
        potential_bugs,
        file_comments,
        generated_at,
    })
}

#[derive(serde::Deserialize)]
pub struct IssueToFix {
    pub issue_type: String, // "bug" or "file_comment"
    pub title: String,
    pub description: String,
    pub file_path: Option<String>,
}

#[tauri::command]
pub async fn fix_ai_review_issues(repo_path: String, issues: Vec<IssueToFix>) -> Result<String> {
    if issues.is_empty() {
        return Err("No issues selected to fix".to_string());
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
                .map_err(|e| format!("Failed to read {}: {}", path, e))?;
            file_contents.push((path.clone(), content));
        } else {
            missing_files.push(path.clone());
        }
    }

    // Check if we have any file contents to work with
    if file_contents.is_empty() && !file_paths.is_empty() {
        return Err(format!(
            "Cannot fix issues: none of the referenced files exist. Missing files: {}",
            missing_files.join(", ")
        ));
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
        .map_err(|e| format!("Failed to run claude at {:?}: {}", claude_path, e))?;

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
        return Err(error_msg);
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if response.is_empty() {
        return Err("Claude returned an empty response. This may indicate an issue with the Claude CLI or the prompt was too large.".to_string());
    }

    // Try to extract JSON from the response (Claude sometimes includes explanation text)
    let json_str = extract_json_object(&response)
        .ok_or_else(|| format!("Could not find valid JSON in response. Response was: {}", response))?;

    // Parse the JSON response
    let json: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI response as JSON: {}. JSON was: {}", e, json_str))?;

    // Apply the fixes
    let files = json["files"].as_array()
        .ok_or("Invalid response: missing files array")?;

    let mut fixed_count = 0;
    for file in files {
        let path = file["path"].as_str()
            .ok_or("Invalid response: file missing path")?;
        let content = file["content"].as_str()
            .ok_or("Invalid response: file missing content")?;

        let full_path = std::path::Path::new(&repo_path).join(path);
        std::fs::write(&full_path, content)
            .map_err(|e| format!("Failed to write {}: {}", path, e))?;
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
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

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
        .map_err(|e| format!("Failed to create skills directory: {}", e))?;

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
            return Err(format!(
                "Could not fetch skill from URL. {}. \
                For skills.sh URLs, make sure the skill exists. \
                You can also try using a direct raw GitHub URL.",
                last_error
            ));
        }
    };

    // Parse frontmatter to get name (content already validated to have frontmatter)
    let (name, description, _body) = parse_skill_frontmatter(&content);

    // Validate we got a proper name
    if name == "Unnamed Skill" {
        return Err(
            "Invalid skill file: could not parse name from frontmatter. \
            The file should have YAML frontmatter with a 'name' field.".to_string()
        );
    }

    let id = generate_skill_id(&name);

    // Save the skill file
    let skill_path = skills_dir.join(format!("{}.md", id));
    fs::write(&skill_path, &content)
        .map_err(|e| format!("Failed to save skill file: {}", e))?;

    // Save metadata with source URL
    let meta_path = skills_dir.join(format!("{}.meta.json", id));
    let meta = serde_json::json!({
        "source_url": url,
        "fetch_url": successful_url
    });
    fs::write(&meta_path, meta.to_string())
        .map_err(|e| format!("Failed to save skill metadata: {}", e))?;

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
            .map_err(|e| format!("Failed to delete skill file: {}", e))?;
    }

    if meta_path.exists() {
        fs::remove_file(&meta_path)
            .map_err(|e| format!("Failed to delete skill metadata: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_skill_content(app: tauri::AppHandle, skill_id: String) -> Result<String> {
    let skills_dir = get_skills_dir_path(&app)?;
    let skill_path = skills_dir.join(format!("{}.md", skill_id));

    if !skill_path.exists() {
        return Err(format!("Skill '{}' not found", skill_id));
    }

    let content = fs::read_to_string(&skill_path)
        .map_err(|e| format!("Failed to read skill file: {}", e))?;

    // Return just the body (after frontmatter)
    let (_name, _description, body) = parse_skill_frontmatter(&content);
    Ok(body)
}

#[tauri::command]
pub async fn get_skill_raw(app: tauri::AppHandle, skill_id: String) -> Result<String> {
    let skills_dir = get_skills_dir_path(&app)?;
    let skill_path = skills_dir.join(format!("{}.md", skill_id));

    if !skill_path.exists() {
        return Err(format!("Skill '{}' not found", skill_id));
    }

    fs::read_to_string(&skill_path)
        .map_err(|e| format!("Failed to read skill file: {}", e))
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
        return Err(format!("Skill '{}' not found", skill_id));
    }

    // Parse the new content to get metadata
    let (name, description, _body) = parse_skill_frontmatter(&content);

    // Determine the new ID
    let final_id = new_id.unwrap_or_else(|| generate_skill_id(&name));

    // Validate the content has frontmatter
    if !content.trim().starts_with("---") {
        return Err("Invalid skill content: must start with YAML frontmatter (---)".to_string());
    }

    if name == "Unnamed Skill" {
        return Err("Invalid skill content: frontmatter must include a 'name' field".to_string());
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
            return Err(format!("A skill with ID '{}' already exists", final_id));
        }

        // Write to new path
        fs::write(&new_path, &content)
            .map_err(|e| format!("Failed to save skill file: {}", e))?;

        // Move metadata if exists
        if let Some(ref url) = source_url {
            let meta = serde_json::json!({ "source_url": url });
            fs::write(&new_meta_path, meta.to_string())
                .map_err(|e| format!("Failed to save skill metadata: {}", e))?;
        }

        // Delete old files
        fs::remove_file(&old_path).ok();
        if old_meta_path.exists() {
            fs::remove_file(&old_meta_path).ok();
        }
    } else {
        // Just update the content in place
        fs::write(&old_path, &content)
            .map_err(|e| format!("Failed to save skill file: {}", e))?;
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
    let repo = git::open_repo(&repo_path).map_err(map_err)?;
    git::list_worktrees(&repo).map_err(map_err)
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
    git::create_worktree(&repo_path, options).map_err(map_err)
}

#[tauri::command]
pub async fn remove_worktree(repo_path: String, worktree_name: String, force: bool) -> Result<()> {
    git::remove_worktree(&repo_path, &worktree_name, force).map_err(map_err)
}

#[tauri::command]
pub async fn lock_worktree(repo_path: String, worktree_name: String, reason: Option<String>) -> Result<()> {
    git::lock_worktree(&repo_path, &worktree_name, reason.as_deref()).map_err(map_err)
}

#[tauri::command]
pub async fn unlock_worktree(repo_path: String, worktree_name: String) -> Result<()> {
    git::unlock_worktree(&repo_path, &worktree_name).map_err(map_err)
}
