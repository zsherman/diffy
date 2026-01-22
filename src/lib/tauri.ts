import { invoke } from '@tauri-apps/api/core';
import type {
  RepositoryInfo,
  BranchInfo,
  CommitInfo,
  CommitGraph,
  StatusInfo,
  UnifiedDiff,
  FileDiff,
  AIReviewData,
} from '../types/git';

// Repository
export async function openRepository(path: string): Promise<RepositoryInfo> {
  return invoke<RepositoryInfo>('open_repository', { path });
}

export async function discoverRepository(startPath: string): Promise<RepositoryInfo> {
  return invoke<RepositoryInfo>('discover_repository', { startPath });
}

// Branches
export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>('list_branches', { repoPath });
}

export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  return invoke<void>('checkout_branch', { repoPath, branchName });
}

// Commits
export async function getCommitHistory(
  repoPath: string,
  branch?: string,
  limit: number = 100,
  offset: number = 0
): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>('get_commit_history', { repoPath, branch, limit, offset });
}

export async function getCommitGraph(
  repoPath: string,
  commitIds: string[]
): Promise<CommitGraph> {
  return invoke<CommitGraph>('get_commit_graph', { repoPath, commitIds });
}

// Diff
export async function getCommitDiff(repoPath: string, commitId: string): Promise<UnifiedDiff> {
  return invoke<UnifiedDiff>('get_commit_diff', { repoPath, commitId });
}

export async function getFileDiff(
  repoPath: string,
  commitId: string,
  filePath: string
): Promise<FileDiff> {
  return invoke<FileDiff>('get_file_diff', { repoPath, commitId, filePath });
}

export async function getWorkingDiff(repoPath: string, staged: boolean): Promise<UnifiedDiff> {
  return invoke<UnifiedDiff>('get_working_diff', { repoPath, staged });
}

// Status
export async function getStatus(repoPath: string): Promise<StatusInfo> {
  return invoke<StatusInfo>('get_status', { repoPath });
}

// Staging
export async function stageFiles(repoPath: string, paths: string[]): Promise<void> {
  return invoke<void>('stage_files', { repoPath, paths });
}

export async function unstageFiles(repoPath: string, paths: string[]): Promise<void> {
  return invoke<void>('unstage_files', { repoPath, paths });
}

export async function discardChanges(repoPath: string, paths: string[]): Promise<void> {
  return invoke<void>('discard_changes', { repoPath, paths });
}

// Remote operations
export async function gitFetch(repoPath: string): Promise<string> {
  return invoke<string>('git_fetch', { repoPath });
}

export async function gitPull(repoPath: string): Promise<string> {
  return invoke<string>('git_pull', { repoPath });
}

export async function gitPush(repoPath: string): Promise<string> {
  return invoke<string>('git_push', { repoPath });
}

// Commit
export async function createCommit(repoPath: string, message: string): Promise<string> {
  return invoke<string>('create_commit', { repoPath, message });
}

// AI
export async function generateCommitMessage(repoPath: string): Promise<string> {
  return invoke<string>('generate_commit_message', { repoPath });
}

export interface IssueToFix {
  issueType: 'bug' | 'file_comment';
  title: string;
  description: string;
  filePath?: string;
}

export async function generateAIReview(repoPath: string, commitId?: string): Promise<AIReviewData> {
  const result = await invoke<{
    overview: string;
    potential_bugs: Array<{ title: string; description: string; severity: string }>;
    file_comments: Array<{ file_path: string; severity: string; title: string; explanation: string }>;
    generated_at: number;
  }>('generate_ai_review', { repoPath, commitId });

  // Transform snake_case to camelCase
  return {
    overview: result.overview,
    potentialBugs: result.potential_bugs.map((bug) => ({
      title: bug.title,
      description: bug.description,
      severity: bug.severity as 'low' | 'medium' | 'high',
    })),
    fileComments: result.file_comments.map((comment) => ({
      filePath: comment.file_path,
      severity: comment.severity as 'info' | 'warning' | 'error',
      title: comment.title,
      explanation: comment.explanation,
    })),
    generatedAt: result.generated_at,
  };
}

export async function fixAIReviewIssues(repoPath: string, issues: IssueToFix[]): Promise<string> {
  // Transform camelCase to snake_case for Rust
  const transformedIssues = issues.map((issue) => ({
    issue_type: issue.issueType,
    title: issue.title,
    description: issue.description,
    file_path: issue.filePath,
  }));

  return invoke<string>('fix_ai_review_issues', { repoPath, issues: transformedIssues });
}
