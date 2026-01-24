export interface MergeStatus {
  inMerge: boolean;
  conflictingFiles: string[];
  theirBranch: string | null;
}

export interface RebaseStatus {
  inRebase: boolean;
  conflictingFiles: string[];
  ontoRef: string | null;
}

export interface ConflictRegion {
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
}

export interface FileConflictInfo {
  filePath: string;
  conflicts: ConflictRegion[];
  oursFull: string;
  theirsFull: string;
  originalContent: string;
}

export interface AIResolveConflictResponse {
  resolved: string;
  explanation: string;
}

// Interactive rebase types
export type RebaseTodoAction =
  | "pick"
  | "reword"
  | "edit"
  | "squash"
  | "fixup"
  | "drop";

export interface InteractiveRebaseCommit {
  id: string;
  shortId: string;
  summary: string;
  message: string;
  authorName: string;
  authorEmail: string;
  time: number;
}

export interface InteractiveRebasePlanEntry {
  commitId: string;
  action: RebaseTodoAction;
  newMessage?: string;
}

export type RebaseStopReason =
  | "none"
  | "conflict"
  | "edit"
  | "reword"
  | "squashMessage"
  | "other";

export interface InteractiveRebaseState {
  inRebase: boolean;
  isInteractive: boolean;
  currentStep: number | null;
  totalSteps: number | null;
  stopReason: RebaseStopReason;
  stoppedCommitId: string | null;
  conflictingFiles: string[];
  ontoRef: string | null;
  currentMessage: string | null;
}
