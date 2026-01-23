use git2::{Diff, DiffFindOptions, DiffOptions, Repository};
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
    // Extended metadata (additive fields for richer diff info)
    /// Whether the file is binary
    #[serde(default)]
    pub is_binary: bool,
    /// Old file mode (e.g., 0o100644 for regular file, 0o120000 for symlink)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub old_mode: Option<u32>,
    /// New file mode
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_mode: Option<u32>,
    /// Similarity score for renames/copies (0-100)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub similarity: Option<u32>,
    /// Whether file is a symlink (derived from mode)
    #[serde(default)]
    pub is_symlink: bool,
    /// Whether file is a submodule
    #[serde(default)]
    pub is_submodule: bool,
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

/// Configure and run rename/copy detection on a diff
fn detect_renames_and_copies(diff: &mut Diff) -> Result<(), GitError> {
    let mut find_opts = DiffFindOptions::new();
    // Enable rename detection
    find_opts.renames(true);
    // Enable copy detection
    find_opts.copies(true);
    // Also detect copies from unmodified files (more thorough)
    find_opts.copies_from_unmodified(true);
    // Set reasonable thresholds (50% similarity for renames, 50% for copies)
    find_opts.rename_threshold(50);
    find_opts.copy_threshold(50);
    // Limit the number of files to compare for performance
    find_opts.rename_limit(1000);
    
    diff.find_similar(Some(&mut find_opts))?;
    Ok(())
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

    let mut diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;
    
    // Run rename/copy detection
    detect_renames_and_copies(&mut diff)?;

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

    let mut diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;
    
    // Run rename/copy detection (in case file was renamed)
    detect_renames_and_copies(&mut diff)?;

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

    let mut diff = if staged {
        // Staged changes: HEAD to index
        let head = repo.head()?.peel_to_tree()?;
        repo.diff_tree_to_index(Some(&head), None, Some(&mut opts))?
    } else {
        // Unstaged changes: index to workdir
        // Include untracked files so newly added files show their content
        opts.include_untracked(true);
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };
    
    // Run rename/copy detection
    detect_renames_and_copies(&mut diff)?;

    diff_to_unified(&diff, Some(repo))
}

