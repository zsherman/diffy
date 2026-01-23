use git2::{Branch, BranchType, Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    #[error("Repository not found at path: {0}")]
    NotFound(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

impl serde::Serialize for GitError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInfo {
    pub path: String,
    pub name: String,
    pub is_bare: bool,
    pub head_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub commit_id: String,
    pub commit_message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub time: i64,
    pub parent_ids: Vec<String>,
    pub files_changed: usize,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub is_staged: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatusInfo {
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
}

pub fn open_repo<P: AsRef<Path>>(path: P) -> Result<Repository, GitError> {
    Repository::open(path.as_ref()).map_err(|e| {
        if e.code() == git2::ErrorCode::NotFound {
            GitError::NotFound(path.as_ref().display().to_string())
        } else {
            GitError::Git(e)
        }
    })
}

pub fn discover_repo<P: AsRef<Path>>(start_path: P) -> Result<Repository, GitError> {
    Repository::discover(start_path.as_ref()).map_err(|e| {
        if e.code() == git2::ErrorCode::NotFound {
            GitError::NotFound(start_path.as_ref().display().to_string())
        } else {
            GitError::Git(e)
        }
    })
}

pub fn get_repository_info(repo: &Repository) -> Result<RepositoryInfo, GitError> {
    let path = repo
        .workdir()
        .unwrap_or_else(|| repo.path())
        .to_string_lossy()
        .to_string();

    let name = repo
        .workdir()
        .unwrap_or_else(|| repo.path())
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let head_branch = repo.head().ok().and_then(|head| {
        if head.is_branch() {
            head.shorthand().map(|s| s.to_string())
        } else {
            None
        }
    });

    Ok(RepositoryInfo {
        path,
        name,
        is_bare: repo.is_bare(),
        head_branch,
    })
}

pub fn list_all_branches(repo: &Repository) -> Result<Vec<BranchInfo>, GitError> {
    let mut branches = Vec::new();
    let head = repo.head().ok();
    let head_name = head.as_ref().and_then(|h| h.shorthand().map(String::from));

    // Local branches
    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch_result?;
        if let Some(info) = branch_to_info(&branch, false, &head_name)? {
            branches.push(info);
        }
    }

    // Remote branches
    for branch_result in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = branch_result?;
        if let Some(info) = branch_to_info(&branch, true, &head_name)? {
            branches.push(info);
        }
    }

    Ok(branches)
}

fn branch_to_info(
    branch: &Branch,
    is_remote: bool,
    head_name: &Option<String>,
) -> Result<Option<BranchInfo>, GitError> {
    let name = match branch.name()? {
        Some(n) => n.to_string(),
        None => return Ok(None),
    };

    let commit = branch.get().peel_to_commit()?;
    let is_head = head_name.as_ref().map(|h| h == &name).unwrap_or(false);

    let upstream = if !is_remote {
        branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(String::from))
    } else {
        None
    };

    Ok(Some(BranchInfo {
        name,
        is_head,
        is_remote,
        upstream,
        commit_id: commit.id().to_string(),
        commit_message: commit.summary().unwrap_or("").to_string(),
    }))
}

pub fn get_commits(
    repo: &Repository,
    branch_name: Option<&str>,
    limit: usize,
    offset: usize,
) -> Result<Vec<CommitInfo>, GitError> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)?;

    // Start from specified branch or HEAD
    if let Some(branch) = branch_name {
        let reference = repo.find_reference(&format!("refs/heads/{}", branch))?;
        revwalk.push(reference.target().unwrap())?;
    } else {
        revwalk.push_head()?;
    }

    let commits: Vec<CommitInfo> = revwalk
        .skip(offset)
        .take(limit)
        .filter_map(|oid_result| {
            let oid = oid_result.ok()?;
            let commit = repo.find_commit(oid).ok()?;
            Some(commit_to_info(repo, &commit))
        })
        .collect();

    Ok(commits)
}

/// Get commits from all local branches for graph visualization
pub fn get_commits_all_branches(
    repo: &Repository,
    limit: usize,
    offset: usize,
) -> Result<Vec<CommitInfo>, GitError> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)?;

    // Push all local branch tips
    let branches = repo.branches(Some(BranchType::Local))?;
    for branch_result in branches {
        let (branch, _) = branch_result?;
        if let Some(target) = branch.get().target() {
            let _ = revwalk.push(target);
        }
    }

    let commits: Vec<CommitInfo> = revwalk
        .skip(offset)
        .take(limit)
        .filter_map(|oid_result| {
            let oid = oid_result.ok()?;
            let commit = repo.find_commit(oid).ok()?;
            Some(commit_to_info(repo, &commit))
        })
        .collect();

    Ok(commits)
}

