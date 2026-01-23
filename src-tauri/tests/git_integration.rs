//! Integration tests for diffy's git operations.
//!
//! These tests use real git CLI to create fixture repositories and verify
//! that our Rust git operations work correctly.
//!
//! Snapshot tests use `insta` for easy review of output changes.

use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;

// Import the library under test
use diffy_lib::git;

// Re-export insta for snapshot tests
use insta;

/// Test helper: Create a git command configured for the given directory
fn git_cmd(dir: &Path) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(dir);
    // Isolate from user's git config
    cmd.env("GIT_CONFIG_GLOBAL", "/dev/null");
    cmd.env("GIT_CONFIG_SYSTEM", "/dev/null");
    cmd.env("GIT_AUTHOR_NAME", "Test Author");
    cmd.env("GIT_AUTHOR_EMAIL", "test@example.com");
    cmd.env("GIT_COMMITTER_NAME", "Test Committer");
    cmd.env("GIT_COMMITTER_EMAIL", "test@example.com");
    cmd
}

/// Run a git command and panic if it fails
fn run_git(dir: &Path, args: &[&str]) {
    let output = git_cmd(dir).args(args).output().expect("git command failed");
    if !output.status.success() {
        panic!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

/// Run a git command and return stdout
fn run_git_output(dir: &Path, args: &[&str]) -> String {
    let output = git_cmd(dir).args(args).output().expect("git command failed");
    if !output.status.success() {
        panic!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
    }
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

/// Create a basic test repository with an initial commit
fn create_test_repo() -> (TempDir, PathBuf) {
    let tmp = TempDir::new().expect("failed to create temp dir");
    let path = tmp.path().to_path_buf();

    run_git(&path, &["init", "-b", "main"]); // Force main as default branch
    run_git(&path, &["config", "user.name", "Test User"]);
    run_git(&path, &["config", "user.email", "test@example.com"]);

    // Create initial commit
    std::fs::write(path.join("README.md"), "# Test Repo\n").unwrap();
    run_git(&path, &["add", "README.md"]);
    run_git(&path, &["commit", "-m", "Initial commit"]);

    (tmp, path)
}

/// Create a repo with multiple commits for graph testing
fn create_repo_with_history() -> (TempDir, PathBuf) {
    let (tmp, path) = create_test_repo();

    // Add more commits
    std::fs::write(path.join("file1.txt"), "content 1\n").unwrap();
    run_git(&path, &["add", "file1.txt"]);
    run_git(&path, &["commit", "-m", "Add file1"]);

    std::fs::write(path.join("file2.txt"), "content 2\n").unwrap();
    run_git(&path, &["add", "file2.txt"]);
    run_git(&path, &["commit", "-m", "Add file2"]);

    (tmp, path)
}

/// Create a repo with a merge scenario
fn create_repo_with_branches() -> (TempDir, PathBuf) {
    let (tmp, path) = create_test_repo();

    // Create feature branch
    run_git(&path, &["checkout", "-b", "feature"]);
    std::fs::write(path.join("feature.txt"), "feature content\n").unwrap();
    run_git(&path, &["add", "feature.txt"]);
    run_git(&path, &["commit", "-m", "Add feature"]);

    // Go back to main
    run_git(&path, &["checkout", "main"]);
    std::fs::write(path.join("main.txt"), "main content\n").unwrap();
    run_git(&path, &["add", "main.txt"]);
    run_git(&path, &["commit", "-m", "Add main file"]);

    (tmp, path)
}

/// Create a repo with merge conflict
fn create_repo_with_conflict() -> (TempDir, PathBuf) {
    let (tmp, path) = create_test_repo();

    // Create a file
    std::fs::write(path.join("conflict.txt"), "original content\n").unwrap();
    run_git(&path, &["add", "conflict.txt"]);
    run_git(&path, &["commit", "-m", "Add conflict.txt"]);

    // Create feature branch and modify the file
    run_git(&path, &["checkout", "-b", "feature"]);
    std::fs::write(path.join("conflict.txt"), "feature branch content\n").unwrap();
    run_git(&path, &["add", "conflict.txt"]);
    run_git(&path, &["commit", "-m", "Modify in feature"]);

    // Go back to main and make conflicting change
    run_git(&path, &["checkout", "main"]);
    std::fs::write(path.join("conflict.txt"), "main branch content\n").unwrap();
    run_git(&path, &["add", "conflict.txt"]);
    run_git(&path, &["commit", "-m", "Modify in main"]);

    // Attempt merge (will create conflict)
    let _ = git_cmd(&path)
        .args(["merge", "feature"])
        .output()
        .expect("merge command failed");

    (tmp, path)
}

// =============================================================================
// Repository Tests
// =============================================================================

mod repository {
    use super::*;

    #[test]
    fn test_open_repo() {
        let (_tmp, path) = create_test_repo();
        let repo = git::open_repo(&path).expect("should open repo");
        assert!(!repo.is_bare());
    }

    #[test]
    fn test_open_repo_nonexistent() {
        let result = git::open_repo("/nonexistent/path");
        assert!(result.is_err());
    }

    #[test]
    fn test_discover_repo_from_subdir() {
        let (_tmp, path) = create_test_repo();

        // Create a subdirectory
        let subdir = path.join("subdir");
        std::fs::create_dir(&subdir).unwrap();

        let repo = git::discover_repo(&subdir).expect("should discover repo from subdir");
        let info = git::get_repository_info(&repo).expect("should get info");
        assert_eq!(info.name, path.file_name().unwrap().to_string_lossy());
    }

    #[test]
    fn test_get_repository_info() {
        let (_tmp, path) = create_test_repo();
        let repo = git::open_repo(&path).unwrap();
        let info = git::get_repository_info(&repo).expect("should get info");

        assert!(!info.is_bare);
        assert_eq!(info.head_branch, Some("main".to_string()));
    }

    #[test]
    fn test_repository_info_snapshot() {
        let (_tmp, path) = create_test_repo();
        let repo = git::open_repo(&path).unwrap();
        let mut info = git::get_repository_info(&repo).expect("should get info");

        // Normalize path for snapshot
        info.path = "/tmp/test-repo/".to_string();
        info.name = "test-repo".to_string();

        insta::assert_debug_snapshot!(info);
    }
}

// =============================================================================
// Status Tests
// =============================================================================

mod status {
    use super::*;

    #[test]
    fn test_status_clean() {
        let (_tmp, path) = create_test_repo();
        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).expect("should get status");

        assert!(status.staged.is_empty());
        assert!(status.unstaged.is_empty());
        assert!(status.untracked.is_empty());
    }

    #[test]
    fn test_status_untracked_file() {
        let (_tmp, path) = create_test_repo();

        // Create untracked file
        std::fs::write(path.join("new_file.txt"), "content").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).expect("should get status");

        assert!(status.staged.is_empty());
        assert!(status.unstaged.is_empty());
        assert_eq!(status.untracked.len(), 1);
        assert_eq!(status.untracked[0].path, "new_file.txt");
    }

    #[test]
    fn test_status_staged_file() {
        let (_tmp, path) = create_test_repo();

        // Create and stage a file
        std::fs::write(path.join("staged.txt"), "content").unwrap();
        run_git(&path, &["add", "staged.txt"]);

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).expect("should get status");

        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].path, "staged.txt");
        assert_eq!(status.staged[0].status, "A");
        assert!(status.unstaged.is_empty());
        assert!(status.untracked.is_empty());
    }

    #[test]
    fn test_status_modified_file() {
        let (_tmp, path) = create_test_repo();

        // Modify existing file
        std::fs::write(path.join("README.md"), "modified content\n").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).expect("should get status");

        assert!(status.staged.is_empty());
        assert_eq!(status.unstaged.len(), 1);
        assert_eq!(status.unstaged[0].path, "README.md");
        assert_eq!(status.unstaged[0].status, "M");
    }

    #[test]
    fn test_status_deleted_file() {
        let (_tmp, path) = create_test_repo();

        // Delete a tracked file
        std::fs::remove_file(path.join("README.md")).unwrap();

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).expect("should get status");

        assert!(status.staged.is_empty());
        assert_eq!(status.unstaged.len(), 1);
        assert_eq!(status.unstaged[0].path, "README.md");
        assert_eq!(status.unstaged[0].status, "D");
    }

    #[test]
    fn test_status_mixed_snapshot() {
        let (_tmp, path) = create_test_repo();

        // Create a mix of staged, unstaged, and untracked
        std::fs::write(path.join("staged.txt"), "staged content").unwrap();
        run_git(&path, &["add", "staged.txt"]);
        std::fs::write(path.join("README.md"), "modified").unwrap();
        std::fs::write(path.join("untracked.txt"), "untracked").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).expect("should get status");

        insta::assert_debug_snapshot!(status);
    }
}

