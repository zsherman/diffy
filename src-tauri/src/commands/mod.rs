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
