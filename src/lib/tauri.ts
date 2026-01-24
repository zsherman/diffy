import { invoke } from "@tauri-apps/api/core";
import type {
  RepositoryInfo,
  BranchInfo,
  CommitInfo,
  CommitGraph,
  CommitActivity,
  ChangelogCommit,
  StatusInfo,
  UnifiedDiff,
  FileDiff,
  AIReviewData,
  WorktreeInfo,
  WorktreeCreateOptions,
  StashEntry,
  AheadBehind,
} from "../types/git";
import type { SkillMetadata, RemoteSkill } from "../types/skills";
import type {
  MergeStatus,
  FileConflictInfo,
  AIResolveConflictResponse,
} from "../features/merge-conflict/types";
import { isPerfTracingEnabled } from "../stores/ui-store";

// Performance-traced invoke wrapper for critical endpoints
async function tracedInvoke<T>(
  cmd: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!isPerfTracingEnabled()) {
    return invoke<T>(cmd, args);
  }
  const start = performance.now();
  try {
    const result = await invoke<T>(cmd, args);
    const elapsed = performance.now() - start;
    console.log(`[perf] Tauri ${cmd}: ${elapsed.toFixed(1)}ms`);
    return result;
  } catch (error) {
    const elapsed = performance.now() - start;
    console.log(`[perf] Tauri ${cmd} FAILED: ${elapsed.toFixed(1)}ms`);
    throw error;
  }
}

// ============================================================================
// Structured Error Handling
// ============================================================================

/**
 * Error codes returned by the Rust backend.
 * Use these to branch on specific error types in the UI.
 */
export type ErrorCode =
  | "errors.unknown"
  | "errors.validation"
  | "errors.repo_not_found"
  | "errors.git_auth"
  | "errors.merge_conflict"
  | "errors.network"
  | "errors.io"
  | "errors.parse"
  | "errors.git"
  | "errors.ai"
  | "errors.skill";

/**
 * Structured error shape from the backend.
 */
export interface AppError {
  code: ErrorCode;
  message: string;
}

/**
 * Type guard to check if an error is a structured AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as AppError).code === "string" &&
    typeof (error as AppError).message === "string"
  );
}

/**
 * Normalize any error (from Tauri invoke or elsewhere) into a consistent shape.
 * Returns an AppError-like object with code and message.
 */
export function normalizeError(error: unknown): AppError {
  // Already a structured error from Rust
  if (isAppError(error)) {
    return error;
  }

  // Plain string error
  if (typeof error === "string") {
    return { code: "errors.unknown", message: error };
  }

  // Error with message property
  if (error instanceof Error) {
    return { code: "errors.unknown", message: error.message };
  }

  // Object with message property
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message: unknown }).message;
    return { code: "errors.unknown", message: String(msg) };
  }

  // Fallback
  return { code: "errors.unknown", message: String(error) };
}

/**
 * Get a user-friendly message for an error code.
 */
export function getErrorMessage(error: AppError): string {
  switch (error.code) {
    case "errors.repo_not_found":
      return `Repository not found: ${error.message}`;
    case "errors.git_auth":
      return `Authentication required: ${error.message}`;
    case "errors.network":
      return `Network error: ${error.message}`;
    case "errors.validation":
      return error.message;
    case "errors.ai":
      return `AI error: ${error.message}`;
    default:
      return error.message;
  }
}

// Repository
export async function openRepository(path: string): Promise<RepositoryInfo> {
  return invoke<RepositoryInfo>("open_repository", { path });
}

export async function discoverRepository(
  startPath: string,
): Promise<RepositoryInfo> {
  return invoke<RepositoryInfo>("discover_repository", { startPath });
}

// Branches
export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  return tracedInvoke<BranchInfo[]>("list_branches", { repoPath });
}

export async function checkoutBranch(
  repoPath: string,
  branchName: string,
): Promise<void> {
  return invoke<void>("checkout_branch", { repoPath, branchName });
}

export async function createBranch(
  repoPath: string,
  branchName: string,
  checkout: boolean = true,
): Promise<void> {
  return invoke<void>("create_branch", { repoPath, branchName, checkout });
}

// Commits
export async function getCommitHistory(
  repoPath: string,
  branch?: string,
  limit: number = 100,
  offset: number = 0,
): Promise<CommitInfo[]> {
  return tracedInvoke<CommitInfo[]>("get_commit_history", {
    repoPath,
    branch,
    limit,
    offset,
  });
}

export async function getCommitHistoryAllBranches(
  repoPath: string,
  limit: number = 100,
  offset: number = 0,
): Promise<CommitInfo[]> {
  return tracedInvoke<CommitInfo[]>("get_commit_history_all_branches", {
    repoPath,
    limit,
    offset,
  });
}