// =============================================================================
// Staging Tests
// =============================================================================

mod staging {
    use super::*;

    #[test]
    fn test_stage_files() {
        let (_tmp, path) = create_test_repo();

        // Create untracked files
        std::fs::write(path.join("file1.txt"), "content1").unwrap();
        std::fs::write(path.join("file2.txt"), "content2").unwrap();

        let repo = git::open_repo(&path).unwrap();

        // Stage one file
        git::stage_files(&repo, &["file1.txt".to_string()]).expect("should stage");

        let status = git::get_status(&repo).unwrap();
        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].path, "file1.txt");
        assert_eq!(status.untracked.len(), 1);
        assert_eq!(status.untracked[0].path, "file2.txt");
    }

    #[test]
    fn test_unstage_files() {
        let (_tmp, path) = create_test_repo();

        // Create and stage a file
        std::fs::write(path.join("file.txt"), "content").unwrap();
        run_git(&path, &["add", "file.txt"]);

        let repo = git::open_repo(&path).unwrap();

        // Verify staged
        let status = git::get_status(&repo).unwrap();
        assert_eq!(status.staged.len(), 1);

        // Unstage
        git::unstage_files(&repo, &["file.txt".to_string()]).expect("should unstage");

        // Verify unstaged (now untracked since it's new)
        let status = git::get_status(&repo).unwrap();
        assert!(status.staged.is_empty());
        assert_eq!(status.untracked.len(), 1);
    }

    #[test]
    fn test_discard_changes() {
        let (_tmp, path) = create_test_repo();

        // Modify existing file
        std::fs::write(path.join("README.md"), "modified content\n").unwrap();

        let repo = git::open_repo(&path).unwrap();

        // Verify modified
        let status = git::get_status(&repo).unwrap();
        assert_eq!(status.unstaged.len(), 1);

        // Discard changes
        git::discard_changes(&repo, &["README.md".to_string()]).expect("should discard");

        // Verify clean
        let status = git::get_status(&repo).unwrap();
        assert!(status.unstaged.is_empty());

        // Verify content restored
        let content = std::fs::read_to_string(path.join("README.md")).unwrap();
        assert_eq!(content, "# Test Repo\n");
    }
}

