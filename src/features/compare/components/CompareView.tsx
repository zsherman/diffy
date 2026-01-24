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
  DotsThree,
  Wrench,
  PencilSimple,
} from "@phosphor-icons/react";
import {
  listBranches,
  getCompareDiff,
  getCommitRange,
  generateReview,
} from "../../../lib/tauri";
import {
  useTabsStore,
  useActiveTabCompare,
} from "../../../stores/tabs-store";
import { useDiffSettings, useUIStore } from "../../../stores/ui-store";
import { getTheme, isLightTheme } from "../../../lib/themes";
import { AuthorAvatar } from "../../graph/components/AuthorAvatar";
import { LoadingSpinner, SkeletonDiff } from "../../../components/ui";
import type { BranchInfo, CommitInfo, AIReviewIssue, CodeRabbitIssue, ReviewResult } from "../../../types/git";

// Threshold for auto-collapsing large diffs
const LARGE_DIFF_THRESHOLD = 500;

// Comment type for inline review comments
interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber?: number; // Line number or range (e.g., "12-15")
  lineRange?: string;
  author: string;
  authorEmail: string;
  content: string;
  title?: string;
  timestamp: number;
  reactions?: { emoji: string; count: number }[];
  replies?: ReviewComment[];
  // AI review specific fields
  category?: string;
  severity?: "critical" | "high" | "medium" | "low";
  suggestion?: string;
  isAIGenerated?: boolean;
}

// Category colors for AI issues (reserved for future use)
const _CATEGORY_COLORS: Record<string, string> = {
  logic_bugs: "bg-accent-red/20 text-accent-red border-accent-red/30",
  edge_cases: "bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30",
  security: "bg-accent-red/20 text-accent-red border-accent-red/30",
  performance: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  accidental_code: "bg-text-muted/20 text-text-muted border-text-muted/30",
  "Bug Risk": "bg-accent-red/20 text-accent-red border-accent-red/30",
  Performance: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  Security: "bg-accent-red/20 text-accent-red border-accent-red/30",
  Improvement: "bg-accent-purple/20 text-accent-purple border-accent-purple/30",
  other: "bg-text-muted/20 text-text-muted border-text-muted/30",
};

// Severity colors (reserved for future use)
const _SEVERITY_COLORS: Record<string, string> = {
  critical: "text-accent-red",
  high: "text-accent-red",
  medium: "text-accent-yellow",
  low: "text-text-muted",
};

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

