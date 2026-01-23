import { useState, useCallback, useEffect, memo } from 'react';
import {
  Sparkle,
  CaretDown,
  CaretRight,
  Warning,
  Bug,
  Info,
  ArrowCounterClockwise,
  File,
  Check,
  CheckCircle,
  XCircle,
  Copy,
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { generateAIReview, fixAIReviewIssues, type IssueToFix } from '../../../lib/tauri';
import { getErrorMessage } from '../../../lib/errors';
import { useTabsStore, useActiveTabState } from '../../../stores/tabs-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner } from '../../../components/ui';
import { SkillSelector } from '../../skills';
import type { AIReviewBug, AIReviewFileComment } from '../../../types/git';

// Animated loading messages for fix operation
const FIX_LOADING_MESSAGES = [
  'Reading source files...',
  'Analyzing issues...',
  'Claude is thinking...',
  'Generating fixes...',
  'Applying changes...',
];

// Hook for cycling through loading messages
function useLoadingMessage(isLoading: boolean, messages: string[], intervalMs = 2500) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isLoading, messages.length, intervalMs]);

  return messages[messageIndex];
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-accent-blue/20 text-accent-blue',
  medium: 'bg-accent-yellow/20 text-accent-yellow',
  high: 'bg-accent-red/20 text-accent-red',
  info: 'bg-accent-blue/20 text-accent-blue',
  warning: 'bg-accent-yellow/20 text-accent-yellow',
  error: 'bg-accent-red/20 text-accent-red',
};

const SeverityBadge = memo(function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const colorClass = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-medium rounded ${colorClass} capitalize`}
    >
      {severity}
    </span>
  );
});

const ExpandableSection = memo(function ExpandableSection({
  title,
  icon,
  count,
  children,
  defaultExpanded = true,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (count === 0) return null;

  return (
    <div className="border border-border-primary rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-bg-hover text-left"
      >
        {isExpanded ? (
          <CaretDown size={14} weight="bold" className="text-text-muted" />
        ) : (
          <CaretRight size={14} weight="bold" className="text-text-muted" />
        )}
        <span className="text-text-muted">{icon}</span>
        <span className="text-sm font-medium text-text-primary flex-1">
          {title}
        </span>
        <span className="text-xs text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded">
          {count}
        </span>
      </button>
      {isExpanded && <div className="divide-y divide-border-primary">{children}</div>}
    </div>
  );
});

const BugItem = memo(function BugItem({
  bug,
  isSelected,
  onToggle,
}: {
  bug: AIReviewBug;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="px-3 py-2 bg-bg-secondary hover:bg-bg-hover">
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-accent-purple border-accent-purple text-white'
              : 'border-border-primary hover:border-accent-purple'
          }`}
        >
          {isSelected && <Check size={10} weight="bold" />}
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-start gap-2 text-left min-w-0"
        >
          {isExpanded ? (
            <CaretDown size={12} weight="bold" className="text-text-muted mt-0.5 shrink-0" />
          ) : (
            <CaretRight size={12} weight="bold" className="text-text-muted mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-text-primary">{bug.title}</span>
              <SeverityBadge severity={bug.severity} />
            </div>
          </div>
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2 ml-9 text-sm text-text-muted">
          {bug.description}
        </div>
      )}
    </div>
  );
});