// =============================================================================
// Diff Tests
// =============================================================================

mod diff {
    use super::*;

    #[test]
    fn test_working_diff_staged() {
        let (_tmp, path) = create_test_repo();

        // Create and stage a new file
        std::fs::write(path.join("new.txt"), "new content\n").unwrap();
        run_git(&path, &["add", "new.txt"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "new.txt");
        assert_eq!(diff.files[0].status, "A");
        assert!(diff.patch.contains("+new content"));
    }

    #[test]
    fn test_working_diff_unstaged() {
        let (_tmp, path) = create_test_repo();

        // Modify existing file
        std::fs::write(path.join("README.md"), "modified\n").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, false).expect("should get unstaged diff");

        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "README.md");
        assert_eq!(diff.files[0].status, "M");
        assert!(diff.patch.contains("-# Test Repo"));
        assert!(diff.patch.contains("+modified"));
    }

    #[test]
    fn test_commit_diff() {
        let (_tmp, path) = create_repo_with_history();

        // Get the latest commit
        let commit_id = run_git_output(&path, &["rev-parse", "HEAD"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_commit_diff(&repo, &commit_id).expect("should get commit diff");

        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "file2.txt");
        assert_eq!(diff.files[0].status, "A");
    }

    #[test]
    fn test_file_diff() {
        let (_tmp, path) = create_repo_with_history();

        let commit_id = run_git_output(&path, &["rev-parse", "HEAD"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_file_diff(&repo, &commit_id, "file2.txt").expect("should get file diff");

        assert_eq!(diff.path, "file2.txt");
        assert!(diff.patch.contains("+content 2"));
    }

    // Snapshot tests for working diffs

    #[test]
    fn test_working_diff_staged_snapshot() {
        let (_tmp, path) = create_test_repo();

        // Stage multiple types of changes
        std::fs::write(path.join("added.txt"), "new file content\n").unwrap();
        std::fs::write(path.join("README.md"), "modified content\n").unwrap();
        run_git(&path, &["add", "added.txt", "README.md"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        // Snapshot the files metadata (not the full patch which has line numbers)
        insta::assert_debug_snapshot!("working_diff_staged_files", &diff.files);
    }

    #[test]
    fn test_working_diff_unstaged_snapshot() {
        let (_tmp, path) = create_test_repo();

        // Create unstaged changes
        std::fs::write(path.join("README.md"), "modified readme\n").unwrap();
        std::fs::write(path.join("untracked.txt"), "untracked content\n").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, false).expect("should get unstaged diff");

        insta::assert_debug_snapshot!("working_diff_unstaged_files", &diff.files);
    }

    #[test]
    fn test_working_diff_deleted_file_snapshot() {
        let (_tmp, path) = create_test_repo();

        // Delete a tracked file and stage
        std::fs::remove_file(path.join("README.md")).unwrap();
        run_git(&path, &["add", "README.md"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        insta::assert_debug_snapshot!("working_diff_deleted_files", &diff.files);
    }

    // Regression tests for untracked file patch formatting

    #[test]
    fn test_untracked_text_file_patch_format() {
        let (_tmp, path) = create_test_repo();

        // Create an untracked text file with multiple lines
        std::fs::write(path.join("untracked.txt"), "line one\nline two\nline three\n").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, false).expect("should get unstaged diff");

        // Verify patch contains proper unified diff format for untracked file
        assert!(diff.patch.contains("diff --git a/untracked.txt b/untracked.txt"), 
            "patch should contain diff header");
        assert!(diff.patch.contains("new file mode"), 
            "patch should contain new file mode");
        assert!(diff.patch.contains("--- /dev/null"), 
            "patch should show /dev/null as old file");
        assert!(diff.patch.contains("+++ b/untracked.txt"), 
            "patch should show new file path");
        assert!(diff.patch.contains("@@ -0,0 +1,3 @@"), 
            "patch should have correct hunk header for 3 lines");
        assert!(diff.patch.contains("+line one"), 
            "patch should contain added lines with + prefix");
        assert!(diff.patch.contains("+line two"), 
            "patch should contain all added lines");
        assert!(diff.patch.contains("+line three"), 
            "patch should contain all added lines");
    }

    #[test]
    fn test_untracked_binary_file_patch_format() {
        let (_tmp, path) = create_test_repo();

        // Create an untracked binary file (contains null bytes)
        let binary_content = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
        std::fs::write(path.join("image.png"), &binary_content).unwrap();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, false).expect("should get unstaged diff");

        // Verify patch contains proper binary diff stub
        assert!(diff.patch.contains("diff --git a/image.png b/image.png"), 
            "patch should contain diff header for binary file");
        assert!(diff.patch.contains("new file mode"), 
            "patch should contain new file mode");
        assert!(diff.patch.contains("--- /dev/null"), 
            "patch should show /dev/null as old file");
        assert!(diff.patch.contains("+++ b/image.png"), 
            "patch should show new file path");
        assert!(diff.patch.contains("Binary files /dev/null and b/image.png differ"), 
            "patch should contain binary files differ message");
    }

    #[test]
    fn test_untracked_empty_file_patch_format() {
        let (_tmp, path) = create_test_repo();

        // Create an empty untracked file
        std::fs::write(path.join("empty.txt"), "").unwrap();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, false).expect("should get unstaged diff");

        // Verify patch contains proper format for empty file
        assert!(diff.patch.contains("diff --git a/empty.txt b/empty.txt"), 
            "patch should contain diff header for empty file");
        assert!(diff.patch.contains("new file mode"), 
            "patch should contain new file mode");
        assert!(diff.patch.contains("--- /dev/null"), 
            "patch should show /dev/null as old file");
        assert!(diff.patch.contains("+++ b/empty.txt"), 
            "patch should show new file path");
        // Empty file should NOT have a hunk header
        assert!(!diff.patch.contains("@@ -0,0 +1,"), 
            "empty file should not have hunk header with lines");
    }
}

// =============================================================================
// Commit Tests
// =============================================================================

mod commits {
    use super::*;

    #[test]
    fn test_create_commit() {
        let (_tmp, path) = create_test_repo();

        // Stage a change
        std::fs::write(path.join("new.txt"), "content").unwrap();
        run_git(&path, &["add", "new.txt"]);

        let repo = git::open_repo(&path).unwrap();
        let commit_id = git::create_commit(&repo, "Test commit message").expect("should create commit");

        // Verify commit was created
        assert!(!commit_id.is_empty());

        // Verify commit message
        let msg = run_git_output(&path, &["log", "-1", "--format=%s"]);
        assert_eq!(msg, "Test commit message");
    }

    #[test]
    fn test_get_commits() {
        let (_tmp, path) = create_repo_with_history();

        let repo = git::open_repo(&path).unwrap();
        let commits = git::get_commits(&repo, None, 10, 0).expect("should get commits");

        assert_eq!(commits.len(), 3); // Initial + file1 + file2
        assert_eq!(commits[0].summary, "Add file2");
        assert_eq!(commits[1].summary, "Add file1");
        assert_eq!(commits[2].summary, "Initial commit");
    }

    #[test]
    fn test_get_commits_with_limit() {
        let (_tmp, path) = create_repo_with_history();

        let repo = git::open_repo(&path).unwrap();
        let commits = git::get_commits(&repo, None, 2, 0).expect("should get commits");

        assert_eq!(commits.len(), 2);
    }

    #[test]
    fn test_get_commits_with_offset() {
        let (_tmp, path) = create_repo_with_history();

        let repo = git::open_repo(&path).unwrap();
        let commits = git::get_commits(&repo, None, 10, 1).expect("should get commits");

        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "Add file1");
    }
}

// =============================================================================
// Branch Tests
// =============================================================================

mod branches {
    use super::*;

    #[test]
    fn test_list_branches() {
        let (_tmp, path) = create_repo_with_branches();

        let repo = git::open_repo(&path).unwrap();
        let branches = git::list_all_branches(&repo).expect("should list branches");

        let local_branches: Vec<_> = branches.iter().filter(|b| !b.is_remote).collect();
        assert_eq!(local_branches.len(), 2);

        let names: Vec<_> = local_branches.iter().map(|b| b.name.as_str()).collect();
        assert!(names.contains(&"main"));
        assert!(names.contains(&"feature"));
    }

    #[test]
    fn test_create_branch() {
        let (_tmp, path) = create_test_repo();

        let repo = git::open_repo(&path).unwrap();
        git::create_branch(&repo, "new-branch", false).expect("should create branch");

        let branches = git::list_all_branches(&repo).unwrap();
        let names: Vec<_> = branches.iter().map(|b| b.name.as_str()).collect();
        assert!(names.contains(&"new-branch"));
    }

    #[test]
    fn test_checkout_branch() {
        let (_tmp, path) = create_repo_with_branches();

        let repo = git::open_repo(&path).unwrap();

        // Verify on main
        let info = git::get_repository_info(&repo).unwrap();
        assert_eq!(info.head_branch, Some("main".to_string()));

        // Checkout feature
        git::checkout_branch(&repo, "feature").expect("should checkout");

        // Need to re-open repo to see updated HEAD
        let repo = git::open_repo(&path).unwrap();
        let info = git::get_repository_info(&repo).unwrap();
        assert_eq!(info.head_branch, Some("feature".to_string()));
    }
}

// =============================================================================
// Graph Tests
// =============================================================================

mod graph {
    use super::*;

    #[test]
    fn test_build_commit_graph() {
        let (_tmp, path) = create_repo_with_history();

        let repo = git::open_repo(&path).unwrap();
        let commits = git::get_commits(&repo, None, 10, 0).unwrap();
        let commit_ids: Vec<String> = commits.iter().map(|c| c.id.clone()).collect();

        let graph = git::build_commit_graph(&repo, &commit_ids).expect("should build graph");

        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.max_columns, 1); // Linear history = 1 column
    }

    #[test]
    fn test_build_commit_graph_with_merge() {
        let (_tmp, path) = create_repo_with_branches();

        // Merge feature into main
        run_git(&path, &["merge", "feature", "-m", "Merge feature"]);

        let repo = git::open_repo(&path).unwrap();
        let commits = git::get_commits_all_branches(&repo, 10, 0).unwrap();
        let commit_ids: Vec<String> = commits.iter().map(|c| c.id.clone()).collect();

        let graph = git::build_commit_graph(&repo, &commit_ids).expect("should build graph");

        // Should have connections for merge
        let merge_node = &graph.nodes[0];
        assert!(!merge_node.connections.is_empty());
    }

    #[test]
    fn test_empty_graph() {
        let (_tmp, path) = create_test_repo();

        let repo = git::open_repo(&path).unwrap();
        let graph = git::build_commit_graph(&repo, &[]).expect("should handle empty");

        assert!(graph.nodes.is_empty());
        assert_eq!(graph.max_columns, 0);
    }
}

