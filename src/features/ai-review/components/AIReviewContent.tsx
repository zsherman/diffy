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
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  generateReview,
  fixAIReviewIssues,
  fixCodeRabbitIssue,
  type IssueToFix,
} from "../../../lib/tauri";
import {
  getErrorMessage,
  isValidationError,
  normalizeError,
} from "../../../lib/errors";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useUIStore, getDockviewApi } from "../../../stores/ui-store";
import { LoadingSpinner, Input } from "../../../components/ui";
import { useToast } from "../../../components/ui/Toast";
import { SkillSelector } from "../../skills";
import type {
  AIReviewIssue,
  AIReviewCategory,
  AIReviewSeverity,
  ReviewResult,
  CodeRabbitIssue,
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
      className={`px-1.5 py-0.5 text-xs font-medium rounded-sm ${config.color}`}
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
      className={`px-1.5 py-0.5 text-xs font-medium rounded-sm ${config.color} capitalize`}
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
  onGoToFile,
  isFixing,
}: {
  issue: AIReviewIssue;
  isSelected: boolean;
  onToggleSelect: () => void;
  onFix: () => void;
  onDismiss: () => void;
  onGoToFile?: (file: string) => void;
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
          {issue.filePath && onGoToFile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGoToFile(issue.filePath!);
              }}
              className="p-1.5 rounded-sm hover:bg-bg-tertiary text-text-muted hover:text-accent-blue transition-colors"
              title="Show in diff panel"
            >
              <ArrowSquareOut size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFix();
            }}
            disabled={isFixing}
            className="p-1.5 rounded-sm hover:bg-bg-tertiary text-text-muted hover:text-accent-purple transition-colors disabled:opacity-50"
            title="Fix this issue"
          >
            <Wrench size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1.5 rounded-sm hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
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
          <span className="px-1 bg-accent-purple text-white rounded-sm text-xs">
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
              className="p-1.5 rounded-sm hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
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
            className="p-1.5 rounded-sm hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Dismiss"
          >
            <XCircle size={14} weight="bold" />
          </button>
        </div>
      </div>
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