fn commit_to_info(repo: &Repository, commit: &git2::Commit) -> CommitInfo {
    let id = commit.id().to_string();
    let short_id = id[..7.min(id.len())].to_string();

    // Calculate diff stats
    let (files_changed, additions, deletions) = get_commit_stats(repo, commit).unwrap_or((0, 0, 0));

    CommitInfo {
        id,
        short_id,
        message: commit.message().unwrap_or("").to_string(),
        summary: commit.summary().unwrap_or("").to_string(),
        author_name: commit.author().name().unwrap_or("Unknown").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        time: commit.time().seconds(),
        parent_ids: commit.parent_ids().map(|id| id.to_string()).collect(),
        files_changed,
        additions,
        deletions,
    }
}

fn get_commit_stats(repo: &Repository, commit: &git2::Commit) -> Result<(usize, usize, usize), git2::Error> {
    let tree = commit.tree()?;

    // Get parent tree (or empty tree for initial commit)
    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;
    let stats = diff.stats()?;

    Ok((
        stats.files_changed(),
        stats.insertions(),
        stats.deletions(),
    ))
}

pub fn get_status(repo: &Repository) -> Result<StatusInfo, GitError> {
    use std::time::Instant;
    let start = Instant::now();
    
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    // Don't recurse into untracked directories - this is MUCH faster
    // Untracked folders will show as a single entry (like git status does)
    opts.recurse_untracked_dirs(false);
    // Skip ignored files entirely for better performance
    opts.include_ignored(false);
    // Don't refresh the index from disk - use cached state (faster)
    opts.update_index(false);

    let statuses = repo.statuses(Some(&mut opts))?;
    tracing::info!("git status took {:?} for {} entries", start.elapsed(), statuses.len());

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_index_renamed()
            || status.is_index_typechange()
        {
            staged.push(FileStatus {
                path: path.clone(),
                status: index_status_string(status),
                is_staged: true,
            });
        }

        if status.is_wt_new() {
            untracked.push(FileStatus {
                path: path.clone(),
                status: "?".to_string(),
                is_staged: false,
            });
        } else if status.is_wt_modified()
            || status.is_wt_deleted()
            || status.is_wt_renamed()
            || status.is_wt_typechange()
        {
            unstaged.push(FileStatus {
                path: path.clone(),
                status: wt_status_string(status),
                is_staged: false,
            });
        }
    }

    Ok(StatusInfo {
        staged,
        unstaged,
        untracked,
    })
}

fn index_status_string(status: git2::Status) -> String {
    if status.is_index_new() {
        "A".to_string()
    } else if status.is_index_modified() {
        "M".to_string()
    } else if status.is_index_deleted() {
        "D".to_string()
    } else if status.is_index_renamed() {
        "R".to_string()
    } else {
        "T".to_string()
    }
}

fn wt_status_string(status: git2::Status) -> String {
    if status.is_wt_modified() {
        "M".to_string()
    } else if status.is_wt_deleted() {
        "D".to_string()
    } else if status.is_wt_renamed() {
        "R".to_string()
    } else {
        "T".to_string()
    }
}

pub fn stage_files(repo: &Repository, paths: &[String]) -> Result<(), GitError> {
    let mut index = repo.index()?;
    let workdir = repo.workdir().ok_or_else(|| {
        git2::Error::from_str("Repository has no working directory")
    })?;

    for path in paths {
        // Handle directory paths (may have trailing slash from recurse_untracked_dirs=false)
        let clean_path = path.trim_end_matches('/');
        let full_path = workdir.join(clean_path);

        if full_path.is_dir() {
            // For directories, use add_all with a glob pattern to add all files recursively
            let pattern = format!("{}/*", clean_path);
            index.add_all([&pattern], git2::IndexAddOption::DEFAULT, None)?;
        } else if full_path.exists() {
            // File exists - add it (handles new and modified files)
            index.add_path(Path::new(clean_path))?;
        } else {
            // File doesn't exist - remove it from index (handles deleted files)
            index.remove_path(Path::new(clean_path))?;
        }
    }
    index.write()?;
    Ok(())
}

