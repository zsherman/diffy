import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListBullets,
  CaretDown,
  CaretRight,
  Copy,
  ArrowsClockwise,
  Sparkle,
  GitCommit,
  Check,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useActiveRepository } from "../../../stores/tabs-store";
import {
  getChangelogCommitsAllBranches,
  generateChangelogSummary,
} from "../../../lib/tauri";
import type { ChangelogCommit } from "../../../types/git";
import { ContributorFilter } from "../../statistics/components/ContributorFilter";
import type { Contributor } from "../../statistics/hooks/useContributionData";

// Week bucket type
interface WeekBucket {
  weekStart: number; // Unix timestamp for start of week (Monday)
  weekEnd: number;
  weekLabel: string;
  commits: ChangelogCommit[];
}

// =============================================================================
// localStorage caching for AI summaries
// =============================================================================
const CACHE_PREFIX = "diffy.changelogSummary:";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function getCacheKey(repoPath: string, weekStart: number, contributorEmail: string | null): string {
  // Simple hash for repo path to avoid overly long keys
  const pathHash = btoa(repoPath).slice(0, 16);
  return `${CACHE_PREFIX}${pathHash}:${weekStart}:${contributorEmail ?? "all"}`;
}

function getCachedSummary(repoPath: string, weekStart: number, contributorEmail: string | null): string | null {
  try {
    const key = getCacheKey(repoPath, weekStart, contributorEmail);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { summary, timestamp } = JSON.parse(cached);
    // Check if cache is still valid
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return summary;
  } catch {
    return null;
  }
}

function setCachedSummary(repoPath: string, weekStart: number, contributorEmail: string | null, summary: string): void {
  try {
    const key = getCacheKey(repoPath, weekStart, contributorEmail);
    localStorage.setItem(key, JSON.stringify({ summary, timestamp: Date.now() }));
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
  }
}

