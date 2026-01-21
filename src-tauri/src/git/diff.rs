use git2::{Diff, DiffOptions, Repository};
use serde::{Deserialize, Serialize};

use super::GitError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedDiff {
    pub files: Vec<DiffFile>,
    pub patch: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDiff {
    pub path: String,
    pub patch: String,
}

/// Get diff for a specific commit compared to its parent
pub fn get_commit_diff(repo: &Repository, commit_id: &str) -> Result<UnifiedDiff, GitError> {
    let oid = git2::Oid::from_str(commit_id)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;

    diff_to_unified(&diff)
}

/// Get diff for a specific file in a commit
pub fn get_file_diff(
    repo: &Repository,
    commit_id: &str,
    file_path: &str,
) -> Result<FileDiff, GitError> {
    let oid = git2::Oid::from_str(commit_id)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let mut opts = DiffOptions::new();
    opts.context_lines(3);
    opts.pathspec(file_path);

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;

    let patch_text = generate_patch_text(&diff)?;

    Ok(FileDiff {
        path: file_path.to_string(),
        patch: patch_text,
    })
}

/// Get diff for working directory changes (staged and unstaged)
pub fn get_working_diff(repo: &Repository, staged: bool) -> Result<UnifiedDiff, GitError> {
    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = if staged {
        // Staged changes: HEAD to index
        let head = repo.head()?.peel_to_tree()?;
        repo.diff_tree_to_index(Some(&head), None, Some(&mut opts))?
    } else {
        // Unstaged changes: index to workdir
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };

    diff_to_unified(&diff)
}

/// Generate proper unified diff patch text using Patch::to_buf for each delta
fn generate_patch_text(diff: &Diff) -> Result<String, GitError> {
    let mut patch_text = String::new();

    // Generate patch for each file
    let num_deltas = diff.deltas().len();
    for idx in 0..num_deltas {
        if let Ok(Some(mut patch)) = git2::Patch::from_diff(diff, idx) {
            if let Ok(buf) = patch.to_buf() {
                patch_text.push_str(std::str::from_utf8(&buf).unwrap_or(""));
            }
        }
    }

    Ok(patch_text)
}

fn diff_to_unified(diff: &Diff) -> Result<UnifiedDiff, GitError> {
    let mut files = Vec::new();

    let num_deltas = diff.deltas().len();
    for idx in 0..num_deltas {
        let delta = diff.get_delta(idx).unwrap();

        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let old_path = if delta.status() == git2::Delta::Renamed {
            delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        let status = match delta.status() {
            git2::Delta::Added => "A",
            git2::Delta::Deleted => "D",
            git2::Delta::Modified => "M",
            git2::Delta::Renamed => "R",
            git2::Delta::Copied => "C",
            git2::Delta::Typechange => "T",
            _ => "?",
        }
        .to_string();

        // Get stats for this file from patch
        let (additions, deletions) = if let Ok(Some(patch)) = git2::Patch::from_diff(diff, idx) {
            let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
            (adds, dels)
        } else {
            (0, 0)
        };

        files.push(DiffFile {
            path,
            old_path,
            status,
            additions,
            deletions,
        });
    }

    let patch_text = generate_patch_text(diff)?;

    Ok(UnifiedDiff {
        files,
        patch: patch_text,
    })
}