pub fn unstage_files(repo: &Repository, paths: &[String]) -> Result<(), GitError> {
    let head = repo.head()?.peel_to_commit()?;
    repo.reset_default(Some(head.as_object()), paths.iter().map(Path::new))?;
    Ok(())
}

pub fn discard_changes(repo: &Repository, paths: &[String]) -> Result<(), GitError> {
    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.force();
    for path in paths {
        checkout_opts.path(path);
    }
    repo.checkout_head(Some(&mut checkout_opts))?;
    Ok(())
}

pub fn create_commit(repo: &Repository, message: &str) -> Result<String, GitError> {
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let signature = repo.signature()?;
    let parent = repo.head()?.peel_to_commit()?;

    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &[&parent],
    )?;

    Ok(commit_id.to_string())
}

pub fn checkout_branch(repo: &Repository, branch_name: &str) -> Result<(), GitError> {
    let (object, reference) = repo.revparse_ext(branch_name)?;

    repo.checkout_tree(&object, None)?;

    match reference {
        Some(gref) => repo.set_head(gref.name().unwrap())?,
        None => repo.set_head_detached(object.id())?,
    }

    Ok(())
}

pub fn create_branch(repo: &Repository, branch_name: &str, checkout: bool) -> Result<(), GitError> {
    // Get the current HEAD commit
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;

    // Create the new branch pointing to HEAD
    repo.branch(branch_name, &commit, false)?;

    // Optionally checkout the new branch
    if checkout {
        checkout_branch(repo, branch_name)?;
    }

    Ok(())
}

// Remote operations - using git CLI for better credential handling
use std::process::Command;

/// Get the user's PATH from their login shell (for packaged app compatibility)
fn get_user_path() -> String {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // Run the user's shell in login mode to get their full PATH
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

    // Fallback to common paths
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
    // Ensure git can find SSH keys and config
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", &home);
        cmd.env("SSH_AUTH_SOCK", std::env::var("SSH_AUTH_SOCK").unwrap_or_default());
    }
    cmd
}

pub fn git_fetch(repo_path: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["fetch", "--all", "--prune"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git fetch: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(git2::Error::from_str(&format!("git fetch failed: {}", stderr)).into())
    }
}