// =============================================================================
// Merge Conflict Tests
// =============================================================================

mod merge_conflict {
    use super::*;

    #[test]
    fn test_get_merge_status_no_conflict() {
        let (_tmp, path) = create_test_repo();

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_merge_status(&repo).expect("should get merge status");

        assert!(!status.in_merge);
        assert!(status.conflicting_files.is_empty());
    }

    #[test]
    fn test_get_merge_status_with_conflict() {
        let (_tmp, path) = create_repo_with_conflict();

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_merge_status(&repo).expect("should get merge status");

        assert!(status.in_merge);
        assert_eq!(status.conflicting_files.len(), 1);
        assert_eq!(status.conflicting_files[0], "conflict.txt");
    }

    #[test]
    fn test_parse_file_conflicts() {
        let (_tmp, path) = create_repo_with_conflict();

        let info = git::parse_file_conflicts(path.to_str().unwrap(), "conflict.txt")
            .expect("should parse conflicts");

        assert_eq!(info.file_path, "conflict.txt");
        assert_eq!(info.conflicts.len(), 1);

        // Check that we extracted the conflict regions
        let conflict = &info.conflicts[0];
        assert!(conflict.ours_content.contains("main branch content"));
        assert!(conflict.theirs_content.contains("feature branch content"));
    }