export async function getCommitActivityAllBranches(
  repoPath: string,
  since: number,
  until: number,
): Promise<CommitActivity[]> {
  return tracedInvoke<CommitActivity[]>("get_commit_activity_all_branches", {
    repoPath,
    since,
    until,
  });
}

export async function getChangelogCommitsAllBranches(
  repoPath: string,
  since: number,
  until: number,
): Promise<ChangelogCommit[]> {
  return tracedInvoke<ChangelogCommit[]>("get_changelog_commits_all_branches", {
    repoPath,
    since,
    until,
  });
}

export async function generateChangelogSummary(
  repoPath: string,
  since: number,
  until: number,
  contributorEmail?: string | null,
): Promise<string> {
  return invoke<string>("generate_changelog_summary", {
    repoPath,
    since,
    until,
    contributorEmail,
  });
}

export async function getCommitGraph(
  repoPath: string,
  commitIds: string[],
): Promise<CommitGraph> {
  return tracedInvoke<CommitGraph>("get_commit_graph", { repoPath, commitIds });
}

// Diff
export async function getCommitDiff(
  repoPath: string,
  commitId: string,
): Promise<UnifiedDiff> {
  return tracedInvoke<UnifiedDiff>("get_commit_diff", { repoPath, commitId });
}

export async function getFileDiff(
  repoPath: string,
  commitId: string,
  filePath: string,
): Promise<FileDiff> {
  return invoke<FileDiff>("get_file_diff", { repoPath, commitId, filePath });
}

export async function getWorkingDiff(
  repoPath: string,
  staged: boolean,
): Promise<UnifiedDiff> {
  return tracedInvoke<UnifiedDiff>("get_working_diff", { repoPath, staged });
}

// Status
export async function getStatus(repoPath: string): Promise<StatusInfo> {
  return tracedInvoke<StatusInfo>("get_status", { repoPath });
}

// Staging
export async function stageFiles(
  repoPath: string,
  paths: string[],
): Promise<void> {
  return invoke<void>("stage_files", { repoPath, paths });
}

export async function unstageFiles(
  repoPath: string,
  paths: string[],
): Promise<void> {
  return invoke<void>("unstage_files", { repoPath, paths });
}

export async function discardChanges(
  repoPath: string,
  paths: string[],
): Promise<void> {
  return invoke<void>("discard_changes", { repoPath, paths });
}

// Remote operations
export async function gitFetch(repoPath: string): Promise<string> {
  return invoke<string>("git_fetch", { repoPath });
}

export async function gitPull(repoPath: string): Promise<string> {
  return invoke<string>("git_pull", { repoPath });
}

export async function gitPush(repoPath: string): Promise<string> {
  return invoke<string>("git_push", { repoPath });
}

// Commit
export async function createCommit(
  repoPath: string,
  message: string,
): Promise<string> {
  return invoke<string>("create_commit", { repoPath, message });
}

// AI
export async function generateCommitMessage(repoPath: string): Promise<string> {
  return invoke<string>("generate_commit_message", { repoPath });
}

export interface IssueToFix {
  issueType: "bug" | "file_comment";
  title: string;
  description: string;
  filePath?: string;
}

export async function generateAIReview(
  repoPath: string,
  commitId?: string,
  skillIds?: string[],
): Promise<AIReviewData> {
  return invoke<AIReviewData>("generate_ai_review", {
    repoPath,
    commitId,
    skillIds,
  });
}

export async function fixAIReviewIssues(
  repoPath: string,
  issues: IssueToFix[],
): Promise<string> {
  return invoke<string>("fix_ai_review_issues", { repoPath, issues });
}

// Contributor Review
export interface ContributorReviewRequest {
  contributorName: string;
  contributorEmail: string;
  timeRangeLabel: string;
  commitSummaries: string[];
  totalCommits: number;
  totalFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
}

export interface ContributorReviewData {
  grade: string;
  commentary: string;
  highlights: string[];
  generatedAt: number;
}

export async function generateContributorReview(
  request: ContributorReviewRequest,
): Promise<ContributorReviewData> {
  return invoke<ContributorReviewData>("generate_contributor_review", { request });
}

// Worktrees
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  return invoke<WorktreeInfo[]>("list_worktrees", { repoPath });
}

export async function createWorktree(
  repoPath: string,
  options: WorktreeCreateOptions,
): Promise<WorktreeInfo> {
  return invoke<WorktreeInfo>("create_worktree", {
    repoPath,
    name: options.name,
    path: options.path,
    branch: options.branch,
    newBranch: options.newBranch,
  });
}