pub fn git_pull(repo_path: &str) -> Result<String, GitError> {
    let output = git_command()
        .args(["pull"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git pull: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(git2::Error::from_str(&format!("git pull failed: {}", stderr)).into())
    }
}

pub fn git_push(repo_path: &str) -> Result<String, GitError> {
    // Use -u origin HEAD to automatically set upstream for new branches
    let output = git_command()
        .args(["push", "-u", "origin", "HEAD"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git push: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        // git push outputs to stderr even on success
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(git2::Error::from_str(&format!("git push failed: {}", stderr)).into())
    }
}

// Worktree types and functions
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub name: String,
    pub path: String,
    pub head_branch: Option<String>,
    pub head_commit: Option<String>,
    pub is_main: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
    pub is_prunable: bool,
    pub is_dirty: bool,
}

pub fn list_worktrees(repo: &Repository) -> Result<Vec<WorktreeInfo>, GitError> {
    let mut worktrees = Vec::new();

    // Get the main worktree info first
    let main_workdir = repo.workdir().map(|p| p.to_string_lossy().to_string());

    if let Some(workdir) = &main_workdir {
        let head_info = get_worktree_head_info(repo);
        let is_dirty = check_worktree_dirty(repo);

        worktrees.push(WorktreeInfo {
            name: "main".to_string(),
            path: workdir.clone(),
            head_branch: head_info.0,
            head_commit: head_info.1,
            is_main: true,
            is_locked: false,
            lock_reason: None,
            is_prunable: false,
            is_dirty,
        });
    }

    // Get linked worktrees
    let worktree_names = repo.worktrees()?;
    for name in worktree_names.iter() {
        if let Some(name) = name {
            if let Ok(worktree) = repo.find_worktree(name) {
                let wt_path = worktree.path().to_string_lossy().to_string();

                // Try to get head info for this worktree
                let (head_branch, head_commit, is_dirty) = if let Ok(wt_repo) = Repository::open(&wt_path) {
                    let head_info = get_worktree_head_info(&wt_repo);
                    let dirty = check_worktree_dirty(&wt_repo);
                    (head_info.0, head_info.1, dirty)
                } else {
                    (None, None, false)
                };

                // Check lock status using git2's is_locked() which returns Result<WorktreeLockStatus>
                let (is_locked, lock_reason) = match worktree.is_locked() {
                    Ok(git2::WorktreeLockStatus::Locked(reason)) => {
                        (true, reason)
                    }
                    Ok(git2::WorktreeLockStatus::Unlocked) => (false, None),
                    Err(_) => (false, None),
                };

                worktrees.push(WorktreeInfo {
                    name: name.to_string(),
                    path: wt_path,
                    head_branch,
                    head_commit,
                    is_main: false,
                    is_locked,
                    lock_reason,
                    is_prunable: worktree.validate().is_err(),
                    is_dirty,
                });
            }
        }
    }

    Ok(worktrees)
}

fn get_worktree_head_info(repo: &Repository) -> (Option<String>, Option<String>) {
    let head = repo.head().ok();
    let branch = head.as_ref().and_then(|h| {
        if h.is_branch() {
            h.shorthand().map(|s| s.to_string())
        } else {
            None
        }
    });
    let commit = head.and_then(|h| h.peel_to_commit().ok()).map(|c| c.id().to_string()[..7].to_string());
    (branch, commit)
}

fn check_worktree_dirty(repo: &Repository) -> bool {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
        !statuses.is_empty()
    } else {
        false
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeCreateOptions {
    pub name: String,
    pub path: String,
    pub branch: Option<String>,
    pub new_branch: Option<String>,
}

pub fn create_worktree(repo_path: &str, options: WorktreeCreateOptions) -> Result<WorktreeInfo, GitError> {
    let mut args = vec!["worktree", "add"];

    // If creating a new branch
    if let Some(ref new_branch) = options.new_branch {
        args.push("-b");
        args.push(new_branch);
    }

    args.push(&options.path);

    // If using existing branch
    if let Some(ref branch) = options.branch {
        args.push(branch);
    }

    let output = git_command()
        .args(&args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git worktree add: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(git2::Error::from_str(&format!("git worktree add failed: {}", stderr)).into());
    }

    // Open the new worktree to get its info
    let wt_repo = Repository::open(&options.path)
        .map_err(|e| git2::Error::from_str(&format!("Failed to open new worktree: {}", e)))?;

    let head_info = get_worktree_head_info(&wt_repo);
    let is_dirty = check_worktree_dirty(&wt_repo);

    Ok(WorktreeInfo {
        name: options.name,
        path: options.path,
        head_branch: head_info.0,
        head_commit: head_info.1,
        is_main: false,
        is_locked: false,
        lock_reason: None,
        is_prunable: false,
        is_dirty,
    })
}

pub fn remove_worktree(repo_path: &str, worktree_name: &str, force: bool) -> Result<(), GitError> {
    let mut args = vec!["worktree", "remove"];

    if force {
        args.push("--force");
    }

    args.push(worktree_name);

    let output = git_command()
        .args(&args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git worktree remove: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(git2::Error::from_str(&format!("git worktree remove failed: {}", stderr)).into());
    }

    Ok(())
}

pub fn lock_worktree(repo_path: &str, worktree_name: &str, reason: Option<&str>) -> Result<(), GitError> {
    let mut args = vec!["worktree", "lock"];

    if let Some(reason) = reason {
        args.push("--reason");
        args.push(reason);
    }

    args.push(worktree_name);

    let output = git_command()
        .args(&args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git worktree lock: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(git2::Error::from_str(&format!("git worktree lock failed: {}", stderr)).into());
    }

    Ok(())
}

pub fn unlock_worktree(repo_path: &str, worktree_name: &str) -> Result<(), GitError> {
    let output = git_command()
        .args(["worktree", "unlock", worktree_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| git2::Error::from_str(&format!("Failed to run git worktree unlock: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(git2::Error::from_str(&format!("git worktree unlock failed: {}", stderr)).into());
    }

    Ok(())
}

// Stash types and functions
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    pub stash_index: usize,
    pub message: String,
    pub oid: String,
    pub time: i64,
}

/// List all stashes in the repository
pub fn list_stashes(repo: &mut Repository) -> Result<Vec<StashEntry>, GitError> {
    // First pass: collect basic stash info (stash_foreach needs mutable borrow)
    let mut stash_info: Vec<(usize, String, git2::Oid)> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stash_info.push((index, message.to_string(), *oid));
        true // continue iteration
    })?;

    // Second pass: look up commit times (immutable borrow)
    let stashes = stash_info
        .into_iter()
        .map(|(index, message, oid)| {
            let time = repo.find_commit(oid)
                .map(|c| c.time().seconds())
                .unwrap_or(0);

            StashEntry {
                stash_index: index,
                message,
                oid: oid.to_string(),
                time,
            }
        })
        .collect();

    Ok(stashes)
}

/// Create a new stash with an optional message
/// If no message is provided, generates one like git: "WIP on branch: shortid message"
pub fn create_stash(repo: &mut Repository, message: Option<&str>) -> Result<(), GitError> {
    let signature = repo.signature()?;

    // Generate default message if none provided (like git does)
    let stash_message = if let Some(msg) = message {
        if msg.trim().is_empty() {
            generate_stash_message(repo)?
        } else {
            msg.to_string()
        }
    } else {
        generate_stash_message(repo)?
    };

    repo.stash_save(&signature, &stash_message, None)?;
    Ok(())
}

/// Generate a stash message like git: "WIP on branch: shortid commit message"
fn generate_stash_message(repo: &Repository) -> Result<String, GitError> {
    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("HEAD");
    let commit = head.peel_to_commit()?;
    let short_id = &commit.id().to_string()[..7];
    let summary = commit.summary().unwrap_or("");

    Ok(format!("WIP on {}: {} {}", branch_name, short_id, summary))
}

/// Apply a stash by index without removing it
pub fn apply_stash(repo: &mut Repository, stash_index: usize) -> Result<(), GitError> {
    repo.stash_apply(stash_index, None)?;
    Ok(())
}

/// Pop a stash by index (apply and remove)
pub fn pop_stash(repo: &mut Repository, stash_index: usize) -> Result<(), GitError> {
    repo.stash_pop(stash_index, None)?;
    Ok(())
}

/// Drop a stash by index without applying
pub fn drop_stash(repo: &mut Repository, stash_index: usize) -> Result<(), GitError> {
    repo.stash_drop(stash_index)?;
    Ok(())
}

// Ahead/behind tracking
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AheadBehind {
    pub ahead: usize,
    pub behind: usize,
}

// Commit activity for contribution calendar (minimal data for performance)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitActivity {
    pub time: i64,
    pub author_name: String,
    pub author_email: String,
}

/// Get the number of commits ahead and behind the upstream branch
pub fn get_ahead_behind(repo: &Repository) -> Result<Option<AheadBehind>, GitError> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(None), // No HEAD (empty repo)
    };

    if !head.is_branch() {
        return Ok(None); // Detached HEAD
    }

    let branch_name = match head.shorthand() {
        Some(name) => name,
        None => return Ok(None),
    };

    let local_branch = repo.find_branch(branch_name, git2::BranchType::Local)?;

    let upstream = match local_branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok(None), // No upstream configured
    };

    let local_oid = head.target().ok_or_else(|| {
        git2::Error::from_str("Local branch has no target")
    })?;

    let upstream_oid = upstream.get().target().ok_or_else(|| {
        git2::Error::from_str("Upstream branch has no target")
    })?;

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;

    Ok(Some(AheadBehind { ahead, behind }))
}

