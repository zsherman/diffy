use git2::{Repository, RepositoryState, StatusOptions};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

use super::GitError;

/// Get the user's PATH from their login shell (for packaged app compatibility)
fn get_user_path() -> String {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    if let Ok(output) = Command::new(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();
    format!(
        "/usr/local/bin:/opt/homebrew/bin:{}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        home
    )
}

/// Create a git Command with proper environment for packaged app
fn git_command() -> Command {
    let mut cmd = Command::new("git");
    cmd.env("PATH", get_user_path());
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", &home);
        cmd.env("SSH_AUTH_SOCK", std::env::var("SSH_AUTH_SOCK").unwrap_or_default());
    }
    cmd
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeStatus {
    pub in_merge: bool,
    pub conflicting_files: Vec<String>,
    pub their_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictRegion {
    pub start_line: usize,
    pub end_line: usize,
    pub ours_content: String,
    pub theirs_content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileConflictInfo {
    pub file_path: String,
    pub conflicts: Vec<ConflictRegion>,
    pub ours_full: String,
    pub theirs_full: String,
    pub original_content: String,
}

/// Check if the repository is in a merge state and list conflicting files
pub fn get_merge_status(repo: &Repository) -> Result<MergeStatus, GitError> {
    let state = repo.state();
    let in_merge = matches!(
        state,
        RepositoryState::Merge | RepositoryState::RevertSequence | RepositoryState::CherryPickSequence
    );

    let mut conflicting_files = Vec::new();

    if in_merge {
        let mut opts = StatusOptions::new();
        opts.include_untracked(false);

        let statuses = repo.statuses(Some(&mut opts))?;

        for entry in statuses.iter() {
            let status = entry.status();
            if status.is_conflicted() {
                if let Some(path) = entry.path() {
                    conflicting_files.push(path.to_string());
                }
            }
        }
    }

    // Try to get the branch being merged from MERGE_MSG or MERGE_HEAD
    let their_branch = get_their_branch(repo);

    Ok(MergeStatus {
        in_merge,
        conflicting_files,
        their_branch,
    })
}

/// Try to extract the incoming branch name from MERGE_MSG
fn get_their_branch(repo: &Repository) -> Option<String> {
    let git_dir = repo.path();
    
    // Try MERGE_MSG first
    let merge_msg_path = git_dir.join("MERGE_MSG");
    if let Ok(content) = fs::read_to_string(&merge_msg_path) {
        // Format is typically "Merge branch 'branch-name' into ..."
        if let Some(start) = content.find("Merge branch '") {
            let after_quote = &content[start + 14..];
            if let Some(end) = after_quote.find('\'') {
                return Some(after_quote[..end].to_string());
            }
        }
        // Try "Merge remote-tracking branch 'origin/branch-name'"
        if let Some(start) = content.find("Merge remote-tracking branch '") {
            let after_quote = &content[start + 30..];
            if let Some(end) = after_quote.find('\'') {
                return Some(after_quote[..end].to_string());
            }
        }
    }

    None
}

/// Parse a file with conflict markers and extract conflict regions
pub fn parse_file_conflicts(repo_path: &str, file_path: &str) -> Result<FileConflictInfo, GitError> {
    let full_path = Path::new(repo_path).join(file_path);
    let content = fs::read_to_string(&full_path)
        .map_err(|e| git2::Error::from_str(&format!("Failed to read file {}: {}", file_path, e)))?;

    let lines: Vec<&str> = content.lines().collect();
    let mut conflicts = Vec::new();
    let mut ours_lines: Vec<String> = Vec::new();
    let mut theirs_lines: Vec<String> = Vec::new();

    let mut i = 0;
    let mut in_conflict = false;
    let mut in_ours = false;
    let mut conflict_start = 0;
    let mut current_ours: Vec<String> = Vec::new();
    let mut current_theirs: Vec<String> = Vec::new();

    while i < lines.len() {
        let line = lines[i];

        if line.starts_with("<<<<<<<") {
            in_conflict = true;
            in_ours = true;
            conflict_start = i + 1; // 1-based line number
            current_ours.clear();
            current_theirs.clear();
        } else if line.starts_with("=======") && in_conflict {
            in_ours = false;
        } else if line.starts_with(">>>>>>>") && in_conflict {
            // End of conflict block
            conflicts.push(ConflictRegion {
                start_line: conflict_start,
                end_line: i + 1, // 1-based, inclusive
                ours_content: current_ours.join("\n"),
                theirs_content: current_theirs.join("\n"),
            });

            // For full file reconstruction, add ours content to ours_lines
            for s in &current_ours {
                ours_lines.push(s.clone());
            }
            // Add theirs content to theirs_lines
            for s in &current_theirs {
                theirs_lines.push(s.clone());
            }

            in_conflict = false;
            in_ours = false;
        } else if in_conflict {
            if in_ours {
                current_ours.push(line.to_string());
            } else {
                current_theirs.push(line.to_string());
            }
        } else {
            // Normal line - add to both reconstructions
            ours_lines.push(line.to_string());
            theirs_lines.push(line.to_string());
        }

        i += 1;
    }

    Ok(FileConflictInfo {
        file_path: file_path.to_string(),
        conflicts,
        ours_full: ours_lines.join("\n"),
        theirs_full: theirs_lines.join("\n"),
        original_content: content,
    })
}

/// Save resolved content to a file
pub fn save_resolved_file(repo_path: &str, file_path: &str, content: &str) -> Result<(), GitError> {
    let full_path = Path::new(repo_path).join(file_path);
    fs::write(&full_path, content)
        .map_err(|e| git2::Error::from_str(&format!("Failed to write file {}: {}", file_path, e)))?;
    Ok(())
}

/// Mark a file as resolved by staging it
pub fn mark_file_resolved(repo: &Repository, file_path: &str) -> Result<(), GitError> {
    let mut index = repo.index()?;
    index.add_path(Path::new(file_path))?;
    index.write()?;
    Ok(())
}

/// Abort the current merge
pub fn abort_merge(repo_path: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["merge", "--abort"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git merge --abort: {}", e)))?;

    if output.status.success() {
        Ok("Merge aborted successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(git2::Error::from_str(&format!("git merge --abort failed: {}", stderr)).into())
    }
}

/// Merge a branch into the current branch
pub fn merge_branch(repo_path: &str, branch_name: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["merge", branch_name, "--no-edit"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git merge: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Check if it's a conflict (exit code 1 with conflict message)
        if stderr.contains("CONFLICT") || stderr.contains("Automatic merge failed") {
            Err(git2::Error::from_str("Merge has conflicts that need to be resolved").into())
        } else {
            Err(git2::Error::from_str(&format!("git merge failed: {}", stderr)).into())
        }
    }
}

/// Continue the merge (create merge commit)
pub fn continue_merge(repo_path: &str) -> Result<String, GitError> {
    // First check if there are still unresolved conflicts
    let repo = super::open_repo(repo_path)?;
    let status = get_merge_status(&repo)?;
    
    if !status.conflicting_files.is_empty() {
        return Err(git2::Error::from_str(&format!(
            "Cannot continue merge: {} file(s) still have conflicts",
            status.conflicting_files.len()
        )).into());
    }

    // Use git commit --no-edit to complete the merge (works reliably across git versions)
    // This is equivalent to git merge --continue but doesn't require Git 2.12+
    let output = git_command()
        .args(["commit", "--no-edit"])
        .current_dir(repo_path)
        .env("GIT_EDITOR", "true")  // Prevent editor from opening
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git commit: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(git2::Error::from_str(&format!(
            "Failed to complete merge: {}{}",
            stderr.trim(),
            if !stdout.is_empty() { format!("\n{}", stdout.trim()) } else { String::new() }
        )).into())
    }
}
