use git2::{Diff, DiffOptions, Repository};
use serde::{Deserialize, Serialize};
use std::path::Path;

use super::GitError;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedDiff {
    pub files: Vec<DiffFile>,
    pub patch: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
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

    diff_to_unified(&diff, Some(repo))
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

    let patch_text = generate_patch_text(&diff, Some(repo))?;

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
        // Include untracked files so newly added files show their content
        opts.include_untracked(true);
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };

    diff_to_unified(&diff, Some(repo))
}

/// Generate proper unified diff patch text using Patch::to_buf for each delta
fn generate_patch_text(diff: &Diff, repo: Option<&Repository>) -> Result<String, GitError> {
    let mut patch_text = String::new();

    // Generate patch for each file
    let num_deltas = diff.deltas().len();
    for idx in 0..num_deltas {
        let delta = diff.get_delta(idx);
        
        match git2::Patch::from_diff(diff, idx) {
            Ok(Some(mut patch)) => {
                if let Ok(buf) = patch.to_buf() {
                    patch_text.push_str(std::str::from_utf8(&buf).unwrap_or(""));
                }
            }
            Ok(None) | Err(_) => {
                // Patch::from_diff returns None for untracked files
                // Generate a manual "all additions" diff
                if let Some(delta) = delta {
                    if delta.status() == git2::Delta::Untracked {
                        if let Some(path) = delta.new_file().path() {
                            if let Some(manual_patch) = generate_untracked_file_patch(repo, path) {
                                patch_text.push_str(&manual_patch);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(patch_text)
}

/// Generate a unified diff patch for an untracked file (showing all lines as additions)
fn generate_untracked_file_patch(repo: Option<&Repository>, path: &Path) -> Option<String> {
    let repo = repo?;
    let workdir = repo.workdir()?;
    let full_path = workdir.join(path);
    
    // Read file content
    let content = std::fs::read_to_string(&full_path).ok()?;
    
    // Check if it's a binary file (contains null bytes)
    if content.contains('\0') {
        return Some(format!(
            "diff --git a/{path} b/{path}\n\
             new file mode 100644\n\
             --- /dev/null\n\
             +++ b/{path}\n\
             Binary file differs\n",
            path = path.display()
        ));
    }
    
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();
    
    if line_count == 0 {
        // Empty file
        return Some(format!(
            "diff --git a/{path} b/{path}\n\
             new file mode 100644\n\
             --- /dev/null\n\
             +++ b/{path}\n",
            path = path.display()
        ));
    }
    
    let mut patch = format!(
        "diff --git a/{path} b/{path}\n\
         new file mode 100644\n\
         --- /dev/null\n\
         +++ b/{path}\n\
         @@ -0,0 +1,{line_count} @@\n",
        path = path.display(),
        line_count = line_count
    );
    
    for line in lines {
        patch.push('+');
        patch.push_str(line);
        patch.push('\n');
    }
    
    Some(patch)
}

fn diff_to_unified(diff: &Diff, repo: Option<&Repository>) -> Result<UnifiedDiff, GitError> {
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
            git2::Delta::Untracked => "?",
            _ => "?",
        }
        .to_string();

        // Get stats for this file from patch
        let (additions, deletions) = if let Ok(Some(patch)) = git2::Patch::from_diff(diff, idx) {
            let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
            (adds, dels)
        } else if delta.status() == git2::Delta::Untracked {
            // For untracked files, count lines manually
            if let Some(file_path) = delta.new_file().path() {
                count_file_lines(repo, file_path)
            } else {
                (0, 0)
            }
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

    let patch_text = generate_patch_text(diff, repo)?;

    Ok(UnifiedDiff {
        files,
        patch: patch_text,
    })
}

/// Count lines in an untracked file for stats
fn count_file_lines(repo: Option<&Repository>, path: &Path) -> (usize, usize) {
    let repo = match repo {
        Some(r) => r,
        None => return (0, 0),
    };
    
    let workdir = match repo.workdir() {
        Some(w) => w,
        None => return (0, 0),
    };
    
    let full_path = workdir.join(path);
    
    match std::fs::read_to_string(&full_path) {
        Ok(content) => {
            // Binary files don't count as additions
            if content.contains('\0') {
                (0, 0)
            } else {
                let line_count = content.lines().count();
                (line_count, 0) // All additions, no deletions
            }
        }
        Err(_) => (0, 0),
    }
}
