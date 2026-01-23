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
  WorktreeInfo,
  WorktreeCreateOptions,
} from '../types/git';
import type { SkillMetadata } from '../types/skills';
import type {
  MergeStatus,
  FileConflictInfo,
  AIResolveConflictResponse,
} from '../features/merge-conflict/types';

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

export async function createBranch(repoPath: string, branchName: string, checkout: boolean = true): Promise<void> {
  return invoke<void>('create_branch', { repoPath, branchName, checkout });
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

export async function getCommitHistoryAllBranches(
  repoPath: string,
  limit: number = 100,
  offset: number = 0
): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>('get_commit_history_all_branches', { repoPath, limit, offset });
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

export async function generateAIReview(
  repoPath: string,
  commitId?: string,
  skillIds?: string[]
): Promise<AIReviewData> {
  const result = await invoke<{
    overview: string;
    potential_bugs: Array<{ title: string; description: string; severity: string }>;
    file_comments: Array<{ file_path: string; severity: string; title: string; explanation: string }>;
    generated_at: number;
  }>('generate_ai_review', { repoPath, commitId, skillIds });

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

// Worktrees
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  return invoke<WorktreeInfo[]>('list_worktrees', { repoPath });
}

export async function createWorktree(
  repoPath: string,
  options: WorktreeCreateOptions
): Promise<WorktreeInfo> {
  return invoke<WorktreeInfo>('create_worktree', {
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
  force: boolean = false
): Promise<void> {
  return invoke<void>('remove_worktree', { repoPath, worktreeName, force });
}

export async function lockWorktree(
  repoPath: string,
  worktreeName: string,
  reason?: string
): Promise<void> {
  return invoke<void>('lock_worktree', { repoPath, worktreeName, reason });
}

export async function unlockWorktree(repoPath: string, worktreeName: string): Promise<void> {
  return invoke<void>('unlock_worktree', { repoPath, worktreeName });
}

// Skills
export async function getSkillsDir(): Promise<string> {
  return invoke<string>('get_skills_dir');
}

export async function listSkills(): Promise<SkillMetadata[]> {
  const result = await invoke<
    Array<{ id: string; name: string; description: string; source_url?: string }>
  >('list_skills');

  // Transform snake_case to camelCase
  return result.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    sourceUrl: skill.source_url,
  }));
}

export async function installSkillFromUrl(url: string): Promise<SkillMetadata> {
  const result = await invoke<{
    id: string;
    name: string;
    description: string;
    source_url?: string;
  }>('install_skill_from_url', { url });

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    sourceUrl: result.source_url,
  };
}

export async function deleteSkill(skillId: string): Promise<void> {
  return invoke<void>('delete_skill', { skillId });
}

export async function getSkillContent(skillId: string): Promise<string> {
  return invoke<string>('get_skill_content', { skillId });
}

export async function getSkillRaw(skillId: string): Promise<string> {
  return invoke<string>('get_skill_raw', { skillId });
}

export async function updateSkill(
  skillId: string,
  content: string,
  newId?: string
): Promise<SkillMetadata> {
  const result = await invoke<{
    id: string;
    name: string;
    description: string;
    source_url?: string;
  }>('update_skill', { skillId, content, newId });

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    sourceUrl: result.source_url,
  };
}

// Merge conflict operations
export async function getMergeStatus(repoPath: string): Promise<MergeStatus> {
  const result = await invoke<{
    in_merge: boolean;
    conflicting_files: string[];
    their_branch: string | null;
  }>('get_merge_status', { repoPath });

  return {
    inMerge: result.in_merge,
    conflictingFiles: result.conflicting_files,
    theirBranch: result.their_branch,
  };
}

export async function parseFileConflicts(
  repoPath: string,
  filePath: string
): Promise<FileConflictInfo> {
  const result = await invoke<{
    file_path: string;
    conflicts: Array<{
      start_line: number;
      end_line: number;
      ours_content: string;
      theirs_content: string;
    }>;
    ours_full: string;
    theirs_full: string;
    original_content: string;
  }>('parse_file_conflicts', { repoPath, filePath });

  return {
    filePath: result.file_path,
    conflicts: result.conflicts.map((c) => ({
      startLine: c.start_line,
      endLine: c.end_line,
      oursContent: c.ours_content,
      theirsContent: c.theirs_content,
    })),
    oursFull: result.ours_full,
    theirsFull: result.theirs_full,
    originalContent: result.original_content,
  };
}

export async function saveResolvedFile(
  repoPath: string,
  filePath: string,
  content: string
): Promise<void> {
  return invoke<void>('save_resolved_file', { repoPath, filePath, content });
}

export async function markFileResolved(
  repoPath: string,
  filePath: string
): Promise<void> {
  return invoke<void>('mark_file_resolved', { repoPath, filePath });
}

export async function abortMerge(repoPath: string): Promise<string> {
  return invoke<string>('abort_merge', { repoPath });
}

export async function continueMerge(repoPath: string): Promise<string> {
  return invoke<string>('continue_merge', { repoPath });
}

export async function mergeBranch(
  repoPath: string,
  branchName: string
): Promise<string> {
  return invoke<string>('merge_branch', { repoPath, branchName });
}

export async function aiResolveConflict(
  filePath: string,
  oursContent: string,
  theirsContent: string,
  instructions?: string
): Promise<AIResolveConflictResponse> {
  return invoke<AIResolveConflictResponse>('ai_resolve_conflict', {
    filePath,
    oursContent,
    theirsContent,
    instructions,
  });
}