/// Get commit activity from all local branches within a time range.
/// Returns minimal data (time + author) for contribution calendar visualization.
/// Uses TIME sorting for efficient early-stop when commits are older than `since`.
pub fn get_commit_activity_all_branches(
    repo: &Repository,
    since: i64,
    until: i64,
) -> Result<Vec<CommitActivity>, GitError> {
    let mut revwalk = repo.revwalk()?;
    // Use TIME sorting only (not TOPOLOGICAL) so we can early-stop
    revwalk.set_sorting(git2::Sort::TIME)?;

    // Push all local branch tips
    let branches = repo.branches(Some(BranchType::Local))?;
    let mut pushed_any = false;
    for branch_result in branches {
        let (branch, _) = branch_result?;
        if let Some(target) = branch.get().target() {
            let _ = revwalk.push(target);
            pushed_any = true;
        }
    }

    // Fall back to HEAD if no branch tips were found
    if !pushed_any {
        let _ = revwalk.push_head();
    }

    let mut activity = Vec::new();

    for oid_result in revwalk {
        let oid = match oid_result {
            Ok(o) => o,
            Err(_) => continue,
        };

        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let time = commit.time().seconds();

        // Early-stop: commits are time-sorted, so if we're past the range, we're done
        if time < since {
            break;
        }

        // Skip commits after the range
        if time > until {
            continue;
        }

        activity.push(CommitActivity {
            time,
            author_name: commit.author().name().unwrap_or("Unknown").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
        });
    }

    Ok(activity)
}