function clearCachedSummary(repoPath: string, weekStart: number, contributorEmail: string | null): void {
  try {
    const key = getCacheKey(repoPath, weekStart, contributorEmail);
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

// Get the start of the week (Monday) for a given timestamp
function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return Math.floor(monday.getTime() / 1000);
}

// Format a week label
function formatWeekLabel(weekStart: number): string {
  const start = new Date(weekStart * 1000);
  const end = new Date((weekStart + 6 * 24 * 60 * 60) * 1000);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}, ${start.getFullYear()}`;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

// Bucket commits into weeks
function bucketCommitsByWeek(commits: ChangelogCommit[]): WeekBucket[] {
  const buckets = new Map<number, ChangelogCommit[]>();

  for (const commit of commits) {
    const weekStart = getWeekStart(commit.time);
    const existing = buckets.get(weekStart) || [];
    existing.push(commit);
    buckets.set(weekStart, existing);
  }

  // Convert to array and sort by week (newest first)
  return Array.from(buckets.entries())
    .map(([weekStart, weekCommits]) => ({
      weekStart,
      weekEnd: weekStart + 7 * 24 * 60 * 60 - 1,
      weekLabel: formatWeekLabel(weekStart),
      commits: weekCommits.sort((a, b) => b.time - a.time),
    }))
    .sort((a, b) => b.weekStart - a.weekStart);
}

// Extract contributors from commits
function extractContributors(commits: ChangelogCommit[]): Contributor[] {
  const map = new Map<string, { name: string; email: string; count: number }>();
  for (const commit of commits) {
    const existing = map.get(commit.authorEmail);
    if (existing) {
      existing.count++;
    } else {
      map.set(commit.authorEmail, {
        name: commit.authorName,
        email: commit.authorEmail,
        count: 1,
      });
    }
  }
  return Array.from(map.values())
    .map((c) => ({ name: c.name, email: c.email, commitCount: c.count }))
    .sort((a, b) => b.commitCount - a.commitCount);
}

// Week section component
function WeekSection({
  bucket,
  repoPath,
  contributorEmail,
  isExpanded,
  onToggle,
}: {
  bucket: WeekBucket;
  repoPath: string;
  contributorEmail: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Cache key for summary (react-query)
  const summaryKey = [
    "changelog-summary",
    repoPath,
    bucket.weekStart,
    contributorEmail ?? "all",
  ];

  // Check localStorage for cached summary on mount/expand
  useEffect(() => {
    if (isExpanded) {
      const cached = getCachedSummary(repoPath, bucket.weekStart, contributorEmail);
      if (cached) {
        // Pre-populate react-query cache from localStorage
        queryClient.setQueryData(summaryKey, cached);
      }
    }
  }, [isExpanded, repoPath, bucket.weekStart, contributorEmail, queryClient, summaryKey]);

  // Lazy load AI summary only when expanded
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: summaryKey,
    queryFn: async () => {
      // Check localStorage first
      const cached = getCachedSummary(repoPath, bucket.weekStart, contributorEmail);
      if (cached) return cached;

      // Fetch from API
      const result = await generateChangelogSummary(
        repoPath,
        bucket.weekStart,
        bucket.weekEnd,
        contributorEmail
      );

      // Cache to localStorage
      setCachedSummary(repoPath, bucket.weekStart, contributorEmail, result);
      return result;
    },
    enabled: isExpanded, // Only fetch when expanded
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const handleCopyMarkdown = useCallback(() => {
    const commitLines = bucket.commits
      .map((c) => `- ${c.summary} (${c.shortId})`)
      .join("\n");

    const markdown = `## Week of ${bucket.weekLabel}

${summary ? `### Summary\n${summary}\n\n` : ""}### Commits (${bucket.commits.length})
${commitLines}
`;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bucket, summary]);

  const handleRegenerate = useCallback(() => {
    // Clear localStorage cache
    clearCachedSummary(repoPath, bucket.weekStart, contributorEmail);
    // Invalidate react-query cache and refetch
    queryClient.invalidateQueries({ queryKey: summaryKey });
    refetchSummary();
  }, [queryClient, summaryKey, refetchSummary, repoPath, bucket.weekStart, contributorEmail]);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
      >
        {isExpanded ? (
          <CaretDown size={16} weight="bold" className="text-text-muted" />
        ) : (
          <CaretRight size={16} weight="bold" className="text-text-muted" />
        )}
        <div className="flex-1">
          <span className="font-medium text-text-primary">
            {bucket.weekLabel}
          </span>
        </div>
        <span className="text-sm text-text-muted">
          {bucket.commits.length} commit{bucket.commits.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* AI Summary section */}
          <div className="bg-bg-tertiary rounded-md p-4 border border-border-primary">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-muted">
                <Sparkle size={14} weight="fill" className="text-accent-purple" />
                <span className="text-xs uppercase tracking-wide font-medium">
                  AI Summary
                </span>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={summaryLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors disabled:opacity-50"
                title="Regenerate summary"
              >
                <ArrowsClockwise
                  size={12}
                  weight="bold"
                  className={summaryLoading ? "animate-spin" : ""}
                />
                <span>Regenerate</span>
              </button>
            </div>
            {summaryLoading ? (
              <div className="text-text-muted text-sm animate-pulse">
                Generating summary...
              </div>
            ) : summaryError ? (
              <div className="text-accent-red text-sm">
                Failed to generate summary. Make sure Claude CLI is configured.
              </div>
            ) : summary ? (
              <div className="text-text-primary text-sm prose prose-invert prose-sm max-w-none">
                {/* Render markdown simply as text for now */}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {summary}
                </pre>
              </div>
            ) : (
              <div className="text-text-muted text-sm">
                No summary available
              </div>
            )}
          </div>

          {/* Commits list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-muted">
                <GitCommit size={14} weight="bold" />
                <span className="text-xs uppercase tracking-wide font-medium">
                  Commits
                </span>
              </div>
              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors"
                title="Copy as Markdown"
              >
                {copied ? (
                  <Check size={12} weight="bold" className="text-accent-green" />
                ) : (
                  <Copy size={12} weight="bold" />
                )}
                <span>{copied ? "Copied!" : "Copy as Markdown"}</span>
              </button>
            </div>
            <div className="space-y-1">
              {bucket.commits.map((commit) => (
                <div
                  key={commit.id}
                  className="flex items-start gap-2 py-1.5 px-2 rounded-sm hover:bg-bg-hover transition-colors"
                >
                  <span className="text-accent-yellow font-mono text-xs shrink-0 mt-0.5">
                    {commit.shortId}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-sm truncate">
                      {commit.summary}
                    </div>
                    <div className="text-text-muted text-xs">
                      {commit.authorName} · {formatRelativeTime(commit.time)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Changelog view showing weekly commit summaries with AI-generated notes
 */
export function ChangelogView() {
  const repository = useActiveRepository();
  const queryClient = useQueryClient();
  const [contributorEmail, setContributorEmail] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [weeksToShow, setWeeksToShow] = useState(12);
  const [copiedAll, setCopiedAll] = useState(false);

  // Calculate time range (last N weeks)
  const { since, until } = useMemo(() => {
    const now = new Date();
    const end = Math.floor(now.getTime() / 1000);
    const start = end - weeksToShow * 7 * 24 * 60 * 60;
    return { since: start, until: end };
  }, [weeksToShow]);

  // Fetch commits
  const {
    data: commits = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["changelog-commits", repository?.path, since, until],
    queryFn: () => getChangelogCommitsAllBranches(repository!.path, since, until),
    enabled: !!repository?.path,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Extract contributors and bucket commits
  const contributors = useMemo(() => extractContributors(commits), [commits]);

  const filteredCommits = useMemo(() => {
    if (!contributorEmail) return commits;
    return commits.filter((c) => c.authorEmail === contributorEmail);
  }, [commits, contributorEmail]);

  const weekBuckets = useMemo(
    () => bucketCommitsByWeek(filteredCommits),
    [filteredCommits]
  );

  // Auto-expand most recent week
  useMemo(() => {
    if (weekBuckets.length > 0 && expandedWeeks.size === 0) {
      setExpandedWeeks(new Set([weekBuckets[0].weekStart]));
    }
  }, [weekBuckets]);

  const toggleWeek = useCallback((weekStart: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekStart)) {
        next.delete(weekStart);
      } else {
        next.add(weekStart);
      }
      return next;
    });
  }, []);

  const handleLoadMore = useCallback(() => {
    setWeeksToShow((prev) => prev + 12);
  }, []);

  // Copy all visible weeks as Markdown
  const handleCopyAll = useCallback(() => {
    if (!repository) return;

    const sections = weekBuckets.map((bucket) => {
      // Try to get summary from react-query cache or localStorage
      const summaryKey = [
        "changelog-summary",
        repository.path,
        bucket.weekStart,
        contributorEmail ?? "all",
      ];
      const cachedSummary = queryClient.getQueryData<string>(summaryKey) ??
        getCachedSummary(repository.path, bucket.weekStart, contributorEmail);

      const commitLines = bucket.commits
        .map((c) => `- ${c.summary} (${c.shortId})`)
        .join("\n");

      return `## Week of ${bucket.weekLabel}

${cachedSummary ? `### Summary\n${cachedSummary}\n\n` : ""}### Commits (${bucket.commits.length})
${commitLines}`;
    });

    const fullMarkdown = `# Changelog

${sections.join("\n\n---\n\n")}
`;
    navigator.clipboard.writeText(fullMarkdown);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [weekBuckets, repository, contributorEmail, queryClient]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <ListBullets
            size={48}
            weight="duotone"
            className="mx-auto text-text-muted mb-3 animate-pulse"
          />
          <p className="text-text-muted text-sm">Loading changelog...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center max-w-md px-4">
          <ListBullets
            size={48}
            weight="duotone"
            className="mx-auto text-accent-red mb-3"
          />
          <p className="text-text-primary mb-1 font-medium">
            Failed to load changelog
          </p>
          <p className="text-text-muted text-sm">
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no repository)
  if (!repository) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <ListBullets
            size={48}
            weight="duotone"
            className="mx-auto text-text-muted mb-3"
          />
          <p className="text-text-muted text-sm">No repository selected</p>
        </div>
      </div>
    );
  }

  const hasData = filteredCommits.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-auto">
      <div className="flex-1 p-8">
        <div className="w-full max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-text-primary">
                Changelog
              </h2>
              <p className="text-sm text-text-muted">
                Weekly commit summaries with AI-generated release notes
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Copy all button */}
              {hasData && (
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary bg-bg-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-colors"
                  title="Copy all weeks as Markdown"
                >
                  {copiedAll ? (
                    <Check size={14} weight="bold" className="text-accent-green" />
                  ) : (
                    <DownloadSimple size={14} weight="bold" />
                  )}
                  <span>{copiedAll ? "Copied!" : "Export All"}</span>
                </button>
              )}

              {/* Contributor filter */}
              {contributors.length > 0 && (
                <ContributorFilter
                  contributors={contributors}
                  selectedEmail={contributorEmail}
                  onSelect={setContributorEmail}
                />
              )}
            </div>
          </div>

          {/* Week buckets */}
          {hasData ? (
            <div className="space-y-4">
              {weekBuckets.map((bucket) => (
                <WeekSection
                  key={bucket.weekStart}
                  bucket={bucket}
                  repoPath={repository.path}
                  contributorEmail={contributorEmail}
                  isExpanded={expandedWeeks.has(bucket.weekStart)}
                  onToggle={() => toggleWeek(bucket.weekStart)}
                />
              ))}

              {/* Load more button */}
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded-md border border-border-primary transition-colors"
                >
                  Load more weeks
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <ListBullets
                size={48}
                weight="duotone"
                className="text-text-muted mb-3"
              />
              <p className="text-text-primary font-medium mb-1">
                No commits in this period
              </p>
              <p className="text-text-muted text-sm">
                {contributorEmail
                  ? "This contributor has no commits in the selected time range"
                  : "This repository has no commits in the selected time range"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
