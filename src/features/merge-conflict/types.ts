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
