import { useState, useCallback, useEffect, useMemo, memo } from "react";
import {
  Sparkle,
  CaretDown,
  CaretRight,
  Warning,
  ArrowCounterClockwise,
  File,
  Check,
  CheckCircle,
  XCircle,
  Copy,
  MagnifyingGlass,
  Funnel,
  X,
  Wrench,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  generateAIReview,
  fixAIReviewIssues,
  type IssueToFix,
} from "../../../lib/tauri";
import {
  getErrorMessage,
  isValidationError,
  normalizeError,
} from "../../../lib/errors";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useUIStore } from "../../../stores/ui-store";
import { LoadingSpinner } from "../../../components/ui";
import { SkillSelector } from "../../skills";
import type {
  AIReviewIssue,
  AIReviewCategory,
  AIReviewSeverity,
} from "../../../types/git";

// Animated loading messages for fix operation
const FIX_LOADING_MESSAGES = [
  "Reading source files...",
  "Analyzing issues...",
  "Claude is thinking...",
  "Generating fixes...",
  "Applying changes...",
];

// Hook for cycling through loading messages
function useLoadingMessage(
  isLoading: boolean,
  messages: string[],
  intervalMs = 2500,
) {
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

// Category labels and colors
const CATEGORY_CONFIG: Record<
  AIReviewCategory,
  { label: string; color: string }
> = {
  logic_bugs: { label: "Logic Bug", color: "bg-accent-red/20 text-accent-red" },
  edge_cases: {
    label: "Edge Case",
    color: "bg-accent-yellow/20 text-accent-yellow",
  },
  security: { label: "Security", color: "bg-accent-red/20 text-accent-red" },
  performance: {
    label: "Performance",
    color: "bg-accent-blue/20 text-accent-blue",
  },
  accidental_code: {
    label: "Accidental",
    color: "bg-text-muted/20 text-text-muted",
  },
  other: { label: "Other", color: "bg-text-muted/20 text-text-muted" },
};

// Severity colors and sort order
const SEVERITY_CONFIG: Record<
  AIReviewSeverity,
  { color: string; order: number }
> = {
  critical: { color: "bg-accent-red/30 text-accent-red", order: 0 },
  high: { color: "bg-accent-red/20 text-accent-red", order: 1 },
  medium: { color: "bg-accent-yellow/20 text-accent-yellow", order: 2 },
  low: { color: "bg-accent-blue/20 text-accent-blue", order: 3 },
};

const CategoryBadge = memo(function CategoryBadge({
  category,
}: {
  category: AIReviewCategory;
}) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-medium rounded ${config.color}`}
    >
      {config.label}
    </span>
  );
});

const SeverityBadge = memo(function SeverityBadge({
  severity,
}: {
  severity: AIReviewSeverity;
}) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-medium rounded ${config.color} capitalize`}
    >
      {severity}
    </span>
  );
});

