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

export type PanelId =
  | "branches"
  | "commits"
  | "files"
  | "file-tree"
  | "diff"
  | "staging"
  | "ai-review"
  | "worktrees"
  | "graph"
  | "merge-conflict"
  | "reflog"
  | "mermaid-changes"
  | "codeflow";

export interface RefInfo {
  name: string;
  type: "branch" | "tag" | "remote";
  isHead: boolean;
}

export type ViewMode = "working" | "commit";

export type AIReviewCategory =
  | "logic_bugs"
  | "edge_cases"
  | "security"
  | "performance"
  | "accidental_code"
  | "other";

export type AIReviewSeverity = "low" | "medium" | "high" | "critical";

export interface AIReviewIssue {
  id: string;
  category: AIReviewCategory;
  severity: AIReviewSeverity;
  title: string;
  problem: string;
  why: string;
  suggestion: string;
  filePath?: string;
}

export interface AIReviewData {
  overview: string;
  issues: AIReviewIssue[];
  generatedAt: number;
}

export type AIReviewReviewerId = "claude-cli" | "coderabbit-cli";

export interface StructuredReviewResult {
  kind: "structured";
  providerId: AIReviewReviewerId;
  data: AIReviewData;
}

export interface TextReviewResult {
  kind: "text";
  providerId: AIReviewReviewerId;
  content: string;
  generatedAt: number;
  format: "plain";
}

// Parsed CodeRabbit issue
export interface CodeRabbitIssue {
  file: string;
  lines: string; // e.g., "12-15" or "42"
  type: string; // e.g., "Bug Risk", "Performance", "Security"
  severity?: string;
  description: string;
  suggestedFix?: string;
  aiAgentPrompt?: string;
}

export interface CodeRabbitReviewResult {
  kind: "coderabbit";
  providerId: "coderabbit-cli";
  issues: CodeRabbitIssue[];
  rawContent: string; // Keep raw content for fallback
  generatedAt: number;
}

export type ReviewResult = StructuredReviewResult | TextReviewResult | CodeRabbitReviewResult;

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

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface ReflogEntry {
  selector: string;
  oid: string;
  shortOid: string;
  message: string;
  time: number;
}

export interface CommitActivity {
  time: number;
  authorName: string;
  authorEmail: string;
}

export interface ChangelogCommit {
  id: string;
  shortId: string;
  time: number;
  authorName: string;
  authorEmail: string;
  summary: string;
  message: string;
}