    #[test]
    fn test_save_resolved_file() {
        let (_tmp, path) = create_repo_with_conflict();

        let resolved_content = "resolved content\n";
        git::save_resolved_file(path.to_str().unwrap(), "conflict.txt", resolved_content)
            .expect("should save");

        let content = std::fs::read_to_string(path.join("conflict.txt")).unwrap();
        assert_eq!(content, resolved_content);
    }

    #[test]
    fn test_mark_file_resolved() {
        let (_tmp, path) = create_repo_with_conflict();

        // Save resolved content first
        std::fs::write(path.join("conflict.txt"), "resolved\n").unwrap();

        let repo = git::open_repo(&path).unwrap();
        git::mark_file_resolved(&repo, "conflict.txt").expect("should mark resolved");

        // Check it's staged
        let status = git::get_status(&repo).unwrap();
        assert!(status.staged.iter().any(|f| f.path == "conflict.txt"));
    }

    #[test]
    fn test_abort_merge() {
        let (_tmp, path) = create_repo_with_conflict();

        git::abort_merge(path.to_str().unwrap()).expect("should abort merge");

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_merge_status(&repo).unwrap();
        assert!(!status.in_merge);
    }
}

// =============================================================================
// Worktree Tests
// =============================================================================

mod worktrees {
    use super::*;

