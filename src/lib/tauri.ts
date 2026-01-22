import { invoke } from '@tauri-apps/api/core';
import type {
  RepositoryInfo,
  BranchInfo,
  CommitInfo,
  CommitGraph,
  StatusInfo,
  UnifiedDiff,
  FileDiff,
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
