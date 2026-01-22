use crate::git::{self, BranchInfo, CommitGraph, CommitInfo, FileDiff, RepositoryInfo, StatusInfo, UnifiedDiff};
use std::process::Command;

type Result<T> = std::result::Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
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
    let output = Command::new("claude")
        .args(["-p", &prompt])
        .output()
        .map_err(|e| format!("Failed to run claude: {}", e))?;

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
pub async fn generate_ai_review(repo_path: String, commit_id: Option<String>) -> Result<AIReviewData> {
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

    let prompt = format!(
        r#"You are a code reviewer. Analyze this git diff and provide a PR-style review.

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
{}"#,
        truncated_diff
    );

    // Call claude CLI
    let output = Command::new("claude")
        .args(["-p", &prompt])
        .output()
        .map_err(|e| format!("Failed to run claude: {}", e))?;

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
    for path in &file_paths {
        let full_path = std::path::Path::new(&repo_path).join(path);
        if full_path.exists() {
            let content = std::fs::read_to_string(&full_path)
                .map_err(|e| format!("Failed to read {}: {}", path, e))?;
            file_contents.push((path.clone(), content));
        }
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
    let output = Command::new("claude")
        .args(["-p", &prompt])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run claude: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude failed: {}", stderr));
    }

    let response = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Parse the JSON response
    let json: serde_json::Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse AI response as JSON: {}. Response was: {}", e, response))?;

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