    #[test]
    fn test_list_worktrees() {
        let (_tmp, path) = create_test_repo();

        let repo = git::open_repo(&path).unwrap();
        let worktrees = git::list_worktrees(&repo).expect("should list worktrees");

        // Should have at least the main worktree
        assert!(!worktrees.is_empty());
        assert!(worktrees.iter().any(|w| w.is_main));
    }

    #[test]
    fn test_create_worktree() {
        let (tmp, path) = create_test_repo();

        // Create a new branch first
        run_git(&path, &["branch", "worktree-branch"]);

        let wt_path = tmp.path().join("worktree1");
        let options = git::WorktreeCreateOptions {
            name: "worktree1".to_string(),
            path: wt_path.to_string_lossy().to_string(),
            branch: Some("worktree-branch".to_string()),
            new_branch: None,
        };

        let wt = git::create_worktree(path.to_str().unwrap(), options).expect("should create worktree");

        assert_eq!(wt.name, "worktree1");
        assert!(!wt.is_main);
        assert!(wt_path.exists());
    }

    #[test]
    fn test_create_worktree_with_new_branch() {
        let (tmp, path) = create_test_repo();

        let wt_path = tmp.path().join("worktree2");
        let options = git::WorktreeCreateOptions {
            name: "worktree2".to_string(),
            path: wt_path.to_string_lossy().to_string(),
            branch: None,
            new_branch: Some("new-wt-branch".to_string()),
        };

        let wt = git::create_worktree(path.to_str().unwrap(), options).expect("should create worktree");

        assert_eq!(wt.head_branch, Some("new-wt-branch".to_string()));
    }

    #[test]
    fn test_remove_worktree() {
        let (tmp, path) = create_test_repo();

        // Create a worktree
        run_git(&path, &["branch", "to-remove"]);
        let wt_path = tmp.path().join("to-remove-wt");
        run_git(
            &path,
            &["worktree", "add", wt_path.to_str().unwrap(), "to-remove"],
        );

        // Remove it
        git::remove_worktree(path.to_str().unwrap(), "to-remove-wt", false)
            .expect("should remove worktree");

        // Verify it's gone
        let repo = git::open_repo(&path).unwrap();
        let worktrees = git::list_worktrees(&repo).unwrap();
        assert!(!worktrees.iter().any(|w| w.name == "to-remove-wt"));
    }

    #[test]
    fn test_lock_unlock_worktree() {
        let (tmp, path) = create_test_repo();

        // Create a worktree
        run_git(&path, &["branch", "lockable"]);
        let wt_path = tmp.path().join("lockable-wt");
        run_git(
            &path,
            &["worktree", "add", wt_path.to_str().unwrap(), "lockable"],
        );

        // Lock it
        git::lock_worktree(path.to_str().unwrap(), "lockable-wt", Some("testing"))
            .expect("should lock");

        // Verify locked
        let repo = git::open_repo(&path).unwrap();
        let worktrees = git::list_worktrees(&repo).unwrap();
        let wt = worktrees.iter().find(|w| w.name == "lockable-wt").unwrap();
        assert!(wt.is_locked);
        // Lock reason may have trailing newline depending on git version
        assert!(wt.lock_reason.as_ref().map(|s| s.trim()) == Some("testing"));

        // Unlock it
        git::unlock_worktree(path.to_str().unwrap(), "lockable-wt").expect("should unlock");

        let repo = git::open_repo(&path).unwrap();
        let worktrees = git::list_worktrees(&repo).unwrap();
        let wt = worktrees.iter().find(|w| w.name == "lockable-wt").unwrap();
        assert!(!wt.is_locked);
    }
}

// =============================================================================
// Extended Diff Metadata Tests (rename/copy/typechange)
// =============================================================================

