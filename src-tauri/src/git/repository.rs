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
pub struct RepositoryInfo {
    pub path: String,
    pub name: String,
    pub is_bare: bool,
    pub head_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub commit_id: String,
    pub commit_message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub is_staged: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;

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
        let full_path = workdir.join(path);
        if full_path.exists() {
            // File exists - add it (handles new and modified files)
            index.add_path(Path::new(path))?;
        } else {
            // File doesn't exist - remove it from index (handles deleted files)
            index.remove_path(Path::new(path))?;
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

// Remote operations - using git CLI for better credential handling
use std::process::Command;

pub fn git_fetch(repo_path: &str) -> Result<String, GitError> {
    let output = Command::new("git")
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
    let output = Command::new("git")
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
    let output = Command::new("git")
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