const FileCommentItem = memo(function FileCommentItem({
  comment,
  isSelected,
  onToggle,
}: {
  comment: AIReviewFileComment;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="px-3 py-2 bg-bg-secondary hover:bg-bg-hover">
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-accent-purple border-accent-purple text-white'
              : 'border-border-primary hover:border-accent-purple'
          }`}
        >
          {isSelected && <Check size={10} weight="bold" />}
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-start gap-2 text-left min-w-0"
        >
          {isExpanded ? (
            <CaretDown size={12} weight="bold" className="text-text-muted mt-0.5 shrink-0" />
          ) : (
            <CaretRight size={12} weight="bold" className="text-text-muted mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <File size={14} className="text-text-muted shrink-0" />
              <span className="text-xs font-mono text-accent-blue truncate">
                {comment.filePath}
              </span>
              <SeverityBadge severity={comment.severity} />
            </div>
            <div className="text-sm text-text-primary mt-1">{comment.title}</div>
          </div>
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2 ml-9 text-sm text-text-muted">
          {comment.explanation}
        </div>
      )}
    </div>
  );
});

const FixResultNotification = memo(function FixResultNotification({
  fixResult,
  onDismiss,
}: {
  fixResult: { success: boolean; message: string };
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = `Fix ${fixResult.success ? 'Succeeded' : 'Failed'}\n\n${fixResult.message}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [fixResult]);

  return (
    <div
      className={`rounded-lg p-4 ${
        fixResult.success
          ? 'bg-accent-green/10 border border-accent-green'
          : 'bg-accent-red/10 border border-accent-red'
      }`}
    >
      <div className="flex items-start gap-3">
        {fixResult.success ? (
          <CheckCircle size={20} weight="fill" className="text-accent-green shrink-0 mt-0.5" />
        ) : (
          <Warning size={20} weight="fill" className="text-accent-red shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${fixResult.success ? 'text-accent-green' : 'text-accent-red'}`}>
            {fixResult.success ? 'Fixes Applied Successfully' : 'Fix Failed'}
          </h4>
          <p className="text-sm text-text-primary mt-2 leading-relaxed">
            {fixResult.message}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!fixResult.success && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title="Copy error message"
            >
              {copied ? (
                <CheckCircle size={14} weight="fill" className="text-accent-green" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Dismiss"
          >
            <XCircle size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
});

export function AIReviewContent() {
  const { repository } = useTabsStore();
  const {
    selectedCommit,
    viewMode,
    aiReview,
    aiReviewLoading,
    aiReviewError,
    setAIReview,
    setAIReviewLoading,
    setAIReviewError,
  } = useActiveTabState();
  const { selectedSkillIds } = useUIStore();
  const queryClient = useQueryClient();

  // Selection state for bugs and file comments
  const [selectedBugs, setSelectedBugs] = useState<Set<number>>(new Set());
  const [selectedFileComments, setSelectedFileComments] = useState<Set<number>>(new Set());
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ success: boolean; message: string } | null>(null);

  const totalSelected = selectedBugs.size + selectedFileComments.size;
  const fixLoadingMessage = useLoadingMessage(isFixing, FIX_LOADING_MESSAGES);

  const handleToggleBug = useCallback((index: number) => {
    setSelectedBugs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleToggleFileComment = useCallback((index: number) => {
    setSelectedFileComments((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleGenerateReview = useCallback(async () => {
    if (!repository || aiReviewLoading) return;

    setAIReviewLoading(true);
    setAIReviewError(null);
    setSelectedBugs(new Set());
    setSelectedFileComments(new Set());
    setFixResult(null);

    try {
      const commitId = viewMode === 'commit' ? selectedCommit ?? undefined : undefined;
      const skillIds = selectedSkillIds.length > 0 ? selectedSkillIds : undefined;
      const review = await generateAIReview(repository.path, commitId, skillIds);
      setAIReview(review);
    } catch (error) {
      setAIReviewError(getErrorMessage(error));
    } finally {
      setAIReviewLoading(false);
    }
  }, [
    repository,
    viewMode,
    selectedCommit,
    selectedSkillIds,
    aiReviewLoading,
    setAIReview,
    setAIReviewLoading,
    setAIReviewError,
  ]);

  const handleFixIssues = useCallback(async () => {
    if (!repository || !aiReview || totalSelected === 0 || isFixing) return;

    setIsFixing(true);
    setFixResult(null);

    try {
      const issues: IssueToFix[] = [];

      // Add selected bugs
      selectedBugs.forEach((index) => {
        const bug = aiReview.potentialBugs[index];
        if (bug) {
          issues.push({
            issueType: 'bug',
            title: bug.title,
            description: bug.description,
            filePath: undefined,
          });
        }
      });

      // Add selected file comments
      selectedFileComments.forEach((index) => {
        const comment = aiReview.fileComments[index];
        if (comment) {
          issues.push({
            issueType: 'file_comment',
            title: comment.title,
            description: comment.explanation,
            filePath: comment.filePath,
          });
        }
      });

      const result = await fixAIReviewIssues(repository.path, issues);
      setFixResult({ success: true, message: result });

      // Clear selections after successful fix
      setSelectedBugs(new Set());
      setSelectedFileComments(new Set());

      // Invalidate diff queries to show updated files
      queryClient.invalidateQueries({ queryKey: ['working-diff-staged'] });
      queryClient.invalidateQueries({ queryKey: ['working-diff-unstaged'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    } catch (error) {
      setFixResult({
        success: false,
        message: getErrorMessage(error),
      });
    } finally {
      setIsFixing(false);
    }
  }, [repository, aiReview, selectedBugs, selectedFileComments, totalSelected, isFixing, queryClient]);

  // Empty state - no review yet
  if (!aiReview && !aiReviewLoading && !aiReviewError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Sparkle size={48} weight="duotone" className="text-accent-purple mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">
          AI Code Review
        </h3>
        <p className="text-sm text-text-muted mb-4 max-w-xs">
          Generate a PR-style code review for{' '}
          {viewMode === 'commit' && selectedCommit
            ? 'this commit'
            : 'your working changes'}
          .
        </p>

        {/* Skill Selection */}
        <div className="w-full max-w-xs mb-4">
          <SkillSelector />
        </div>

        <button
          onClick={handleGenerateReview}
          disabled={!repository}
          className="px-4 py-2 bg-accent-purple text-white rounded-lg font-medium text-sm hover:bg-accent-purple/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Sparkle size={16} weight="bold" />
          Generate Review
        </button>
      </div>
    );
  }

  // Loading state
  if (aiReviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="mb-4">
          <LoadingSpinner size="lg" />
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">
          Analyzing Code...
        </h3>
        <p className="text-sm text-text-muted">
          Claude is reviewing the changes
        </p>
      </div>
    );
  }

  // Error state
  if (aiReviewError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Warning
          size={48}
          weight="duotone"
          className="text-accent-red mb-4"
        />
        <h3 className="text-lg font-medium text-text-primary mb-2">
          Review Failed
        </h3>
        <p className="text-sm text-text-muted mb-4 max-w-xs">
          {aiReviewError}
        </p>
        <button
          onClick={handleGenerateReview}
          className="px-4 py-2 bg-accent-purple text-white rounded-lg font-medium text-sm hover:bg-accent-purple/90 transition-colors flex items-center gap-2"
        >
          <ArrowCounterClockwise size={16} weight="bold" />
          Try Again
        </button>
      </div>
    );
  }

  const hasIssues = aiReview!.potentialBugs.length > 0 || aiReview!.fileComments.length > 0;

  // Review display
  return (
    <div className="flex flex-col h-full">
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-center gap-2">
          <Sparkle size={18} weight="duotone" className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">
            AI Review
          </span>
        </div>
        <button
          onClick={handleGenerateReview}
          disabled={aiReviewLoading}
          className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors flex items-center gap-1"
        >
          <ArrowCounterClockwise size={14} weight="bold" />
          Regenerate
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Overview section */}
        <div className="bg-bg-tertiary rounded-lg p-4">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Overview
          </h4>
          <p className="text-sm text-text-primary leading-relaxed">
            {aiReview!.overview}
          </p>
        </div>

        {/* Potential bugs section */}
        <ExpandableSection
          title="Potential Issues"
          icon={<Bug size={16} weight="bold" />}
          count={aiReview!.potentialBugs.length}
        >
          {aiReview!.potentialBugs.map((bug, index) => (
            <BugItem
              key={index}
              bug={bug}
              isSelected={selectedBugs.has(index)}
              onToggle={() => handleToggleBug(index)}
            />
          ))}
        </ExpandableSection>

        {/* File comments section */}
        <ExpandableSection
          title="File Comments"
          icon={<Info size={16} weight="bold" />}
          count={aiReview!.fileComments.length}
        >
          {aiReview!.fileComments.map((comment, index) => (
            <FileCommentItem
              key={index}
              comment={comment}
              isSelected={selectedFileComments.has(index)}
              onToggle={() => handleToggleFileComment(index)}
            />
          ))}
        </ExpandableSection>

        {/* No issues found */}
        {!hasIssues && (
          <div className="text-center py-6 text-text-muted">
            <Info size={24} weight="duotone" className="mx-auto mb-2" />
            <p className="text-sm">No issues found in the code review.</p>
          </div>
        )}

        {/* Fix result notification */}
        {fixResult && (
          <FixResultNotification
            fixResult={fixResult}
            onDismiss={() => setFixResult(null)}
          />
        )}
      </div>

      {/* Footer with Fix button */}
      {hasIssues && (
        <div className="border-t border-border-primary p-4 bg-bg-tertiary space-y-3">
          {/* Loading indicator with animated message */}
          {isFixing && (
            <div className="flex items-center gap-3 p-3 bg-accent-purple/10 border border-accent-purple/30 rounded-lg">
              <LoadingSpinner size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-accent-purple">Claude is working...</p>
                <p className="text-xs text-text-muted animate-pulse">{fixLoadingMessage}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleFixIssues}
            disabled={totalSelected === 0 || isFixing}
            className="w-full py-2.5 px-4 bg-accent-purple text-white rounded-lg font-medium text-sm hover:bg-accent-purple/90 disabled:bg-bg-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isFixing ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-1">Fixing {totalSelected} Issue{totalSelected !== 1 ? 's' : ''}...</span>
              </>
            ) : (
              <>
                <Sparkle size={16} weight="bold" />
                Fix {totalSelected > 0 ? `${totalSelected} Selected Issue${totalSelected !== 1 ? 's' : ''}` : 'Selected Issues'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