// Inline comment card component - matches reference design
const InlineComment = memo(function InlineComment({
  comment,
  onFix,
}: {
  comment: ReviewComment;
  onFix?: (comment: ReviewComment) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-lg overflow-hidden">
      {/* Header row with author and actions */}
      <div className="flex items-center gap-2 px-4 py-3">
        {comment.isAIGenerated ? (
          <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center">
            <Sparkle size={16} weight="fill" className="text-accent-purple" />
          </div>
        ) : (
          <AuthorAvatar email={comment.authorEmail} size={32} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary text-sm">
              {comment.isAIGenerated ? "AI Review" : comment.author}
            </span>
            <span className="text-xs text-text-muted">{formatTimeAgo(comment.timestamp)}</span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button 
            className="p-1.5 hover:bg-bg-hover rounded text-text-muted hover:text-accent-green transition-colors"
            title="Resolve"
          >
            <Check size={16} />
          </button>
          {comment.isAIGenerated && onFix && (
            <button 
              onClick={() => onFix(comment)}
              className="p-1.5 hover:bg-bg-hover rounded text-text-muted hover:text-accent-purple transition-colors"
              title="Apply fix"
            >
              <Wrench size={16} />
            </button>
          )}
          <button 
            className="p-1.5 hover:bg-bg-hover rounded text-text-muted hover:text-text-primary transition-colors"
            title="React"
          >
            <span className="text-sm">😊</span>
          </button>
          <button className="p-1.5 hover:bg-bg-hover rounded text-text-muted hover:text-text-primary transition-colors">
            <DotsThree size={16} weight="bold" />
          </button>
        </div>
      </div>
      
      {/* Comment content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-text-primary leading-relaxed">{comment.content}</p>
        
        {/* Suggestion */}
        {comment.suggestion && (
          <div className="mt-3 p-3 bg-accent-green/5 border border-accent-green/20 rounded-md">
            <p className="text-sm text-text-primary">{comment.suggestion}</p>
          </div>
        )}
      </div>
      
      {/* Reactions */}
      {comment.reactions && comment.reactions.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2">
          {comment.reactions.map((reaction, i) => (
            <span 
              key={i} 
              className="inline-flex items-center gap-1 px-2 py-1 bg-bg-tertiary hover:bg-bg-hover rounded-full text-xs cursor-pointer transition-colors"
            >
              {reaction.emoji} {reaction.count}
            </span>
          ))}
        </div>
      )}
      
      {/* Replies section */}
      {comment.replies && comment.replies.length > 0 && (
        <>
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="w-full px-4 py-2 text-sm text-accent-blue hover:bg-bg-hover text-left transition-colors"
          >
            {showReplies ? "Hide" : "Show"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
          </button>
          
          {showReplies && (
            <div className="border-t border-border-primary">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="px-4 py-3 border-b border-border-primary last:border-b-0">
                  <div className="flex items-center gap-2 mb-2">
                    <AuthorAvatar email={reply.authorEmail} size={24} />
                    <span className="text-sm font-medium text-text-primary">{reply.author}</span>
                    <span className="text-xs text-text-muted">{formatTimeAgo(reply.timestamp)}</span>
                  </div>
                  <p className="text-sm text-text-primary pl-8">{reply.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
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

// Collapsible file diff with floating comments
const CollapsibleFileDiff = memo(function CollapsibleFileDiff({
  fileDiff,
  defaultCollapsed,
  fontSize,
  diffsTheme,
  themeType,
  comments = [],
  onFix,
  showFloatingComments = false,
}: {
  fileDiff: any;
  defaultCollapsed?: boolean;
  fontSize: number;
  diffsTheme: string;
  themeType: "light" | "dark";
  comments?: ReviewComment[];
  onFix?: (comment: ReviewComment) => void;
  showFloatingComments?: boolean;
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
  
  // Filter comments for this file
  const fileComments = useMemo(() => {
    return comments.filter(c => {
      const commentPath = c.filePath.replace(/^[ab]\//, "");
      return commentPath === currentName || 
             commentPath === displayName ||
             currentName.endsWith(commentPath) ||
             commentPath.endsWith(currentName);
    });
  }, [comments, currentName, displayName]);
  
  const hasComments = fileComments.length > 0;

  return (
    <div className="border border-border-primary rounded-lg mb-3 relative">
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
        {hasComments && (
          <span className="flex items-center gap-1 text-xs text-accent-purple mr-2 bg-accent-purple/10 px-2 py-0.5 rounded-full">
            <Sparkle size={10} weight="fill" />
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
        <div 
          className="overflow-x-auto"
          style={{ "--diffs-font-size": `${fontSize}px` } as React.CSSProperties}
        >
          <FileDiff
            fileDiff={fileDiff}
            options={{
              diffStyle: "split", // Always use split view for Compare
              theme: diffsTheme,
              themeType,
              disableFileHeader: true,
            }}
          />
        </div>
      )}
      
      {/* Floating comments - positioned to the right of the diff card */}
      {showFloatingComments && hasComments && (
        <div className="absolute top-0 left-full ml-4 w-[320px] space-y-3 pt-1">
          {fileComments.map((comment) => (
            <InlineComment 
              key={comment.id} 
              comment={comment} 
              onFix={onFix}
            />
          ))}
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
  // AI Review props
  isGeneratingReview,
  reviewError,
  issueCount,
  onGenerateReview,
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
  // AI Review props
  isGeneratingReview: boolean;
  reviewError: string | null;
  issueCount: number;
  onGenerateReview: () => void;
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
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold text-text-primary">
            Compare: {baseRef} → {headRef}
          </h1>
          
          {/* AI Review button */}
          <div className="flex items-center gap-2">
            {isGeneratingReview ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-accent-purple/10 rounded-md">
                <LoadingSpinner size="xs" />
                <span className="text-sm text-accent-purple">Analyzing code...</span>
              </div>
            ) : reviewError ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-accent-red/10 rounded-md">
                <XCircle size={16} className="text-accent-red" />
                <span className="text-sm text-accent-red">Review failed</span>
                <button
                  onClick={onGenerateReview}
                  className="text-sm text-accent-blue hover:underline ml-2"
                >
                  Retry
                </button>
              </div>
            ) : issueCount > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-purple/10 rounded-md">
                  <Sparkle size={14} weight="fill" className="text-accent-purple" />
                  <span className="text-sm text-accent-purple font-medium">
                    {issueCount} {issueCount === 1 ? "issue" : "issues"} found
                  </span>
                </div>
                <button
                  onClick={onGenerateReview}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                >
                  Re-analyze
                </button>
              </div>
            ) : (
              <button
                onClick={onGenerateReview}
                disabled={isGeneratingReview}
                className="flex items-center gap-2 px-4 py-2 bg-accent-purple hover:bg-accent-purple/90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Sparkle size={16} weight="fill" />
                AI Review
              </button>
            )}
          </div>
        </div>
        
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

// Convert AI review issues to ReviewComment format
function aiIssuesToComments(issues: AIReviewIssue[], generatedAt: number): ReviewComment[] {
  return issues.map((issue, index) => ({
    id: issue.id || `ai-issue-${index}`,
    filePath: issue.filePath || "",
    lineNumber: undefined,
    author: "AI Review",
    authorEmail: "ai@review.local",
    content: `${issue.problem}\n\n${issue.why}`,
    title: issue.title,
    timestamp: generatedAt,
    category: issue.category,
    severity: issue.severity as ReviewComment["severity"],
    suggestion: issue.suggestion,
    isAIGenerated: true,
  }));
}

// Convert CodeRabbit issues to ReviewComment format
function codeRabbitIssuesToComments(issues: CodeRabbitIssue[], generatedAt: number): ReviewComment[] {
  return issues.map((issue, index) => ({
    id: `cr-issue-${index}`,
    filePath: issue.file,
    lineRange: issue.lines,
    author: "CodeRabbit",
    authorEmail: "coderabbit@review.local",
    content: issue.description,
    title: issue.type,
    timestamp: generatedAt,
    category: issue.type,
    severity: (issue.severity?.toLowerCase() || "medium") as ReviewComment["severity"],
    suggestion: issue.suggestedFix,
    isAIGenerated: true,
  }));
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
  const { theme, diffFontSize } = useDiffSettings();
  const { aiReviewReviewerId } = useUIStore();
  const diffsTheme = getTheme(theme)?.diffsTheme ?? "pierre-dark";
  const themeType = isLightTheme(theme) ? "light" : "dark";
  
  // AI Review state
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  
  // Generate storage key for AI review persistence
  const getReviewStorageKey = (repoPath: string, base: string, head: string) => {
    // Create a simple hash-like key from the paths
    const key = `diffy-review:${repoPath}:${base}:${head}`;
    return key;
  };
  
  // Load cached review from localStorage when refs change
  useEffect(() => {
    if (!repository?.path || !compareBaseRef || !compareHeadRef) {
      setReviewResult(null);
      return;
    }
    
    const storageKey = getReviewStorageKey(repository.path, compareBaseRef, compareHeadRef);
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReviewResult;
        setReviewResult(parsed);
      } else {
        setReviewResult(null);
      }
    } catch (e) {
      console.warn("Failed to load cached review:", e);
      setReviewResult(null);
    }
  }, [repository?.path, compareBaseRef, compareHeadRef]);
  
  // Convert review result to inline comments
  const inlineComments = useMemo((): ReviewComment[] => {
    if (!reviewResult) return [];
    
    if (reviewResult.kind === "structured") {
      // StructuredReviewResult has data.issues and data.generatedAt
      return aiIssuesToComments(reviewResult.data.issues, reviewResult.data.generatedAt);
    } else if (reviewResult.kind === "coderabbit") {
      return codeRabbitIssuesToComments(reviewResult.issues, reviewResult.generatedAt);
    }
    
    return [];
  }, [reviewResult]);
  
  // Generate AI review
  const handleGenerateReview = async () => {
    if (!repository?.path || !compareBaseRef || !compareHeadRef) return;
    
    setIsGeneratingReview(true);
    setReviewError(null);
    
    try {
      const result = await generateReview(
        repository.path,
        aiReviewReviewerId,
        undefined, // no specific commit
        undefined, // no skills
        compareBaseRef,
        compareHeadRef
      );
      setReviewResult(result);
      
      // Save to localStorage
      const storageKey = getReviewStorageKey(repository.path, compareBaseRef, compareHeadRef);
      try {
        localStorage.setItem(storageKey, JSON.stringify(result));
      } catch (e) {
        console.warn("Failed to cache review:", e);
      }
    } catch (error) {
      console.error("Failed to generate review:", error);
      setReviewError(error instanceof Error ? error.message : "Failed to generate review");
    } finally {
      setIsGeneratingReview(false);
    }
  };
  
  // Handle fix action (placeholder - would integrate with fix functionality)
  const handleFix = (comment: ReviewComment) => {
    console.log("Fix requested for comment:", comment);
    // TODO: Integrate with fix functionality
  };

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
    staleTime: 5000, // Short stale time for fresher data
    refetchOnMount: "always", // Always refetch when Compare view mounts
  });

  // Fetch compare diff
  const { data: compareDiff, isLoading: diffLoading } = useQuery({
    queryKey: ["compare-diff", repository?.path, compareBaseRef, compareHeadRef],
    queryFn: () => getCompareDiff(repository!.path, compareBaseRef!, compareHeadRef!),
    enabled: !!repository?.path && !!compareBaseRef && !!compareHeadRef && compareBaseRef !== compareHeadRef,
    staleTime: 5000, // Short stale time for fresher data
    refetchOnMount: "always", // Always refetch when Compare view mounts
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

  const hasAnyComments = inlineComments.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-x-auto overflow-y-auto">
      {/* Header section - centered */}
      <div className="max-w-[1200px] mx-auto w-full">
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
          isGeneratingReview={isGeneratingReview}
          reviewError={reviewError}
          issueCount={inlineComments.length}
          onGenerateReview={handleGenerateReview}
        />
      </div>
      
      {/* Diff section header - centered */}
      <div className="sticky top-0 z-20 border-b border-border-primary bg-bg-tertiary">
        <div className="max-w-[1200px] mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            Files changed ({compareDiff?.files.length ?? 0})
          </span>
          
          {compareSelectedFile && (
            <button
              onClick={() => setCompareSelectedFile(null)}
              className="text-xs text-accent-blue hover:text-accent-blue/80"
            >
              Show all files
            </button>
          )}
        </div>
      </div>
      
      {/* Diff content with floating comments */}
      <div className="flex-1">
        <div className="max-w-[1200px] mx-auto px-4 py-4 relative">
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
              <CollapsibleFileDiff
                key={fileDiff.name || fileDiff.prevName || index}
                fileDiff={fileDiff}
                fontSize={diffFontSize}
                diffsTheme={diffsTheme}
                themeType={themeType}
                comments={inlineComments}
                onFix={handleFix}
                showFloatingComments={hasAnyComments}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
