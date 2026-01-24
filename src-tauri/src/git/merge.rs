use git2::{Repository, RepositoryState, StatusOptions};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

use super::GitError;

// =============================================================================
// Interactive Rebase Types
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RebaseTodoAction {
    Pick,
    Reword,
    Edit,
    Squash,
    Fixup,
    Drop,
}

impl RebaseTodoAction {
    pub fn to_git_command(&self) -> &'static str {
        match self {
            RebaseTodoAction::Pick => "pick",
            RebaseTodoAction::Reword => "reword",
            RebaseTodoAction::Edit => "edit",
            RebaseTodoAction::Squash => "squash",
            RebaseTodoAction::Fixup => "fixup",
            RebaseTodoAction::Drop => "drop",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveRebaseCommit {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub time: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveRebasePlanEntry {
    pub commit_id: String,
    pub action: RebaseTodoAction,
    pub new_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RebaseStopReason {
    None,
    Conflict,
    Edit,
    Reword,
    SquashMessage,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveRebaseState {
    pub in_rebase: bool,
    pub is_interactive: bool,
    pub current_step: Option<usize>,
    pub total_steps: Option<usize>,
    pub stop_reason: RebaseStopReason,
    pub stopped_commit_id: Option<String>,
    pub conflicting_files: Vec<String>,
    pub onto_ref: Option<String>,
    pub current_message: Option<String>,
}

// =============================================================================
// Rebase Types and Functions
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RebaseStatus {
    pub in_rebase: bool,
    pub conflicting_files: Vec<String>,
    pub onto_ref: Option<String>,
}

/// Check if the repository is in a rebase state and list conflicting files
pub fn get_rebase_status(repo: &Repository) -> Result<RebaseStatus, GitError> {
    let state = repo.state();
    let in_rebase = matches!(
        state,
        RepositoryState::Rebase
            | RepositoryState::RebaseInteractive
            | RepositoryState::RebaseMerge
    );

    let mut conflicting_files = Vec::new();

    if in_rebase {
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

    // Try to get the onto ref from rebase state
    let onto_ref = get_rebase_onto_ref(repo);

    Ok(RebaseStatus {
        in_rebase,
        conflicting_files,
        onto_ref,
    })
}

/// Try to extract the onto ref from rebase state files
fn get_rebase_onto_ref(repo: &Repository) -> Option<String> {
    let git_dir = repo.path();

    // Check rebase-merge directory (for git rebase)
    let rebase_merge_dir = git_dir.join("rebase-merge");
    if rebase_merge_dir.exists() {
        // Try to read onto file
        let onto_path = rebase_merge_dir.join("onto");
        if let Ok(content) = fs::read_to_string(&onto_path) {
            let onto_sha = content.trim();
            // Try to resolve to a branch name
            if let Some(name) = resolve_commit_to_ref_name(repo, onto_sha) {
                return Some(name);
            }
            // Fall back to short SHA
            return Some(onto_sha.chars().take(7).collect());
        }
    }

    // Check rebase-apply directory (for git am / older rebase)
    let rebase_apply_dir = git_dir.join("rebase-apply");
    if rebase_apply_dir.exists() {
        let onto_path = rebase_apply_dir.join("onto");
        if let Ok(content) = fs::read_to_string(&onto_path) {
            let onto_sha = content.trim();
            if let Some(name) = resolve_commit_to_ref_name(repo, onto_sha) {
                return Some(name);
            }
            return Some(onto_sha.chars().take(7).collect());
        }
    }

    None
}

/// Try to resolve a commit SHA to a branch name
fn resolve_commit_to_ref_name(repo: &Repository, sha: &str) -> Option<String> {
    // Try to find a branch that points to this commit
    if let Ok(branches) = repo.branches(None) {
        for branch_result in branches.flatten() {
            let (branch, _) = branch_result;
            if let Some(target) = branch.get().target() {
                let target_str = target.to_string();
                if target_str.starts_with(sha) || sha.starts_with(&target_str[..7.min(target_str.len())]) {
                    if let Ok(Some(name)) = branch.name() {
                        return Some(name.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Start a rebase onto a target ref
pub fn rebase_onto(repo_path: &str, onto_ref: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["rebase", onto_ref])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stderr, stdout);
        
        // Check if it's a conflict (rebase stops with conflicts)
        if combined.contains("CONFLICT") || combined.contains("could not apply") || combined.contains("Resolve all conflicts") {
            Err(git2::Error::from_str("Rebase has conflicts that need to be resolved").into())
        } else {
            Err(git2::Error::from_str(&format!("git rebase failed: {}", combined.trim())).into())
        }
    }
}

/// Continue the rebase after resolving conflicts
pub fn continue_rebase(repo_path: &str) -> Result<String, GitError> {
    // First check if there are still unresolved conflicts
    let repo = super::open_repo(repo_path)?;
    let status = get_rebase_status(&repo)?;

    if !status.conflicting_files.is_empty() {
        return Err(git2::Error::from_str(&format!(
            "Cannot continue rebase: {} file(s) still have conflicts",
            status.conflicting_files.len()
        ))
        .into());
    }

    let output = git_command()
        .args(["rebase", "--continue"])
        .current_dir(repo_path)
        .env("GIT_EDITOR", "true") // Prevent editor from opening
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase --continue: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stderr, stdout);
        
        // Check if more conflicts occurred (next commit in rebase)
        if combined.contains("CONFLICT") || combined.contains("could not apply") {
            Err(git2::Error::from_str("Rebase has more conflicts that need to be resolved").into())
        } else {
            Err(git2::Error::from_str(&format!("git rebase --continue failed: {}", combined.trim())).into())
        }
    }
}

/// Abort the current rebase
pub fn abort_rebase(repo_path: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["rebase", "--abort"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase --abort: {}", e)))?;

    if output.status.success() {
        Ok("Rebase aborted successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(git2::Error::from_str(&format!("git rebase --abort failed: {}", stderr)).into())
    }
}

/// Skip the current commit during rebase
pub fn skip_rebase(repo_path: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["rebase", "--skip"])
        .current_dir(repo_path)
        .env("GIT_EDITOR", "true")
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase --skip: {}", e)))?;

    if output.status.success() {
        Ok("Skipped commit successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stderr, stdout);
        
        if combined.contains("CONFLICT") || combined.contains("could not apply") {
            Err(git2::Error::from_str("Rebase has conflicts that need to be resolved").into())
        } else {
            Err(git2::Error::from_str(&format!("git rebase --skip failed: {}", combined.trim())).into())
        }
    }
}

// =============================================================================
// Interactive Rebase Functions
// =============================================================================

/// Get the list of commits that would be rebased onto a target ref
/// Returns commits in oldest-to-newest order (the order they would be replayed)
pub fn get_interactive_rebase_commits(repo_path: &str, onto_ref: &str) -> Result<Vec<InteractiveRebaseCommit>, GitError> {
    // Get commits that are reachable from HEAD but not from onto_ref
    // This is equivalent to `git log onto_ref..HEAD --reverse`
    // Use record separator (\x1e) between commits and unit separator (\x1f) between fields
    let output = git_command()
        .args([
            "log",
            &format!("{}..HEAD", onto_ref),
            "--reverse",
            "--format=%H%x1f%h%x1f%s%x1f%B%x1f%an%x1f%ae%x1f%at%x1e",
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git log: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(git2::Error::from_str(&format!("git log failed: {}", stderr)).into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    // Split by record separator (each commit entry)
    for entry in stdout.split('\x1e') {
        let entry = entry.trim();
        if entry.is_empty() {
            continue;
        }

        // Split by unit separator to get fields
        let parts: Vec<&str> = entry.split('\x1f').collect();
        if parts.len() < 7 {
            continue;
        }

        let id = parts[0].to_string();
        let short_id = parts[1].to_string();
        let summary = parts[2].to_string();
        let message = parts[3].trim().to_string();
        let author_name = parts[4].to_string();
        let author_email = parts[5].to_string();
        let time = parts[6].trim().parse::<i64>().unwrap_or(0);

        commits.push(InteractiveRebaseCommit {
            id,
            short_id,
            summary,
            message,
            author_name,
            author_email,
            time,
        });
    }

    Ok(commits)
}

/// Start an interactive rebase with a pre-defined plan
/// Uses GIT_SEQUENCE_EDITOR to inject our todo list
pub fn start_interactive_rebase(
    repo_path: &str,
    onto_ref: &str,
    plan: Vec<InteractiveRebasePlanEntry>,
) -> Result<String, GitError> {
    if plan.is_empty() {
        return Err(git2::Error::from_str("Rebase plan cannot be empty").into());
    }

    // Build the todo content
    let mut todo_content = String::new();
    for entry in &plan {
        let short_id = if entry.commit_id.len() > 7 {
            &entry.commit_id[..7]
        } else {
            &entry.commit_id
        };
        todo_content.push_str(&format!(
            "{} {} \n",
            entry.action.to_git_command(),
            short_id
        ));
    }

    // Create a temporary script that will write our todo content
    // The script receives the todo file path as an argument
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join(format!("diffy-rebase-editor-{}.sh", std::process::id()));
    let todo_file_path = temp_dir.join(format!("diffy-rebase-todo-{}.txt", std::process::id()));

    // Write the todo content to a temporary file
    fs::write(&todo_file_path, &todo_content)
        .map_err(|e| git2::Error::from_str(&format!("Failed to write todo file: {}", e)))?;

    // Create a script that copies our todo content to the file git passes
    let script_content = format!(
        "#!/bin/sh\ncat '{}' > \"$1\"\n",
        todo_file_path.display()
    );
    fs::write(&script_path, &script_content)
        .map_err(|e| git2::Error::from_str(&format!("Failed to write editor script: {}", e)))?;

    // Make the script executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| git2::Error::from_str(&format!("Failed to get script permissions: {}", e)))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms)
            .map_err(|e| git2::Error::from_str(&format!("Failed to set script permissions: {}", e)))?;
    }

    // Run git rebase -i with our custom sequence editor
    let output = git_command()
        .args(["rebase", "-i", onto_ref])
        .current_dir(repo_path)
        .env("GIT_SEQUENCE_EDITOR", &script_path)
        .env("GIT_EDITOR", "true") // Prevent editor for commit messages during initial start
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase -i: {}", e)))?;

    // Clean up temporary files
    let _ = fs::remove_file(&script_path);
    let _ = fs::remove_file(&todo_file_path);

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stderr, stdout);

        // Check if it stopped for conflicts or other interactive reasons
        if combined.contains("CONFLICT") || combined.contains("could not apply") {
            Err(git2::Error::from_str("Rebase has conflicts that need to be resolved").into())
        } else if combined.contains("Stopped at") || combined.contains("You can amend") {
            // This is expected for edit/reword - the rebase is in progress
            Ok("Rebase started, stopped for editing".to_string())
        } else {
            Err(git2::Error::from_str(&format!("git rebase -i failed: {}", combined.trim())).into())
        }
    }
}

/// Get detailed interactive rebase state
pub fn get_interactive_rebase_state(repo: &Repository) -> Result<InteractiveRebaseState, GitError> {
    let state = repo.state();
    let in_rebase = matches!(
        state,
        RepositoryState::Rebase
            | RepositoryState::RebaseInteractive
            | RepositoryState::RebaseMerge
    );

    if !in_rebase {
        return Ok(InteractiveRebaseState {
            in_rebase: false,
            is_interactive: false,
            current_step: None,
            total_steps: None,
            stop_reason: RebaseStopReason::None,
            stopped_commit_id: None,
            conflicting_files: Vec::new(),
            onto_ref: None,
            current_message: None,
        });
    }

    let git_dir = repo.path();
    let rebase_merge_dir = git_dir.join("rebase-merge");
    let rebase_apply_dir = git_dir.join("rebase-apply");

    let is_interactive = rebase_merge_dir.exists();
    let rebase_dir = if is_interactive {
        &rebase_merge_dir
    } else {
        &rebase_apply_dir
    };

    // Read progress
    let current_step = fs::read_to_string(rebase_dir.join("msgnum"))
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok());
    let total_steps = fs::read_to_string(rebase_dir.join("end"))
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok());

    // Read onto ref
    let onto_ref = get_rebase_onto_ref(repo);

    // Read stopped commit
    let stopped_commit_id = fs::read_to_string(rebase_dir.join("stopped-sha"))
        .ok()
        .map(|s| s.trim().to_string())
        .or_else(|| {
            fs::read_to_string(rebase_dir.join("current-commit"))
                .ok()
                .map(|s| s.trim().to_string())
        });

    // Read current message (for reword/squash)
    let current_message = fs::read_to_string(rebase_dir.join("message"))
        .ok()
        .map(|s| s.trim().to_string());

    // Check for conflicts
    let mut conflicting_files = Vec::new();
    let mut opts = StatusOptions::new();
    opts.include_untracked(false);
    if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
        for entry in statuses.iter() {
            let status = entry.status();
            if status.is_conflicted() {
                if let Some(path) = entry.path() {
                    conflicting_files.push(path.to_string());
                }
            }
        }
    }

    // Determine stop reason
    let stop_reason = if !conflicting_files.is_empty() {
        RebaseStopReason::Conflict
    } else if is_interactive {
        // Check what action caused the stop by examining the done file
        let done_content = fs::read_to_string(rebase_dir.join("done"))
            .ok()
            .unwrap_or_default();
        let last_action = done_content
            .lines()
            .last()
            .unwrap_or("")
            .split_whitespace()
            .next()
            .unwrap_or("");

        match last_action {
            "edit" | "e" => RebaseStopReason::Edit,
            "reword" | "r" => RebaseStopReason::Reword,
            "squash" | "s" | "fixup" | "f" => {
                // Check if we're waiting for a squash message
                if rebase_dir.join("message-squash").exists() || rebase_dir.join("message-fixup").exists() {
                    RebaseStopReason::SquashMessage
                } else {
                    RebaseStopReason::Other
                }
            }
            _ => {
                // Check if amend file exists (edit mode)
                if rebase_dir.join("amend").exists() {
                    RebaseStopReason::Edit
                } else if current_message.is_some() {
                    RebaseStopReason::Reword
                } else {
                    RebaseStopReason::Other
                }
            }
        }
    } else {
        RebaseStopReason::Other
    };

    Ok(InteractiveRebaseState {
        in_rebase,
        is_interactive,
        current_step,
        total_steps,
        stop_reason,
        stopped_commit_id,
        conflicting_files,
        onto_ref,
        current_message,
    })
}

/// Continue interactive rebase with an optional new commit message
/// Used for reword/squash operations where a message is needed
pub fn continue_interactive_rebase(repo_path: &str, message: Option<String>) -> Result<String, GitError> {
    // First check if there are still unresolved conflicts
    let repo = super::open_repo(repo_path)?;
    let state = get_interactive_rebase_state(&repo)?;

    if !state.conflicting_files.is_empty() {
        return Err(git2::Error::from_str(&format!(
            "Cannot continue rebase: {} file(s) still have conflicts",
            state.conflicting_files.len()
        ))
        .into());
    }

    // If a message is provided, we need to use a custom editor
    let mut cmd = git_command();
    cmd.args(["rebase", "--continue"]).current_dir(repo_path);

    if let Some(msg) = message {
        // Create a temporary script that writes the message
        let temp_dir = std::env::temp_dir();
        let msg_file_path = temp_dir.join(format!("diffy-commit-msg-{}.txt", std::process::id()));
        let script_path = temp_dir.join(format!("diffy-msg-editor-{}.sh", std::process::id()));

        // Write the message to a temp file
        fs::write(&msg_file_path, &msg)
            .map_err(|e| git2::Error::from_str(&format!("Failed to write message file: {}", e)))?;

        // Create editor script that copies our message
        let script_content = format!(
            "#!/bin/sh\ncat '{}' > \"$1\"\n",
            msg_file_path.display()
        );
        fs::write(&script_path, &script_content)
            .map_err(|e| git2::Error::from_str(&format!("Failed to write editor script: {}", e)))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&script_path)
                .map_err(|e| git2::Error::from_str(&format!("Failed to get script permissions: {}", e)))?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&script_path, perms)
                .map_err(|e| git2::Error::from_str(&format!("Failed to set script permissions: {}", e)))?;
        }

        cmd.env("GIT_EDITOR", &script_path);

        let output = cmd.output()
            .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase --continue: {}", e)))?;

        // Clean up
        let _ = fs::remove_file(&script_path);
        let _ = fs::remove_file(&msg_file_path);

        handle_rebase_continue_output(output)
    } else {
        cmd.env("GIT_EDITOR", "true");
        let output = cmd.output()
            .map_err(|e| git2::Error::from_str(&format!("Failed to run git rebase --continue: {}", e)))?;
        handle_rebase_continue_output(output)
    }
}

fn handle_rebase_continue_output(output: std::process::Output) -> Result<String, GitError> {
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stderr, stdout);

        if combined.contains("CONFLICT") || combined.contains("could not apply") {
            Err(git2::Error::from_str("Rebase has more conflicts that need to be resolved").into())
        } else if combined.contains("Stopped at") || combined.contains("You can amend") {
            // Stopped for another edit/reword
            Ok("Rebase continued, stopped for editing".to_string())
        } else {
            Err(git2::Error::from_str(&format!("git rebase --continue failed: {}", combined.trim())).into())
        }
    }
}

// =============================================================================
// Merge Types and Functions
// =============================================================================

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
#[serde(rename_all = "camelCase")]
pub struct MergeStatus {
    pub in_merge: bool,
    pub conflicting_files: Vec<String>,
    pub their_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConflictRegion {
    pub start_line: usize,
    pub end_line: usize,
    pub ours_content: String,
    pub theirs_content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
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