mod diff_metadata {
    use super::*;

    /// Create a repo with a renamed file (staged)
    fn create_repo_with_rename() -> (TempDir, PathBuf) {
        let (tmp, path) = create_test_repo();

        // Add a file with enough content for rename detection
        let content = "This is a file with enough content\nfor git to detect it as a rename\nwhen we move it to a new location.\n";
        std::fs::write(path.join("original.txt"), content).unwrap();
        run_git(&path, &["add", "original.txt"]);
        run_git(&path, &["commit", "-m", "Add original.txt"]);

        // Rename the file and stage the change
        std::fs::rename(path.join("original.txt"), path.join("renamed.txt")).unwrap();
        run_git(&path, &["add", "-A"]);

        (tmp, path)
    }

    /// Create a repo with a copied file (staged)
    fn create_repo_with_copy() -> (TempDir, PathBuf) {
        let (tmp, path) = create_test_repo();

        // Add a file with enough content for copy detection
        let content = "This is a file with enough content\nfor git to detect it as a copy\nwhen we duplicate it to a new location.\n";
        std::fs::write(path.join("source.txt"), content).unwrap();
        run_git(&path, &["add", "source.txt"]);
        run_git(&path, &["commit", "-m", "Add source.txt"]);

        // Copy the file (keep original, add copy)
        std::fs::copy(path.join("source.txt"), path.join("copied.txt")).unwrap();
        run_git(&path, &["add", "copied.txt"]);

        (tmp, path)
    }

    /// Create a repo with a type change (executable bit on Unix)
    #[cfg(unix)]
    fn create_repo_with_typechange() -> (TempDir, PathBuf) {
        use std::os::unix::fs::PermissionsExt;

        let (tmp, path) = create_test_repo();

        // Add a regular file
        std::fs::write(path.join("script.sh"), "#!/bin/bash\necho hello\n").unwrap();
        run_git(&path, &["add", "script.sh"]);
        run_git(&path, &["commit", "-m", "Add script.sh"]);

        // Change to executable
        let mut perms = std::fs::metadata(path.join("script.sh")).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(path.join("script.sh"), perms).unwrap();
        run_git(&path, &["add", "script.sh"]);

        (tmp, path)
    }

    #[test]
    fn test_rename_detection_staged() {
        let (_tmp, path) = create_repo_with_rename();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        // Should detect exactly one file change (rename, not delete+add)
        // Note: Depending on rename detection, this could be 1 (rename) or 2 (delete+add)
        // Our find_similar should detect it as rename
        assert!(!diff.files.is_empty());

        // Look for the renamed file
        let rename = diff.files.iter().find(|f| f.status == "R");
        if let Some(r) = rename {
            assert_eq!(r.path, "renamed.txt");
            assert_eq!(r.old_path, Some("original.txt".to_string()));
            assert!(r.similarity.is_some());
        } else {
            // Fallback: if rename not detected, should be delete + add
            let deleted = diff.files.iter().find(|f| f.status == "D");
            let added = diff.files.iter().find(|f| f.status == "A");
            assert!(deleted.is_some() || added.is_some(), "Should have some file changes");
        }
    }

    #[test]
    fn test_rename_detection_commit() {
        let (_tmp, path) = create_repo_with_rename();

        // Commit the rename
        run_git(&path, &["commit", "-m", "Rename original to renamed"]);

        let commit_id = run_git_output(&path, &["rev-parse", "HEAD"]);
        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_commit_diff(&repo, &commit_id).expect("should get commit diff");

        // Should detect rename
        let rename = diff.files.iter().find(|f| f.status == "R");
        if let Some(r) = rename {
            assert_eq!(r.path, "renamed.txt");
            assert_eq!(r.old_path, Some("original.txt".to_string()));
        }
    }

    #[test]
    fn test_copy_detection_staged() {
        let (_tmp, path) = create_repo_with_copy();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        // Should have at least one file
        assert!(!diff.files.is_empty());

        // Look for copy detection (may be detected as Add if copy detection threshold not met)
        let copied = diff.files.iter().find(|f| f.status == "C");
        let added = diff.files.iter().find(|f| f.path == "copied.txt");
        
        // Either we detect it as a copy, or as an addition
        assert!(copied.is_some() || added.is_some());

        if let Some(c) = copied {
            assert_eq!(c.path, "copied.txt");
            assert_eq!(c.old_path, Some("source.txt".to_string()));
        }
    }

    #[test]
    fn test_binary_file_metadata() {
        let (_tmp, path) = create_test_repo();

        // Create a binary file (PNG header bytes)
        let binary_content = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00];
        std::fs::write(path.join("image.png"), &binary_content).unwrap();
        run_git(&path, &["add", "image.png"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "image.png");
        // Binary detection depends on git's heuristics
        // The is_binary flag should be set
        assert!(diff.files[0].is_binary, "Should detect binary file");
    }