export async function removeWorktree(
  repoPath: string,
  worktreeName: string,
  force: boolean = false,
): Promise<void> {
  return invoke<void>("remove_worktree", { repoPath, worktreeName, force });
}

export async function lockWorktree(
  repoPath: string,
  worktreeName: string,
  reason?: string,
): Promise<void> {
  return invoke<void>("lock_worktree", { repoPath, worktreeName, reason });
}

export async function unlockWorktree(
  repoPath: string,
  worktreeName: string,
): Promise<void> {
  return invoke<void>("unlock_worktree", { repoPath, worktreeName });
}

// Stash operations
export async function listStashes(repoPath: string): Promise<StashEntry[]> {
  return invoke<StashEntry[]>("list_stashes", { repoPath });
}

export async function createStash(
  repoPath: string,
  message?: string,
): Promise<void> {
  return invoke<void>("create_stash", { repoPath, message });
}

export async function applyStash(
  repoPath: string,
  stashIndex: number,
): Promise<void> {
  return invoke<void>("apply_stash", { repoPath, stashIndex });
}

export async function popStash(
  repoPath: string,
  stashIndex: number,
): Promise<void> {
  return invoke<void>("pop_stash", { repoPath, stashIndex });
}

export async function dropStash(
  repoPath: string,
  stashIndex: number,
): Promise<void> {
  return invoke<void>("drop_stash", { repoPath, stashIndex });
}

// Ahead/Behind
export async function getAheadBehind(
  repoPath: string,
): Promise<AheadBehind | null> {
  return invoke<AheadBehind | null>("get_ahead_behind", { repoPath });
}

// Skills
export async function getSkillsDir(): Promise<string> {
  return invoke<string>("get_skills_dir");
}

export async function listSkills(): Promise<SkillMetadata[]> {
  return invoke<SkillMetadata[]>("list_skills");
}

export async function listRemoteSkills(): Promise<RemoteSkill[]> {
  return invoke<RemoteSkill[]>("list_remote_skills");
}

export async function installSkillFromUrl(url: string): Promise<SkillMetadata> {
  return invoke<SkillMetadata>("install_skill_from_url", { url });
}

export async function deleteSkill(skillId: string): Promise<void> {
  return invoke<void>("delete_skill", { skillId });
}

export async function getSkillContent(skillId: string): Promise<string> {
  return invoke<string>("get_skill_content", { skillId });
}

export async function getSkillRaw(skillId: string): Promise<string> {
  return invoke<string>("get_skill_raw", { skillId });
}

export async function updateSkill(
  skillId: string,
  content: string,
  newId?: string,
): Promise<SkillMetadata> {
  return invoke<SkillMetadata>("update_skill", { skillId, content, newId });
}

// Merge conflict operations
export async function getMergeStatus(repoPath: string): Promise<MergeStatus> {
  return invoke<MergeStatus>("get_merge_status", { repoPath });
}

export async function parseFileConflicts(
  repoPath: string,
  filePath: string,
): Promise<FileConflictInfo> {
  return invoke<FileConflictInfo>("parse_file_conflicts", {
    repoPath,
    filePath,
  });
}

export async function saveResolvedFile(
  repoPath: string,
  filePath: string,
  content: string,
): Promise<void> {
  return invoke<void>("save_resolved_file", { repoPath, filePath, content });
}

export async function markFileResolved(
  repoPath: string,
  filePath: string,
): Promise<void> {
  return invoke<void>("mark_file_resolved", { repoPath, filePath });
}

export async function abortMerge(repoPath: string): Promise<string> {
  return invoke<string>("abort_merge", { repoPath });
}

export async function continueMerge(repoPath: string): Promise<string> {
  return invoke<string>("continue_merge", { repoPath });
}

export async function mergeBranch(
  repoPath: string,
  branchName: string,
): Promise<string> {
  return invoke<string>("merge_branch", { repoPath, branchName });
}

export async function aiResolveConflict(
  filePath: string,
  oursContent: string,
  theirsContent: string,
  instructions?: string,
): Promise<AIResolveConflictResponse> {
  return invoke<AIResolveConflictResponse>("ai_resolve_conflict", {
    filePath,
    oursContent,
    theirsContent,
    instructions,
  });
}

// =============================================================================
// File Watcher
// =============================================================================

/**
 * Start watching a repository for file changes.
 * The watcher will emit 'repo_changed' events to the frontend.
 */
export async function startWatching(repoPath: string): Promise<void> {
  return invoke<void>("start_watching", { repoPath });
}

/**
 * Stop watching the current repository.
 */
export async function stopWatching(): Promise<void> {
  return invoke<void>("stop_watching");
}

/**
 * Event payload for repo_changed events.
 */
export interface RepoChangedEvent {
  repoPath: string;
  fileCount: number;
}
