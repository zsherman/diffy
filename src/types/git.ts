export interface RepositoryInfo {
  path: string;
  name: string;
  is_bare: boolean;
  head_branch: string | null;
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
  upstream: string | null;
  commit_id: string;
  commit_message: string;
}

export interface CommitInfo {
  id: string;
  short_id: string;
  message: string;
  summary: string;
  author_name: string;
  author_email: string;
  time: number;
  parent_ids: string[];
  files_changed: number;
  additions: number;
  deletions: number;
}

export interface GraphNode {
  commit_id: string;
  column: number;
  connections: GraphConnection[];
}

export interface GraphConnection {
  from_column: number;
  to_column: number;
  to_row: number;
  is_merge: boolean;
}

export interface CommitGraph {
  nodes: GraphNode[];
  max_columns: number;
}

export interface FileStatus {
  path: string;
  status: string;
  is_staged: boolean;
}

export interface StatusInfo {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
}

export interface DiffFile {
  path: string;
  old_path: string | null;
  status: string;
  additions: number;
  deletions: number;
}

export interface UnifiedDiff {
  files: DiffFile[];
  patch: string;
}

export interface FileDiff {
  path: string;
  patch: string;
}

export type PanelId = 'branches' | 'commits' | 'files' | 'diff' | 'staging' | 'ai-review' | 'worktrees' | 'graph';

export interface RefInfo {
  name: string;
  type: 'branch' | 'tag' | 'remote';
  is_head: boolean;
}

export type ViewMode = 'working' | 'commit';

export interface AIReviewBug {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AIReviewFileComment {
  filePath: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  explanation: string;
}

export interface AIReviewData {
  overview: string;
  potentialBugs: AIReviewBug[];
  fileComments: AIReviewFileComment[];
  generatedAt: number;
}

export interface WorktreeInfo {
  name: string;
  path: string;
  head_branch: string | null;
  head_commit: string | null;
  is_main: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  is_prunable: boolean;
  is_dirty: boolean;
}

export interface WorktreeCreateOptions {
  name: string;
  path: string;
  branch?: string;
  newBranch?: string;
}
