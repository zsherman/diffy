import { useMemo, useState, memo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@base-ui/react/combobox";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import {
  GitMerge,
  GitBranch,
  CaretUpDown,
  Check,
  CaretRight,
  CaretDown,
  File,
  Warning,
  ArrowRight,
  Sparkle,
  CheckCircle,
  XCircle,
  Clock,
  ChatCircle,
  PencilSimple,
  DotsThree,
  ThumbsUp,
  Flag,
  User,
} from "@phosphor-icons/react";
import {
  listBranches,
  getCompareDiff,
  getCommitRange,
} from "../../../lib/tauri";
import {
  useTabsStore,
  useActiveTabCompare,
} from "../../../stores/tabs-store";
import { useDiffSettings } from "../../../stores/ui-store";
import { getTheme, isLightTheme } from "../../../lib/themes";
import { AuthorAvatar } from "../../graph/components/AuthorAvatar";
import { AIReviewContent } from "../../ai-review/components";
import { LoadingSpinner, SkeletonDiff } from "../../../components/ui";
import type { BranchInfo, CommitInfo } from "../../../types/git";

// Threshold for auto-collapsing large diffs
const LARGE_DIFF_THRESHOLD = 500;

// Comment type for inline review comments
interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number;
  author: string;
  authorEmail: string;
  content: string;
  timestamp: number;
  reactions?: { emoji: string; count: number }[];
  replies?: ReviewComment[];
}

// Calculate total lines in a diff
function getDiffLineCount(fileDiff: any): number {
  if (!fileDiff?.hunks) return 0;
  return fileDiff.hunks.reduce((total: number, hunk: any) => {
    return total + (hunk.unifiedLineCount || 0);
  }, 0);
}

