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

export type PanelId = 'branches' | 'commits' | 'files' | 'diff' | 'staging';

export type ViewMode = 'working' | 'commit';