/// Generate proper unified diff patch text using Patch::to_buf for each delta
fn generate_patch_text(diff: &Diff, repo: Option<&Repository>) -> Result<String, GitError> {
    let mut patch_text = String::new();

    // Generate patch for each file
    let num_deltas = diff.deltas().len();
    for idx in 0..num_deltas {
        let delta = diff.get_delta(idx);
        
        // Try to get patch from git2
        let mut got_patch = false;
        if let Ok(Some(mut patch)) = git2::Patch::from_diff(diff, idx) {
            // git2 may return a patch with 0 hunks for untracked files
            if patch.num_hunks() > 0 {
                if let Ok(buf) = patch.to_buf() {
                    if !buf.is_empty() {
                        // Use lossy conversion to avoid silently dropping content
                        patch_text.push_str(&String::from_utf8_lossy(&buf));
                        got_patch = true;
                    }
                }
            }
        }
        
        // If git2 didn't give us a patch, generate manually for untracked files
        if !got_patch {
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

    Ok(patch_text)
}

/// Generate a unified diff patch for an untracked file (showing all lines as additions)
fn generate_untracked_file_patch(repo: Option<&Repository>, path: &Path) -> Option<String> {
    let repo = repo?;
    let workdir = repo.workdir()?;
    let full_path = workdir.join(path);
    let path_display = path.display();
    
    // Read file as bytes to handle both text and binary files
    let bytes = std::fs::read(&full_path).ok()?;
    
    // Determine if binary: contains null bytes OR is not valid UTF-8
    let is_binary = bytes.contains(&0u8) || std::str::from_utf8(&bytes).is_err();
    
    if is_binary {
        // Generate a standard binary diff stub
        return Some(format!(
            "diff --git a/{path} b/{path}\n\
             new file mode 100644\n\
             --- /dev/null\n\
             +++ b/{path}\n\
             Binary files /dev/null and b/{path} differ\n",
            path = path_display
        ));
    }
    
    // Safe to convert to string now
    let content = String::from_utf8_lossy(&bytes);
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();
    
    if line_count == 0 {
        // Empty file
        return Some(format!(
            "diff --git a/{path} b/{path}\n\
             new file mode 100644\n\
             --- /dev/null\n\
             +++ b/{path}\n",
            path = path_display
        ));
    }
    
    let mut patch = format!(
        "diff --git a/{path} b/{path}\n\
         new file mode 100644\n\
         --- /dev/null\n\
         +++ b/{path}\n\
         @@ -0,0 +1,{line_count} @@\n",
        path = path_display,
        line_count = line_count
    );
    
    for line in lines {
        patch.push('+');
        patch.push_str(line);
        patch.push('\n');
    }
    
    Some(patch)
}

/// Check if a file mode indicates a symlink (mode 0o120000)
fn is_symlink_mode(mode: u32) -> bool {
    // Symlink mode is 0o120000 (S_IFLNK)
    (mode & 0o170000) == 0o120000
}

/// Check if a file mode indicates a submodule (mode 0o160000)
fn is_submodule_mode(mode: u32) -> bool {
    // Submodule mode is 0o160000 (S_IFGITLINK)
    (mode & 0o170000) == 0o160000
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

        // For renames and copies, also populate old_path
        let old_path = if matches!(delta.status(), git2::Delta::Renamed | git2::Delta::Copied) {
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

        // Extract extended metadata
        let old_file = delta.old_file();
        let new_file = delta.new_file();
        
        // Binary detection: check flags on both old and new files
        let is_binary = old_file.is_binary() || new_file.is_binary();
        
        // File modes - convert FileMode to u32 (only include if non-zero/meaningful)
        let old_mode_raw: u32 = old_file.mode().into();
        let new_mode_raw: u32 = new_file.mode().into();
        let old_mode = if old_mode_raw != 0 { Some(old_mode_raw) } else { None };
        let new_mode = if new_mode_raw != 0 { Some(new_mode_raw) } else { None };
        
        // Similarity score for renames/copies (git2 provides this on the delta flags)
        let similarity = if matches!(delta.status(), git2::Delta::Renamed | git2::Delta::Copied) {
            // git2's similarity is stored as u16 percentage (0-100)
            // For renamed/copied files, we can approximate by checking if old_file.id() and new_file.id() are same/different
            // The actual similarity % isn't directly exposed in git2's safe API.
            // We'll mark it as Some(100) if IDs match exactly, or estimate based on stats
            if old_file.id() == new_file.id() {
                Some(100u32)
            } else {
                // Could calculate based on line stats if needed
                Some(50u32) // Default to threshold we used for detection
            }
        } else {
            None
        };
        
        // Symlink detection (based on mode)
        let is_symlink = is_symlink_mode(old_mode_raw) || is_symlink_mode(new_mode_raw);
        
        // Submodule detection (based on mode)
        let is_submodule = is_submodule_mode(old_mode_raw) || is_submodule_mode(new_mode_raw);

        files.push(DiffFile {
            path,
            old_path,
            status,
            additions,
            deletions,
            is_binary,
            old_mode,
            new_mode,
            similarity,
            is_symlink,
            is_submodule,
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
    
    // Read as bytes to handle both text and binary files
    let bytes = match std::fs::read(&full_path) {
        Ok(b) => b,
        Err(_) => return (0, 0),
    };
    
    // Binary files (contain null bytes or invalid UTF-8) don't count as additions
    if bytes.contains(&0u8) {
        return (0, 0);
    }
    
    match std::str::from_utf8(&bytes) {
        Ok(content) => {
            let line_count = content.lines().count();
            (line_count, 0) // All additions, no deletions
        }
        Err(_) => (0, 0), // Not valid UTF-8, treat as binary
    }
}