// Issue card component
const IssueCard = memo(function IssueCard({
  issue,
  isSelected,
  onToggleSelect,
  onFix,
  onDismiss,
  isFixing,
}: {
  issue: AIReviewIssue;
  isSelected: boolean;
  onToggleSelect: () => void;
  onFix: () => void;
  onDismiss: () => void;
  isFixing: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border-primary rounded-lg overflow-hidden bg-bg-secondary hover:bg-bg-hover transition-colors">
      {/* Header row */}
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Selection checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? "bg-accent-purple border-accent-purple text-white"
              : "border-border-primary hover:border-accent-purple"
          }`}
        >
          {isSelected && <Check size={10} weight="bold" />}
        </button>

        {/* Expand toggle + content */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-start gap-2 text-left min-w-0"
        >
          {isExpanded ? (
            <CaretDown
              size={12}
              weight="bold"
              className="text-text-muted mt-1 shrink-0"
            />
          ) : (
            <CaretRight
              size={12}
              weight="bold"
              className="text-text-muted mt-1 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">
                {issue.title}
              </span>
              <CategoryBadge category={issue.category} />
              <SeverityBadge severity={issue.severity} />
            </div>
            {issue.filePath && (
              <div className="flex items-center gap-1.5 mt-1">
                <File size={12} className="text-text-muted shrink-0" />
                <span className="text-xs font-mono text-accent-blue truncate">
                  {issue.filePath}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Per-issue actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFix();
            }}
            disabled={isFixing}
            className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-purple transition-colors disabled:opacity-50"
            title="Fix this issue"
          >
            <Wrench size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
            title="Dismiss"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Expanded content: Problem / Why / Suggestion */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 ml-9 space-y-3 border-t border-border-primary">
          {issue.problem && (
            <div>
              <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Problem
              </h5>
              <p className="text-sm text-text-primary leading-relaxed">
                {issue.problem}
              </p>
            </div>
          )}
          {issue.why && (
            <div>
              <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Why It Matters
              </h5>
              <p className="text-sm text-text-primary leading-relaxed">
                {issue.why}
              </p>
            </div>
          )}
          {issue.suggestion && (
            <div>
              <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Suggestion
              </h5>
              <p className="text-sm text-text-primary leading-relaxed">
                {issue.suggestion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Filter dropdown component
const FilterDropdown = memo(function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    onChange(newSelected);
  };

  const clearAll = () => {
    onChange(new Set());
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
          selected.size > 0
            ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
            : "border-border-primary hover:border-text-muted text-text-muted hover:text-text-primary"
        }`}
      >
        <Funnel size={12} />
        <span>{label}</span>
        {selected.size > 0 && (
          <span className="px-1 bg-accent-purple text-white rounded text-xs">
            {selected.size}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-bg-secondary border border-border-primary rounded-lg shadow-lg min-w-[160px] py-1">
            {selected.size > 0 && (
              <button
                onClick={clearAll}
                className="w-full px-3 py-1.5 text-xs text-left text-text-muted hover:bg-bg-hover"
              >
                Clear all
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-bg-hover"
              >
                <span
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    selected.has(opt.value)
                      ? "bg-accent-purple border-accent-purple text-white"
                      : "border-border-primary"
                  }`}
                >
                  {selected.has(opt.value) && <Check size={8} weight="bold" />}
                </span>
                <span className="text-text-primary">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

// Fix result notification
const FixResultNotification = memo(function FixResultNotification({
  fixResult,
  onDismiss,
}: {
  fixResult: { success: boolean; message: string };
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = `Fix ${fixResult.success ? "Succeeded" : "Failed"}\n\n${fixResult.message}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [fixResult]);

  return (
    <div
      className={`rounded-lg p-4 ${
        fixResult.success
          ? "bg-accent-green/10 border border-accent-green"
          : "bg-accent-red/10 border border-accent-red"
      }`}
    >
      <div className="flex items-start gap-3">
        {fixResult.success ? (
          <CheckCircle
            size={20}
            weight="fill"
            className="text-accent-green shrink-0 mt-0.5"
          />
        ) : (
          <Warning
            size={20}
            weight="fill"
            className="text-accent-red shrink-0 mt-0.5"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4
            className={`text-sm font-medium ${fixResult.success ? "text-accent-green" : "text-accent-red"}`}
          >
            {fixResult.success ? "Fixes Applied Successfully" : "Fix Failed"}
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
                <CheckCircle
                  size={14}
                  weight="fill"
                  className="text-accent-green"
                />
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

// Status indicator component
type ReviewStatus = "not_running" | "running" | "completed";

const StatusIndicator = memo(function StatusIndicator({
  status,
  timestamp,
  notRunningReason,
}: {
  status: ReviewStatus;
  timestamp?: number;
  notRunningReason?: string;
}) {
  const statusConfig = {
    not_running: {
      label: "Not running",
      color: "text-text-muted",
      dotColor: "bg-text-muted",
    },
    running: {
      label: "Running",
      color: "text-accent-yellow",
      dotColor: "bg-accent-yellow animate-pulse",
    },
    completed: {
      label: "Completed",
      color: "text-accent-green",
      dotColor: "bg-accent-green",
    },
  };

  const config = statusConfig[status];
  const timeStr = timestamp
    ? new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      <span className={config.color}>{config.label}</span>
      {status === "not_running" && notRunningReason && (
        <span className="text-text-muted">· {notRunningReason}</span>
      )}
      {status === "completed" && timeStr && (
        <span className="text-text-muted">· {timeStr}</span>
      )}
    </div>
  );
});

// Session metrics display
const SessionMetrics = memo(function SessionMetrics({
  issuesFound,
  issuesAccepted,
  issuesDismissed,
}: {
  issuesFound: number;
  issuesAccepted: number;
  issuesDismissed: number;
}) {
  const acceptanceRate =
    issuesFound > 0 ? Math.round((issuesAccepted / issuesFound) * 100) : 0;

  return (
    <div className="flex items-center gap-3 text-xs text-text-muted">
      <span>{issuesFound} found</span>
      <span className="text-accent-green">{issuesAccepted} fixed</span>
      <span>{issuesDismissed} dismissed</span>
      {issuesFound > 0 && (
        <span className="text-text-primary">{acceptanceRate}% acceptance</span>
      )}
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
    clearAIReview,
  } = useActiveTabState();
  const { selectedSkillIds } = useUIStore();
  const queryClient = useQueryClient();

  // Selection state
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [dismissedIssues, setDismissedIssues] = useState<Set<string>>(
    new Set(),
  );
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set());

  // Session metrics
  const [sessionMetrics, setSessionMetrics] = useState({
    issuesFound: 0,
    issuesAccepted: 0,
    issuesDismissed: 0,
  });

  // Not running reason (for validation errors)
  const [notRunningReason, setNotRunningReason] = useState<string | null>(null);

  const fixLoadingMessage = useLoadingMessage(isFixing, FIX_LOADING_MESSAGES);

  // Reset to initial state (to select different skills)
  const handleNewReview = useCallback(() => {
    clearAIReview();
    setNotRunningReason(null);
    setSelectedIssues(new Set());
    setDismissedIssues(new Set());
    setFixResult(null);
    setSearchQuery("");
    setCategoryFilter(new Set());
    setSeverityFilter(new Set());
    setSessionMetrics({
      issuesFound: 0,
      issuesAccepted: 0,
      issuesDismissed: 0,
    });
  }, [clearAIReview]);

  // Reset state when review changes
  useEffect(() => {
    if (aiReview) {
      setSelectedIssues(new Set());
      setDismissedIssues(new Set());
      setSearchQuery("");
      setCategoryFilter(new Set());
      setSeverityFilter(new Set());
      setSessionMetrics({
        issuesFound: aiReview.issues.length,
        issuesAccepted: 0,
        issuesDismissed: 0,
      });
      setNotRunningReason(null);
    }
  }, [aiReview]);

  // Filter and sort issues
  const filteredIssues = useMemo(() => {
    if (!aiReview) return [];

    let issues = aiReview.issues.filter(
      (issue) => !dismissedIssues.has(issue.id),
    );

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      issues = issues.filter(
        (issue) =>
          issue.title.toLowerCase().includes(query) ||
          issue.problem.toLowerCase().includes(query) ||
          issue.why.toLowerCase().includes(query) ||
          issue.suggestion.toLowerCase().includes(query) ||
          (issue.filePath && issue.filePath.toLowerCase().includes(query)),
      );
    }

    // Category filter
    if (categoryFilter.size > 0) {
      issues = issues.filter((issue) => categoryFilter.has(issue.category));
    }

    // Severity filter
    if (severityFilter.size > 0) {
      issues = issues.filter((issue) => severityFilter.has(issue.severity));
    }

    // Sort by severity (critical first), then by file path, then by title
    issues.sort((a, b) => {
      const severityDiff =
        (SEVERITY_CONFIG[a.severity]?.order ?? 99) -
        (SEVERITY_CONFIG[b.severity]?.order ?? 99);
      if (severityDiff !== 0) return severityDiff;

      const fileA = a.filePath || "";
      const fileB = b.filePath || "";
      const fileDiff = fileA.localeCompare(fileB);
      if (fileDiff !== 0) return fileDiff;

      return a.title.localeCompare(b.title);
    });

    return issues;
  }, [aiReview, dismissedIssues, searchQuery, categoryFilter, severityFilter]);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    if (!aiReview) return { categories: [], severities: [] };

    const activeIssues = aiReview.issues.filter(
      (i) => !dismissedIssues.has(i.id),
    );
    const categories = [...new Set(activeIssues.map((i) => i.category))];
    const severities = [...new Set(activeIssues.map((i) => i.severity))];

    return {
      categories: categories.map((c) => ({
        value: c,
        label: CATEGORY_CONFIG[c]?.label || c,
      })),
      severities: severities
        .sort(
          (a, b) =>
            (SEVERITY_CONFIG[a]?.order ?? 99) -
            (SEVERITY_CONFIG[b]?.order ?? 99),
        )
        .map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        })),
    };
  }, [aiReview, dismissedIssues]);

  const handleToggleIssue = useCallback((id: string) => {
    setSelectedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDismissIssue = useCallback((id: string) => {
    setDismissedIssues((prev) => new Set(prev).add(id));
    setSelectedIssues((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSessionMetrics((prev) => ({
      ...prev,
      issuesDismissed: prev.issuesDismissed + 1,
    }));
  }, []);

  const handleGenerateReview = useCallback(async () => {
    if (!repository || aiReviewLoading) return;

    setAIReviewLoading(true);
    setAIReviewError(null);
    setNotRunningReason(null);
    setSelectedIssues(new Set());
    setDismissedIssues(new Set());
    setFixResult(null);

    try {
      const commitId =
        viewMode === "commit" ? (selectedCommit ?? undefined) : undefined;
      const skillIds =
        selectedSkillIds.length > 0 ? selectedSkillIds : undefined;
      const review = await generateAIReview(
        repository.path,
        commitId,
        skillIds,
      );
      setAIReview(review);
    } catch (error) {
      const normalized = normalizeError(error);
      if (isValidationError(error)) {
        // This is a "not running" state (e.g., no changes to review)
        setNotRunningReason(normalized.message);
        setAIReviewError(null);
        setAIReview(null);
      } else {
        setAIReviewError(normalized.message);
      }
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

  const handleFixIssues = useCallback(
    async (issueIds: string[]) => {
      if (!repository || !aiReview || issueIds.length === 0 || isFixing) return;

      setIsFixing(true);
      setFixResult(null);

      try {
        const issues: IssueToFix[] = issueIds
          .map((id) => aiReview.issues.find((i) => i.id === id))
          .filter((issue): issue is AIReviewIssue => issue !== undefined)
          .map((issue) => ({
            issueType: "file_comment" as const,
            title: issue.title,
            description: `Problem: ${issue.problem}\n\nWhy: ${issue.why}\n\nSuggestion: ${issue.suggestion}`,
            filePath: issue.filePath,
          }));

        const result = await fixAIReviewIssues(repository.path, issues);
        setFixResult({ success: true, message: result });

        // Mark as accepted and clear selection
        setSessionMetrics((prev) => ({
          ...prev,
          issuesAccepted: prev.issuesAccepted + issueIds.length,
        }));
        setSelectedIssues(new Set());

        // Invalidate diff queries to show updated files
        queryClient.invalidateQueries({ queryKey: ["working-diff-staged"] });
        queryClient.invalidateQueries({ queryKey: ["working-diff-unstaged"] });
        queryClient.invalidateQueries({ queryKey: ["status"] });
      } catch (error) {
        setFixResult({
          success: false,
          message: getErrorMessage(error),
        });
      } finally {
        setIsFixing(false);
      }
    },
    [repository, aiReview, isFixing, queryClient],
  );

  const handleFixSelected = useCallback(() => {
    handleFixIssues([...selectedIssues]);
  }, [handleFixIssues, selectedIssues]);

  const handleFixSingle = useCallback(
    (id: string) => {
      handleFixIssues([id]);
    },
    [handleFixIssues],
  );

  // Determine status
  const status: ReviewStatus = aiReviewLoading
    ? "running"
    : aiReview
      ? "completed"
      : "not_running";

  // Empty state - no review yet
  if (!aiReview && !aiReviewLoading && !aiReviewError && !notRunningReason) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Sparkle
          size={48}
          weight="duotone"
          className="text-accent-purple mb-4"
        />
        <h3 className="text-lg font-medium text-text-primary mb-2">
          AI Code Review
        </h3>
        <p className="text-sm text-text-muted mb-4 max-w-xs">
          Generate a PR-style code review for{" "}
          {viewMode === "commit" && selectedCommit
            ? "this commit"
            : "your working changes"}
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
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
          <div className="flex items-center gap-3">
            <Sparkle
              size={18}
              weight="duotone"
              className="text-accent-purple"
            />
            <span className="text-sm font-medium text-text-primary">
              AI Review
            </span>
            <StatusIndicator status="running" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
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
      </div>
    );
  }

  // Error state (non-validation errors only)
  if (aiReviewError) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
          <div className="flex items-center gap-3">
            <Sparkle
              size={18}
              weight="duotone"
              className="text-accent-purple"
            />
            <span className="text-sm font-medium text-text-primary">
              AI Review
            </span>
            <StatusIndicator status="not_running" notRunningReason="Error" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
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
      </div>
    );
  }

  // Not running state (validation error, e.g., no changes)
  if (notRunningReason && !aiReview) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
          <div className="flex items-center gap-3">
            <Sparkle
              size={18}
              weight="duotone"
              className="text-accent-purple"
            />
            <span className="text-sm font-medium text-text-primary">
              AI Review
            </span>
            <StatusIndicator
              status="not_running"
              notRunningReason={notRunningReason}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <Sparkle
            size={48}
            weight="duotone"
            className="text-text-muted mb-4"
          />
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Not Running
          </h3>
          <p className="text-sm text-text-muted mb-4 max-w-xs">
            {notRunningReason}
          </p>
          <button
            onClick={handleGenerateReview}
            className="px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg font-medium text-sm hover:bg-bg-hover transition-colors flex items-center gap-2 border border-border-primary"
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalSelected = selectedIssues.size;
  const activeIssuesCount = aiReview!.issues.length - dismissedIssues.size;

  // Review display
  return (
    <div className="flex flex-col h-full">
      {/* Header with status */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-center gap-3">
          <Sparkle size={18} weight="duotone" className="text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">
            AI Review
          </span>
          <StatusIndicator status={status} timestamp={aiReview?.generatedAt} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewReview}
            disabled={aiReviewLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Start fresh with different skills"
          >
            New Review
          </button>
          <button
            onClick={handleGenerateReview}
            disabled={aiReviewLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors flex items-center gap-1"
            title="Re-run with same skills"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
            Regenerate
          </button>
        </div>
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

        {/* Session metrics */}
        {sessionMetrics.issuesFound > 0 && (
          <SessionMetrics
            issuesFound={sessionMetrics.issuesFound}
            issuesAccepted={sessionMetrics.issuesAccepted}
            issuesDismissed={sessionMetrics.issuesDismissed}
          />
        )}

        {/* Search and filters */}
        {aiReview!.issues.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:border-accent-purple"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Category filter */}
            {filterOptions.categories.length > 1 && (
              <FilterDropdown
                label="Category"
                options={filterOptions.categories}
                selected={categoryFilter}
                onChange={setCategoryFilter}
              />
            )}

            {/* Severity filter */}
            {filterOptions.severities.length > 1 && (
              <FilterDropdown
                label="Severity"
                options={filterOptions.severities}
                selected={severityFilter}
                onChange={setSeverityFilter}
              />
            )}

            {/* Results count */}
            <span className="text-xs text-text-muted">
              {filteredIssues.length} of {activeIssuesCount} issues
            </span>
          </div>
        )}

        {/* Issues feed */}
        {filteredIssues.length > 0 ? (
          <div className="space-y-2">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isSelected={selectedIssues.has(issue.id)}
                onToggleSelect={() => handleToggleIssue(issue.id)}
                onFix={() => handleFixSingle(issue.id)}
                onDismiss={() => handleDismissIssue(issue.id)}
                isFixing={isFixing}
              />
            ))}
          </div>
        ) : aiReview!.issues.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <CheckCircle
              size={24}
              weight="duotone"
              className="mx-auto mb-2 text-accent-green"
            />
            <p className="text-sm">No issues found in the code review.</p>
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted">
            <MagnifyingGlass
              size={24}
              weight="duotone"
              className="mx-auto mb-2"
            />
            <p className="text-sm">No issues match your filters.</p>
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
      {activeIssuesCount > 0 && (
        <div className="border-t border-border-primary p-4 bg-bg-tertiary space-y-3">
          {/* Loading indicator with animated message */}
          {isFixing && (
            <div className="flex items-center gap-3 p-3 bg-accent-purple/10 border border-accent-purple/30 rounded-lg">
              <LoadingSpinner size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-accent-purple">
                  Claude is working...
                </p>
                <p className="text-xs text-text-muted animate-pulse">
                  {fixLoadingMessage}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleFixSelected}
            disabled={totalSelected === 0 || isFixing}
            className="w-full py-2.5 px-4 bg-accent-purple text-white rounded-lg font-medium text-sm hover:bg-accent-purple/90 disabled:bg-bg-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isFixing ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-1">
                  Fixing {totalSelected} Issue{totalSelected !== 1 ? "s" : ""}
                  ...
                </span>
              </>
            ) : (
              <>
                <Sparkle size={16} weight="bold" />
                Fix{" "}
                {totalSelected > 0
                  ? `${totalSelected} Selected Issue${totalSelected !== 1 ? "s" : ""}`
                  : "Selected Issues"}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