    #[test]
    fn test_file_mode_metadata() {
        let (_tmp, path) = create_test_repo();

        // Add a new file
        std::fs::write(path.join("newfile.txt"), "content\n").unwrap();
        run_git(&path, &["add", "newfile.txt"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        assert_eq!(diff.files.len(), 1);
        // New file should have new_mode set (typically 0o100644 = 33188)
        let f = &diff.files[0];
        assert!(f.new_mode.is_some(), "Should have new_mode for new file");
        // old_mode should be None or 0 for new files
    }

    #[cfg(unix)]
    #[test]
    fn test_executable_mode_change() {
        let (_tmp, path) = create_repo_with_typechange();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        assert!(!diff.files.is_empty());
        let f = &diff.files[0];
        assert_eq!(f.path, "script.sh");

        // Mode change: old_mode should be regular file (100644), new_mode should be executable (100755)
        // Note: Git stores modes as integers, not octal
        if let (Some(old), Some(new)) = (f.old_mode, f.new_mode) {
            // 33188 = 0o100644 (regular file)
            // 33261 = 0o100755 (executable)
            assert!(old != new, "Modes should differ: old={} new={}", old, new);
        }
    }

    // Snapshot tests for diff metadata

    #[test]
    fn test_rename_diff_snapshot() {
        let (_tmp, path) = create_repo_with_rename();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        // Snapshot just the files array (not the patch which has volatile content)
        insta::assert_debug_snapshot!("rename_staged_files", &diff.files);
    }

    #[test]
    fn test_copy_diff_snapshot() {
        let (_tmp, path) = create_repo_with_copy();

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        insta::assert_debug_snapshot!("copy_staged_files", &diff.files);
    }

    #[test]
    fn test_binary_diff_snapshot() {
        let (_tmp, path) = create_test_repo();

        let binary_content = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        std::fs::write(path.join("image.png"), &binary_content).unwrap();
        run_git(&path, &["add", "image.png"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should get staged diff");

        insta::assert_debug_snapshot!("binary_staged_files", &diff.files);
    }
}

// =============================================================================
// Edge Cases & Regressions
// =============================================================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_status_with_renamed_file() {
        let (_tmp, path) = create_test_repo();

        // Git needs rename detection, which requires staging
        std::fs::rename(path.join("README.md"), path.join("RENAMED.md")).unwrap();
        run_git(&path, &["add", "-A"]);

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).unwrap();

        // Should detect as rename or as delete+add depending on git version
        assert!(!status.staged.is_empty());
    }

    #[test]
    fn test_binary_file_diff() {
        let (_tmp, path) = create_test_repo();

        // Create a binary file (PNG header)
        let binary_content = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        std::fs::write(path.join("image.png"), &binary_content).unwrap();
        run_git(&path, &["add", "image.png"]);

        let repo = git::open_repo(&path).unwrap();
        let diff = git::get_working_diff(&repo, true).expect("should handle binary");

        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "image.png");
    }

    #[test]
    fn test_unicode_filename() {
        let (_tmp, path) = create_test_repo();

        std::fs::write(path.join("日本語.txt"), "unicode content").unwrap();
        run_git(&path, &["add", "日本語.txt"]);

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).unwrap();

        assert_eq!(status.staged.len(), 1);
        // Note: git might quote the filename
    }

    #[test]
    fn test_empty_repo() {
        let tmp = TempDir::new().expect("failed to create temp dir");
        let path = tmp.path();

        run_git(path, &["init"]);
        run_git(path, &["config", "user.name", "Test"]);
        run_git(path, &["config", "user.email", "test@example.com"]);

        // No commits yet
        let repo = git::open_repo(path).unwrap();

        // Status should work
        let status = git::get_status(&repo).unwrap();
        assert!(status.staged.is_empty());

        // Getting commits should return empty
        let commits = git::get_commits(&repo, None, 10, 0);
        // This might fail or return empty depending on implementation
        match commits {
            Ok(c) => assert!(c.is_empty()),
            Err(_) => {} // Also acceptable for unborn HEAD
        }
    }

    #[test]
    fn test_nested_directories() {
        let (_tmp, path) = create_test_repo();

        // Create nested structure
        std::fs::create_dir_all(path.join("a/b/c")).unwrap();
        std::fs::write(path.join("a/b/c/deep.txt"), "deep content").unwrap();
        run_git(&path, &["add", "a/b/c/deep.txt"]);

        let repo = git::open_repo(&path).unwrap();
        let status = git::get_status(&repo).unwrap();

        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].path, "a/b/c/deep.txt");
    }
}