// Calculate additions and deletions from hunks
function getDiffStats(fileDiff: any): { additions: number; deletions: number } {
  if (!fileDiff?.hunks) return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  for (const hunk of fileDiff.hunks) {
    additions += hunk.additionCount || 0;
    deletions += hunk.deletionCount || 0;
  }
  return { additions, deletions };
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

// Ref selector component (simplified branch picker)
function RefSelector({
  value,
  onChange,
  branches,
  label,
}: {
  value: string | null;
  onChange: (ref: string) => void;
  branches: BranchInfo[];
  label: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  const filteredBranches = useMemo(() => {
    if (!inputValue) return branches;
    const lower = inputValue.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(lower));
  }, [branches, inputValue]);

  const selectedBranch = branches.find((b) => b.name === value);

  const handleSelect = (branch: BranchInfo | null) => {
    if (branch) {
      onChange(branch.name);
    }
    setOpen(false);
  };

  return (
    <Combobox.Root<BranchInfo>
      value={selectedBranch ?? null}
      onValueChange={handleSelect}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      itemToStringLabel={(branch) => branch?.name ?? ""}
      isItemEqualToValue={(a, b) => a.name === b.name}
      open={open}
      onOpenChange={setOpen}
    >
      <Combobox.Trigger className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-tertiary border border-border-primary rounded-md hover:bg-bg-hover transition-colors cursor-pointer text-sm">
        <GitBranch size={12} className="text-text-muted shrink-0" />
        <span className="text-text-primary truncate max-w-[120px]">
          {selectedBranch?.name ?? value ?? label}
        </span>
        <CaretUpDown size={10} className="text-text-muted shrink-0" />
      </Combobox.Trigger>
      <Combobox.Portal keepMounted>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="w-[280px] max-h-[300px] overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-xl outline-hidden">
            <div className="p-2 border-b border-border-primary">
              <Combobox.Input
                placeholder="Search branches..."
                autoFocus
                className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-hidden"
              />
            </div>
            <Combobox.List className="overflow-auto max-h-[240px] p-1">
              {filteredBranches.map((branch) => (
                <Combobox.Item
                  key={branch.name}
                  value={branch}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary rounded-md cursor-pointer data-highlighted:bg-bg-hover outline-none"
                >
                  <Combobox.ItemIndicator className="w-4">
                    <Check size={14} className="text-accent-green" />
                  </Combobox.ItemIndicator>
                  <GitBranch size={14} className="text-text-muted shrink-0" />
                  <span className="truncate flex-1">{branch.name}</span>
                </Combobox.Item>
              ))}
            </Combobox.List>
            {filteredBranches.length === 0 && (
              <div className="px-3 py-2 text-sm text-text-muted text-center">
                No branches found
              </div>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

// Inline comment card component
const InlineComment = memo(function InlineComment({
  comment,
  onReply,
}: {
  comment: ReviewComment;
  onReply?: (commentId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(true);
  
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden my-2 mx-4">
      {/* Comment header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border-b border-border-primary">
        <AuthorAvatar email={comment.authorEmail} size={20} />
        <span className="text-sm font-medium text-text-primary">{comment.author}</span>
        <span className="text-xs text-text-muted">{formatTimeAgo(comment.timestamp)}</span>
        <div className="flex-1" />
        <button className="p-1 hover:bg-bg-hover rounded-sm text-text-muted hover:text-text-primary transition-colors">
          <DotsThree size={14} weight="bold" />
        </button>
      </div>
      
      {/* Comment body */}
      <div className="px-3 py-2">
        <p className="text-sm text-text-primary leading-relaxed">{comment.content}</p>
      </div>
      
      {/* Reactions and actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-primary">
        {comment.reactions?.map((reaction, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary rounded-full text-xs">
            {reaction.emoji} {reaction.count}
          </span>
        ))}
        <div className="flex-1" />
        <button className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors">
          <ThumbsUp size={12} />
        </button>
        <button className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors">
          <Flag size={12} />
        </button>
        {onReply && (
          <button
            onClick={() => onReply(comment.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
          >
            <ChatCircle size={12} />
            Reply
          </button>
        )}
      </div>
      
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-t border-border-primary">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="w-full px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover flex items-center gap-1 transition-colors"
          >
            {showReplies ? <CaretDown size={10} /> : <CaretRight size={10} />}
            {showReplies ? "Hide" : "Show"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
          </button>
          {showReplies && (
            <div className="pl-4 border-l-2 border-border-primary ml-3 mb-2">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="py-2 px-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AuthorAvatar email={reply.authorEmail} size={16} />
                    <span className="text-xs font-medium text-text-primary">{reply.author}</span>
                    <span className="text-xs text-text-muted">{formatTimeAgo(reply.timestamp)}</span>
                  </div>
                  <p className="text-sm text-text-primary pl-6">{reply.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Commit row in the stack with status indicator
const CommitStackRow = memo(function CommitStackRow({
  commit,
  status,
  isSelected,
  onClick,
}: {
  commit: CommitInfo;
  status?: "ready" | "pending" | "failed";
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const statusIcon = {
    ready: <CheckCircle size={14} weight="fill" className="text-accent-green" />,
    pending: <Clock size={14} weight="fill" className="text-accent-yellow" />,
    failed: <XCircle size={14} weight="fill" className="text-accent-red" />,
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors ${
        isSelected ? "bg-bg-selected" : ""
      }`}
    >
      {/* Timeline indicator */}
      <div className="flex flex-col items-center pt-1">
        <div className="w-2 h-2 rounded-full bg-accent-blue" />
        <div className="w-px h-full bg-border-primary min-h-[20px]" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <AuthorAvatar email={commit.authorEmail} size={18} />
          {status && statusIcon[status]}
        </div>
        <div className="text-sm text-text-primary truncate mt-1">
          {commit.summary}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
          {commit.additions > 0 && <span className="text-accent-green">+{commit.additions}</span>}
          {commit.deletions > 0 && <span className="text-accent-red">-{commit.deletions}</span>}
          <span>{formatTimeAgo(commit.time)}</span>
        </div>
      </div>
    </button>
  );
});

// Collapsible file diff with inline comments support
const CollapsibleFileDiffWithComments = memo(function CollapsibleFileDiffWithComments({
  fileDiff,
  diffStyle,
  defaultCollapsed,
  fontSize,
  diffsTheme,
  themeType,
  comments,
  _onAddComment,
}: {
  fileDiff: any;
  diffStyle: "split" | "unified";
  defaultCollapsed?: boolean;
  fontSize: number;
  diffsTheme: string;
  themeType: "light" | "dark";
  comments?: ReviewComment[];
  _onAddComment?: (filePath: string, lineNumber: number) => void;
}) {
  const lineCount = getDiffLineCount(fileDiff);
  const isLargeDiff = lineCount > LARGE_DIFF_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(
    defaultCollapsed ?? isLargeDiff
  );
  const { additions, deletions } = getDiffStats(fileDiff);

  const currentName = (fileDiff.name || "").replace(/^[ab]\//, "");
  const previousName = (fileDiff.prevName || "").replace(/^[ab]\//, "");
  const isRenamed = previousName && previousName !== currentName;
  const displayName = currentName || previousName || "Unknown file";
  
  // Get comments for this file
  const fileComments = comments?.filter(c => c.filePath === currentName || c.filePath === displayName) || [];

  return (
    <div className="border border-border-primary rounded-lg overflow-hidden mb-3">
      {/* File header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
      >
        {isCollapsed ? (
          <CaretRight size={14} weight="bold" className="text-text-muted shrink-0" />
        ) : (
          <CaretDown size={14} weight="bold" className="text-text-muted shrink-0" />
        )}
        <File size={14} weight="bold" className="text-accent-blue shrink-0" />
        {isRenamed ? (
          <span className="text-text-primary text-sm truncate">
            {previousName} <span className="text-text-muted">→</span> {currentName}
          </span>
        ) : (
          <span className="text-text-primary text-sm truncate">{displayName}</span>
        )}
        <div className="flex-1" />
        {fileComments.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-text-muted mr-2">
            <ChatCircle size={12} />
            {fileComments.length}
          </span>
        )}
        {isLargeDiff && isCollapsed && (
          <span className="flex items-center gap-1 text-xs text-accent-yellow mr-2">
            <Warning size={12} weight="bold" />
            Large
          </span>
        )}
        <span className="flex items-center gap-2 text-xs shrink-0">
          {deletions > 0 && (
            <span className="text-accent-red">-{deletions}</span>
          )}
          {additions > 0 && (
            <span className="text-accent-green">+{additions}</span>
          )}
        </span>
      </button>
      
      {!isCollapsed && (
        <div className="relative">
          <div
            style={{ "--diffs-font-size": `${fontSize}px` } as React.CSSProperties}
          >
            <FileDiff
              fileDiff={fileDiff}
              options={{
                diffStyle,
                theme: diffsTheme,
                themeType,
                disableFileHeader: true,
              }}
            />
          </div>
          
          {/* Render inline comments after the diff */}
          {fileComments.length > 0 && (
            <div className="border-t border-border-primary bg-bg-primary">
              {fileComments.map((comment) => (
                <InlineComment key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Compare page header with PR-style info
function ComparePageHeader({
  baseRef,
  headRef,
  setBaseRef,
  setHeadRef,
  branches,
  commits,
  fileCount,
  additions,
  deletions,
}: {
  baseRef: string | null;
  headRef: string | null;
  setBaseRef: (ref: string) => void;
  setHeadRef: (ref: string) => void;
  branches: BranchInfo[];
  commits: CommitInfo[];
  fileCount: number;
  additions: number;
  deletions: number;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(true);
  const [stackExpanded, setStackExpanded] = useState(true);
  
  // Get the most recent commit for author info
  const latestCommit = commits[0];
  
  // Generate a summary from commits
  const summary = useMemo(() => {
    if (commits.length === 0) return null;
    if (commits.length === 1) return commits[0].summary;
    return `${commits.length} commits from ${baseRef} to ${headRef}`;
  }, [commits, baseRef, headRef]);

  return (
    <div className="border-b border-border-primary bg-bg-primary">
      {/* Title section */}
      <div className="px-4 py-4">
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Compare: {baseRef} → {headRef}
        </h1>
        
        {/* Meta info row */}
        <div className="flex items-center gap-3 text-sm">
          {latestCommit && (
            <>
              <div className="flex items-center gap-1.5">
                <AuthorAvatar email={latestCommit.authorEmail} size={20} />
                <span className="text-text-primary">{latestCommit.authorName}</span>
              </div>
              <span className="text-text-muted">•</span>
            </>
          )}
          
          {/* Branch selector */}
          <div className="flex items-center gap-1.5">
            <RefSelector
              value={baseRef}
              onChange={setBaseRef}
              branches={branches}
              label="base"
            />
            <ArrowRight size={12} className="text-text-muted" />
            <RefSelector
              value={headRef}
              onChange={setHeadRef}
              branches={branches}
              label="head"
            />
          </div>
          
          <span className="text-text-muted">•</span>
          
          {/* Stats */}
          <span className="text-text-muted">{fileCount} files</span>
          {additions > 0 && (
            <span className="text-accent-green">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-accent-red">-{deletions}</span>
          )}
          
          {latestCommit && (
            <>
              <span className="text-text-muted">•</span>
              <span className="text-text-muted">Updated {formatTimeAgo(latestCommit.time)}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Stack section */}
      {commits.length > 0 && (
        <div className="border-t border-border-primary">
          <button
            onClick={() => setStackExpanded(!stackExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-bg-hover transition-colors text-left"
          >
            {stackExpanded ? (
              <CaretDown size={14} weight="bold" className="text-text-muted" />
            ) : (
              <CaretRight size={14} weight="bold" className="text-text-muted" />
            )}
            <span className="text-sm font-medium text-text-primary">Stack</span>
            <span className="text-xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">
              {commits.length} of {commits.length}
            </span>
          </button>
          
          {stackExpanded && (
            <div className="px-4 pb-3">
              {commits.slice(0, 5).map((commit) => (
                <CommitStackRow
                  key={commit.id}
                  commit={commit}
                  status="ready"
                />
              ))}
              {commits.length > 5 && (
                <div className="text-xs text-text-muted pl-6 pt-2">
                  +{commits.length - 5} more commits
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Description section */}
      {summary && (
        <div className="border-t border-border-primary">
          <button
            onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-bg-hover transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              {descriptionExpanded ? (
                <CaretDown size={14} weight="bold" className="text-text-muted" />
              ) : (
                <CaretRight size={14} weight="bold" className="text-text-muted" />
              )}
              <span className="text-sm font-medium text-text-primary">Description</span>
            </div>
            <button className="p-1 hover:bg-bg-tertiary rounded text-text-muted hover:text-text-primary">
              <PencilSimple size={14} />
            </button>
          </button>
          
          {descriptionExpanded && (
            <div className="px-4 pb-4">
              <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-2">Summary</h3>
                <p className="text-sm text-text-primary leading-relaxed">
                  {commits.length === 1 
                    ? commits[0].message 
                    : `This comparison shows ${commits.length} commits with changes across ${fileCount} files.`
                  }
                </p>
                
                {commits.length > 1 && (
                  <>
                    <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Changes Included</h3>
                    <ul className="list-disc list-inside text-sm text-text-primary space-y-1">
                      {commits.slice(0, 5).map((commit) => (
                        <li key={commit.id}>{commit.summary}</li>
                      ))}
                      {commits.length > 5 && (
                        <li className="text-text-muted">...and {commits.length - 5} more</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Empty state when no refs selected
function EmptyState({
  branches,
  setBaseRef,
  setHeadRef,
}: {
  branches: BranchInfo[];
  setBaseRef: (ref: string) => void;
  setHeadRef: (ref: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <GitMerge size={64} weight="duotone" className="text-text-muted mb-4" />
      <h2 className="text-xl font-medium text-text-primary mb-2">Compare Branches</h2>
      <p className="text-text-muted text-sm mb-6 text-center max-w-md">
        Select a base and head branch to compare changes between them.
      </p>
      <div className="flex items-center gap-2">
        <RefSelector
          value={null}
          onChange={setBaseRef}
          branches={branches}
          label="Select base"
        />
        <ArrowRight size={16} className="text-text-muted" />
        <RefSelector
          value={null}
          onChange={setHeadRef}
          branches={branches}
          label="Select head"
        />
      </div>
    </div>
  );
}

export function CompareView() {
  const { repository } = useTabsStore();
  const {
    compareBaseRef,
    compareHeadRef,
    compareSelectedFile,
    setCompareBaseRef,
    setCompareHeadRef,
    setCompareSelectedFile,
  } = useActiveTabCompare();
  const { theme, diffViewMode, diffFontSize } = useDiffSettings();
  const diffsTheme = getTheme(theme)?.diffsTheme ?? "pierre-dark";
  const themeType = isLightTheme(theme) ? "light" : "dark";
  
  // Demo comments state (in real app, this would come from a backend)
  const [comments] = useState<ReviewComment[]>([]);

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ["branches", repository?.path],
    queryFn: () => listBranches(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
  });

  // Initialize refs to sensible defaults
  useEffect(() => {
    if (!repository || branches.length === 0) return;
    
    // Find main/master branch for base
    if (!compareBaseRef) {
      const mainBranch = branches.find(
        (b) => !b.isRemote && (b.name === "main" || b.name === "master")
      );
      if (mainBranch) {
        setCompareBaseRef(mainBranch.name);
      } else if (branches.length > 0) {
        const firstLocal = branches.find((b) => !b.isRemote);
        if (firstLocal) setCompareBaseRef(firstLocal.name);
      }
    }
    
    if (!compareHeadRef && repository.headBranch) {
      setCompareHeadRef(repository.headBranch);
    }
  }, [repository, branches, compareBaseRef, compareHeadRef, setCompareBaseRef, setCompareHeadRef]);

  // Fetch commit range
  const { data: commits = [] } = useQuery({
    queryKey: ["commit-range", repository?.path, compareBaseRef, compareHeadRef],
    queryFn: () => getCommitRange(repository!.path, compareBaseRef!, compareHeadRef!, 100),
    enabled: !!repository?.path && !!compareBaseRef && !!compareHeadRef && compareBaseRef !== compareHeadRef,
    staleTime: 30000,
  });

  // Fetch compare diff
  const { data: compareDiff, isLoading: diffLoading } = useQuery({
    queryKey: ["compare-diff", repository?.path, compareBaseRef, compareHeadRef],
    queryFn: () => getCompareDiff(repository!.path, compareBaseRef!, compareHeadRef!),
    enabled: !!repository?.path && !!compareBaseRef && !!compareHeadRef && compareBaseRef !== compareHeadRef,
    staleTime: 30000,
  });

  // Parse diff patches
  const parsedFiles = useMemo(() => {
    if (!compareDiff?.patch) return [];
    try {
      const parsed = parsePatchFiles(compareDiff.patch);
      return parsed.flatMap((p) => p.files);
    } catch (e) {
      console.error("Failed to parse compare diff:", e);
      return [];
    }
  }, [compareDiff]);

  // Filter files if one is selected
  const filesToShow = useMemo(() => {
    if (!compareSelectedFile) return parsedFiles;
    return parsedFiles.filter((f: any) => {
      const name = f.name || "";
      const prevName = f.prevName || "";
      const cleanName = name.replace(/^[ab]\//, "");
      const cleanPrev = prevName.replace(/^[ab]\//, "");
      return (
        name === compareSelectedFile ||
        prevName === compareSelectedFile ||
        cleanName === compareSelectedFile ||
        cleanPrev === compareSelectedFile
      );
    });
  }, [parsedFiles, compareSelectedFile]);

  // Calculate totals
  const totalAdditions = compareDiff?.files.reduce((sum, f) => sum + f.additions, 0) ?? 0;
  const totalDeletions = compareDiff?.files.reduce((sum, f) => sum + f.deletions, 0) ?? 0;

  // Filter to local branches only
  const localBranches = branches.filter((b) => !b.isRemote);

  // Show empty state if no refs selected or same ref
  const showEmptyState = !compareBaseRef || !compareHeadRef || compareBaseRef === compareHeadRef;

  if (!repository) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <p className="text-text-muted">No repository selected</p>
      </div>
    );
  }

  if (showEmptyState) {
    return (
      <div className="flex-1 flex flex-col bg-bg-primary">
        <EmptyState
          branches={localBranches}
          setBaseRef={setCompareBaseRef}
          setHeadRef={setCompareHeadRef}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
      {/* Main layout: scrollable content with fixed sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Main scrollable content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          {/* Header section */}
          <ComparePageHeader
            baseRef={compareBaseRef}
            headRef={compareHeadRef}
            setBaseRef={setCompareBaseRef}
            setHeadRef={setCompareHeadRef}
            branches={localBranches}
            commits={commits}
            fileCount={compareDiff?.files.length ?? 0}
            additions={totalAdditions}
            deletions={totalDeletions}
          />
          
          {/* Diff section header */}
          <div className="px-4 py-2 border-b border-border-primary bg-bg-tertiary flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                Files changed ({compareDiff?.files.length ?? 0})
              </span>
            </div>
            {compareSelectedFile && (
              <button
                onClick={() => setCompareSelectedFile(null)}
                className="text-xs text-accent-blue hover:text-accent-blue/80"
              >
                Show all files
              </button>
            )}
          </div>
          
          {/* Diff content - scrolls with comments */}
          <div className="flex-1 p-4">
            {diffLoading ? (
              <div className="flex flex-col">
                <div className="flex items-center py-3">
                  <LoadingSpinner size="sm" message="Loading diffs..." />
                </div>
                <SkeletonDiff lines={12} />
              </div>
            ) : filesToShow.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <GitMerge size={48} weight="duotone" className="text-text-muted mb-3" />
                <p className="text-text-primary font-medium mb-1">No changes</p>
                <p className="text-text-muted text-sm">These branches have no differences</p>
              </div>
            ) : (
              filesToShow.map((fileDiff: any, index) => (
                <CollapsibleFileDiffWithComments
                  key={fileDiff.name || fileDiff.prevName || index}
                  fileDiff={fileDiff}
                  diffStyle={diffViewMode === "split" ? "split" : "unified"}
                  fontSize={diffFontSize}
                  diffsTheme={diffsTheme}
                  themeType={themeType}
                  comments={comments}
                />
              ))
            )}
          </div>
        </div>

        {/* Right sidebar: AI Review + metadata (fixed) */}
        <div className="w-80 border-l border-border-primary flex flex-col bg-bg-secondary">
          {/* AI Review section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary flex items-center gap-2">
              <Sparkle size={14} weight="bold" className="text-accent-purple" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                AI Review
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <AIReviewContent />
            </div>
          </div>
          
          {/* Reviewers section */}
          <div className="border-t border-border-primary">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                Reviewers
              </span>
              <button className="text-text-muted hover:text-text-primary">
                <User size={14} />
              </button>
            </div>
            <div className="px-3 pb-3 text-xs text-text-muted">
              No reviewers assigned
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