// Text review result display component
const TextReviewContent = memo(function TextReviewContent({
  content,
  onRegenerate,
  onNewReview,
  isLoading,
}: {
  content: string;
  onRegenerate: () => void;
  onNewReview: () => void;
  isLoading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-secondary">
        <span className="text-xs px-2 py-0.5 bg-accent-blue/20 text-accent-blue rounded-sm">
          CodeRabbit
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle
                  size={12}
                  weight="fill"
                  className="text-accent-green"
                />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </button>
          <button
            onClick={onNewReview}
            disabled={isLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
            title="Start fresh"
          >
            New
          </button>
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors flex items-center gap-1"
            title="Regenerate"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-mono">
          {content}
        </pre>
      </div>
    </div>
  );
});

// Render a diff-style suggested fix with line highlighting
const DiffView = memo(function DiffView({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="text-xs font-mono bg-bg-primary rounded-sm overflow-x-auto">
      {lines.map((line, idx) => {
        const trimmed = line.trimStart();
        let bgColor = "";
        let textColor = "text-text-primary";

        if (trimmed.startsWith("-") && !trimmed.startsWith("---")) {
          bgColor = "bg-accent-red/10";
          textColor = "text-accent-red";
        } else if (trimmed.startsWith("+") && !trimmed.startsWith("+++")) {
          bgColor = "bg-accent-green/10";
          textColor = "text-accent-green";
        } else if (trimmed.startsWith("@@")) {
          textColor = "text-accent-blue";
        }

        return (
          <div key={idx} className={`px-2 py-0.5 ${bgColor}`}>
            <span className={textColor}>{line}</span>
          </div>
        );
      })}
    </div>
  );
});

// Single CodeRabbit issue card component
const CodeRabbitIssueCard = memo(function CodeRabbitIssueCard({
  issue,
  repoPath,
  onFixed,
  onGoToFile,
}: {
  issue: CodeRabbitIssue;
  repoPath: string;
  onFixed?: () => void;
  onGoToFile?: (file: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const handleCopyPrompt = useCallback(async () => {
    if (!issue.aiAgentPrompt) return;
    try {
      await navigator.clipboard.writeText(issue.aiAgentPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [issue.aiAgentPrompt]);

  const handleFix = useCallback(async () => {
    if (!issue.aiAgentPrompt || isFixing) return;

    setIsFixing(true);
    setFixResult(null);

    try {
      const result = await fixCodeRabbitIssue(repoPath, {
        file: issue.file,
        lines: issue.lines,
        description: issue.description,
        aiAgentPrompt: issue.aiAgentPrompt,
      });

      setFixResult({ success: true, message: result });
      toast.success("Fix applied", result);

      // Invalidate queries to refresh file state
      queryClient.invalidateQueries({ queryKey: ["working-diff-staged"] });
      queryClient.invalidateQueries({ queryKey: ["working-diff-unstaged"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });

      onFixed?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to apply fix";
      setFixResult({ success: false, message });
      toast.error("Fix failed", message);
    } finally {
      setIsFixing(false);
    }
  }, [issue, repoPath, isFixing, toast, queryClient, onFixed]);

  // Determine badge color based on issue type
  const getTypeBadgeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes("bug") ||
      lowerType.includes("error") ||
      lowerType.includes("issue")
    ) {
      return "bg-accent-red/20 text-accent-red";
    }
    if (lowerType.includes("security") || lowerType.includes("vulnerability")) {
      return "bg-accent-orange/20 text-accent-orange";
    }
    if (
      lowerType.includes("performance") ||
      lowerType.includes("optimization")
    ) {
      return "bg-accent-yellow/20 text-accent-yellow";
    }
    if (lowerType.includes("suggestion") || lowerType.includes("improvement")) {
      return "bg-accent-green/20 text-accent-green";
    }
    return "bg-accent-blue/20 text-accent-blue";
  };

  // Check if suggested fix looks like a diff
  const isDiff =
    issue.suggestedFix &&
    (issue.suggestedFix.includes("\n-") ||
      issue.suggestedFix.includes("\n+") ||
      issue.suggestedFix.startsWith("-") ||
      issue.suggestedFix.startsWith("+"));

  const canFix = !!issue.aiAgentPrompt;

  return (
    <div className="bg-bg-tertiary rounded-lg overflow-hidden border border-border-primary">
      {/* Header - File, Type, Lines */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 min-w-0 hover:bg-bg-hover rounded-sm transition-colors text-left py-0.5 px-1 -ml-1"
        >
          {isExpanded ? (
            <CaretDown size={14} className="text-text-muted shrink-0" />
          ) : (
            <CaretRight size={14} className="text-text-muted shrink-0" />
          )}
          <File size={14} className="text-text-muted shrink-0" />
          <span className="text-sm font-medium text-text-primary truncate">
            {issue.file}
          </span>
          {issue.lines && (
            <span className="text-xs text-text-muted shrink-0">
              :{issue.lines}
            </span>
          )}
        </button>
        {onGoToFile && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGoToFile(issue.file);
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors shrink-0"
            title="Show in diff panel"
          >
            <ArrowSquareOut size={14} />
          </button>
        )}
        <span
          className={`text-xs px-2 py-0.5 rounded-sm shrink-0 ${getTypeBadgeColor(issue.type)}`}
        >
          {issue.type}
        </span>
      </div>

      {/* Body - Description and Suggested Fix */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Description */}
          {issue.description && (
            <div>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {issue.description}
              </p>
            </div>
          )}

          {/* Suggested Fix */}
          {issue.suggestedFix && (
            <div className="border-t border-border-primary pt-3">
              <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Suggested Fix
              </h5>
              {isDiff ? (
                <DiffView content={issue.suggestedFix} />
              ) : (
                <pre className="text-xs text-text-primary bg-bg-primary p-2 rounded-sm overflow-x-auto whitespace-pre-wrap font-mono">
                  {issue.suggestedFix}
                </pre>
              )}
            </div>
          )}

          {/* AI Agent Prompt - Footer */}
          {issue.aiAgentPrompt && (
            <div className="border-t border-border-primary pt-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Prompt for AI Agent
                </h5>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
                  >
                    {copiedPrompt ? (
                      <>
                        <CheckCircle
                          size={12}
                          weight="fill"
                          className="text-accent-green"
                        />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="text-xs text-accent-purple bg-accent-purple/10 p-2 rounded-sm overflow-x-auto whitespace-pre-wrap font-mono border border-accent-purple/20">
                {issue.aiAgentPrompt}
              </pre>
            </div>
          )}

          {/* Fix Result */}
          {fixResult && (
            <div
              className={`p-2 rounded-sm text-xs ${
                fixResult.success
                  ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                  : "bg-accent-red/10 text-accent-red border border-accent-red/20"
              }`}
            >
              {fixResult.message}
            </div>
          )}

          {/* Fix Button */}
          {canFix && !fixResult?.success && (
            <div className="border-t border-border-primary pt-3">
              <button
                onClick={handleFix}
                disabled={isFixing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-purple text-white rounded-lg font-medium text-sm hover:bg-accent-purple/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
              >
                {isFixing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Fixing with Claude...
                  </>
                ) : (
                  <>
                    <Wrench size={16} weight="bold" />
                    Fix with Claude
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// CodeRabbit parsed review display component
const CodeRabbitReviewContent = memo(function CodeRabbitReviewContent({
  issues,
  rawContent,
  repoPath,
  onRegenerate,
  onNewReview,
  onGoToFile,
  isLoading,
}: {
  issues: CodeRabbitIssue[];
  rawContent: string;
  repoPath: string;
  onRegenerate: () => void;
  onNewReview: () => void;
  onGoToFile: (file: string) => void;
  isLoading: boolean;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [rawContent]);

  const hasIssues = issues.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-accent-blue/20 text-accent-blue rounded-sm">
            CodeRabbit
          </span>
          <span className="text-xs text-text-muted">working changes</span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">
            {hasIssues
              ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"}`
              : "No issues"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className={`px-2 py-1 text-xs rounded-sm transition-colors ${
              showRaw
                ? "bg-bg-hover text-text-primary"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Toggle raw output"
          >
            Raw
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle
                  size={12}
                  weight="fill"
                  className="text-accent-green"
                />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} />
              </>
            )}
          </button>
          <button
            onClick={onNewReview}
            disabled={isLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
            title="Start fresh"
          >
            New
          </button>
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors flex items-center gap-1"
            title="Regenerate"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {showRaw ? (
          <pre className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-mono">
            {rawContent}
          </pre>
        ) : hasIssues ? (
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <CodeRabbitIssueCard
                key={`${issue.file}-${issue.lines}-${index}`}
                issue={issue}
                repoPath={repoPath}
                onGoToFile={onGoToFile}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle
              size={48}
              weight="duotone"
              className="text-accent-green mb-4"
            />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              Looking Good!
            </h3>
            <p className="text-sm text-text-muted max-w-xs">
              CodeRabbit didn't find any issues with your changes.
            </p>
          </div>
        )}
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
    clearAIReview,
    setSelectedFile,
    setSelectedCommit,
  } = useActiveTabState();
  const { selectedSkillIds, aiReviewReviewerId, cliStatus } = useUIStore();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Full review result (structured or text)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);

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

  // For CodeRabbit, skills are not supported
  const supportsSkills = aiReviewReviewerId === "claude-cli";
  // For CodeRabbit, commit review is not supported
  const supportsCommitReview = aiReviewReviewerId === "claude-cli";

  // Reset to initial state (to select different skills)
  const handleNewReview = useCallback(() => {
    clearAIReview();
    setReviewResult(null);
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

  // Navigate to file in diff panel
  const handleGoToFile = useCallback(
    (file: string) => {
      // Set the selected file
      setSelectedFile(file);

      // Focus the diff panel
      const api = getDockviewApi();
      if (api) {
        const panel = api.getPanel("diff");
        if (panel) {
          panel.api.setActive();
        }
      }
    },
    [setSelectedFile],
  );

  // Reset state when review changes
  useEffect(() => {
    // Handle structured review from Claude
    if (aiReview && reviewResult?.kind === "structured") {
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
    setReviewResult(null);

    try {
      // Only pass commitId for Claude CLI (CodeRabbit only supports working changes)
      const commitId =
        viewMode === "commit" && supportsCommitReview
          ? (selectedCommit ?? undefined)
          : undefined;
      // Only pass skills for Claude CLI
      const skillIds =
        aiReviewReviewerId === "claude-cli" && selectedSkillIds.length > 0
          ? selectedSkillIds
          : undefined;

      const result = await generateReview(
        repository.path,
        aiReviewReviewerId,
        commitId,
        skillIds,
      );

      setReviewResult(result);

      // For structured results, also set aiReview for backward compatibility
      if (result.kind === "structured") {
        setAIReview(result.data);
      } else {
        setAIReview(null);
      }
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
    aiReviewReviewerId,
    supportsCommitReview,
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

        // Show success toast
        toast.success(
          `Fixed ${issueIds.length} issue${issueIds.length !== 1 ? "s" : ""}`,
          "Changes have been applied to your files",
        );

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
        const errorMessage = getErrorMessage(error);
        setFixResult({
          success: false,
          message: errorMessage,
        });

        // Show error toast
        toast.error("Fix failed", errorMessage);
      } finally {
        setIsFixing(false);
      }
    },
    [repository, aiReview, isFixing, queryClient, toast],
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

  // Reviewer display name
  const reviewerDisplayName =
    aiReviewReviewerId === "claude-cli" ? "Claude CLI" : "CodeRabbit CLI";

  // Check if selected CLI is available
  const selectedCLIAvailable =
    cliStatus === null
      ? true // Assume available until checked
      : aiReviewReviewerId === "claude-cli"
        ? cliStatus.claude.available
        : cliStatus.coderabbit.available;

  const selectedCLIInstallInstructions =
    cliStatus === null
      ? ""
      : aiReviewReviewerId === "claude-cli"
        ? cliStatus.claude.installInstructions
        : cliStatus.coderabbit.installInstructions;

  // Empty state - no review yet
  if (
    !reviewResult &&
    !aiReviewLoading &&
    !aiReviewError &&
    !notRunningReason
  ) {
    // Claude can review commits, CodeRabbit always reviews working changes
    const isCommitMode =
      viewMode === "commit" && selectedCommit && supportsCommitReview;

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

        {/* CLI not installed warning */}
        {!selectedCLIAvailable && (
          <div className="w-full max-w-sm mb-4 p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Warning
                size={16}
                weight="fill"
                className="text-accent-yellow shrink-0 mt-0.5"
              />
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">
                  {reviewerDisplayName} not installed
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {selectedCLIInstallInstructions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* What's being reviewed - prominent indicator */}
        <div className="w-full max-w-sm mb-4">
          {isCommitMode ? (
            <div className="p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="text-left">
                  <p className="text-xs font-medium text-accent-blue">
                    Reviewing Commit
                  </p>
                  <p className="text-xs text-text-muted font-mono truncate">
                    {selectedCommit?.slice(0, 8)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCommit(null)}
                  className="px-2 py-1 text-xs text-accent-blue hover:text-text-primary hover:bg-accent-blue/20 rounded-sm transition-colors"
                >
                  Review Working Changes Instead
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-bg-tertiary border border-border-primary rounded-lg">
              <p className="text-sm text-text-primary">
                Reviewing <span className="font-medium">Working Changes</span>
              </p>
              <p className="text-xs text-text-muted mt-1">
                Staged and unstaged changes will be analyzed
              </p>
            </div>
          )}
        </div>

        {/* Current reviewer indicator */}
        <p className="text-xs text-text-muted mb-4">
          Using{" "}
          <span className="font-medium text-accent-blue">
            {reviewerDisplayName}
          </span>
          <span className="text-text-muted"> · Change in Settings</span>
        </p>

        {/* Skill Selection (Claude only) */}
        {supportsSkills && (
          <div className="w-full max-w-xs mb-4">
            <SkillSelector />
          </div>
        )}

        <button
          onClick={handleGenerateReview}
          disabled={!repository || !selectedCLIAvailable}
          className="px-4 py-2 bg-accent-purple text-white rounded-lg font-medium text-sm hover:bg-accent-purple/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          title={
            !selectedCLIAvailable
              ? `${reviewerDisplayName} is not installed`
              : undefined
          }
        >
          <Sparkle size={16} weight="bold" />
          Generate Review
        </button>
      </div>
    );
  }

  // Loading state
  if (aiReviewLoading) {
    const isCodeRabbit = aiReviewReviewerId === "coderabbit-cli";
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="mb-4">
          <LoadingSpinner size="lg" />
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">
          Analyzing Code...
        </h3>
        <p className="text-sm text-text-muted mb-2">
          {reviewerDisplayName} is reviewing the changes
        </p>
        {isCodeRabbit && (
          <p className="text-xs text-text-muted max-w-xs">
            CodeRabbit reviews typically take 1-5 minutes depending on the size
            of changes
          </p>
        )}
      </div>
    );
  }

  // Error state (non-validation errors only)
  if (aiReviewError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Warning size={48} weight="duotone" className="text-accent-red mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">
          Review Failed
        </h3>
        <p className="text-sm text-text-muted mb-4 max-w-xs">{aiReviewError}</p>
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

  // Not running state (validation error, e.g., no changes)
  if (notRunningReason && !reviewResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Sparkle size={48} weight="duotone" className="text-text-muted mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">
          No Changes to Review
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
    );
  }

  // Parsed CodeRabbit result display
  if (reviewResult?.kind === "coderabbit" && repository) {
    return (
      <CodeRabbitReviewContent
        issues={reviewResult.issues}
        rawContent={reviewResult.rawContent}
        repoPath={repository.path}
        onRegenerate={handleGenerateReview}
        onNewReview={handleNewReview}
        onGoToFile={handleGoToFile}
        isLoading={aiReviewLoading}
      />
    );
  }

  // Text result display (fallback)
  if (reviewResult?.kind === "text") {
    return (
      <TextReviewContent
        content={reviewResult.content}
        onRegenerate={handleGenerateReview}
        onNewReview={handleNewReview}
        isLoading={aiReviewLoading}
      />
    );
  }

  // From here on, we have a structured result
  const totalSelected = selectedIssues.size;
  const activeIssuesCount = aiReview!.issues.length - dismissedIssues.size;

  // What was reviewed for this result
  const reviewedCommit = viewMode === "commit" && selectedCommit;

  // Structured review display (Claude)
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-accent-purple/20 text-accent-purple rounded-sm">
            Claude
          </span>
          {reviewedCommit ? (
            <span className="text-xs text-text-muted">
              commit{" "}
              <span className="font-mono text-accent-blue">
                {selectedCommit?.slice(0, 7)}
              </span>
            </span>
          ) : (
            <span className="text-xs text-text-muted">working changes</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewReview}
            disabled={aiReviewLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
            title="Start fresh with different skills"
          >
            New
          </button>
          <button
            onClick={handleGenerateReview}
            disabled={aiReviewLoading}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors flex items-center gap-1"
            title="Re-run with same skills"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
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
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                className="pl-8"
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
                onGoToFile={handleGoToFile}
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
