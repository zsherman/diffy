export interface RepositoryInfo {
  path: string;
  name: string;
  isBare: boolean;
  headBranch: string | null;
}

export interface BranchInfo {
  name: string;
  isHead: boolean;
  isRemote: boolean;
  upstream: string | null;
  commitId: string;
  commitMessage: string;
}

export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  summary: string;
  authorName: string;
  authorEmail: string;
  time: number;
  parentIds: string[];
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface GraphNode {
  commitId: string;
  column: number;
  connections: GraphConnection[];
}

export interface GraphConnection {
  fromColumn: number;
  toColumn: number;
  toRow: number;
  isMerge: boolean;
}

export interface CommitGraph {
  nodes: GraphNode[];
  maxColumns: number;
}

export interface FileStatus {
  path: string;
  status: string;
  isStaged: boolean;
}

export interface StatusInfo {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
}

export interface DiffFile {
  path: string;
  oldPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  // Extended metadata (additive fields for richer diff info)
  /** Whether the file is binary */
  isBinary?: boolean;
  /** Old file mode (e.g., 0o100644 for regular file, 0o120000 for symlink) */
  oldMode?: number;
  /** New file mode */
  newMode?: number;
  /** Similarity score for renames/copies (0-100) */
  similarity?: number;
  /** Whether file is a symlink (derived from mode) */
  isSymlink?: boolean;
  /** Whether file is a submodule */
  isSubmodule?: boolean;
}

export interface UnifiedDiff {
  files: DiffFile[];
  patch: string;
}

export interface FileDiff {
  path: string;
  patch: string;
}

export type PanelId = 'branches' | 'commits' | 'files' | 'diff' | 'staging' | 'ai-review' | 'worktrees' | 'graph' | 'merge-conflict';

export interface RefInfo {
  name: string;
  type: 'branch' | 'tag' | 'remote';
  isHead: boolean;
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
  headBranch: string | null;
  headCommit: string | null;
  isMain: boolean;
  isLocked: boolean;
  lockReason: string | null;
  isPrunable: boolean;
  isDirty: boolean;
}

export interface WorktreeCreateOptions {
  name: string;
  path: string;
  branch?: string;
  newBranch?: string;
}

export interface StashEntry {
  stashIndex: number;
  message: string;
  oid: string;
  time: number;
}
