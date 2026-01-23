import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCommitHistoryAllBranches,
  generateContributorReview,
  type ContributorReviewData,
} from "../../../lib/tauri";
import type { CommitInfo } from "../../../types/git";

interface UseContributorReviewOptions {
  repoPath: string;
  contributorEmail: string | null;
  timeRangeMonths: number;
}

interface UseContributorReviewResult {
  review: ContributorReviewData | null;
  isGenerating: boolean;
  error: Error | null;
  generateReview: () => Promise<void>;
  clearReview: () => void;
}

/**
 * Get time range label for display
 */
function getTimeRangeLabel(months: number): string {
  const now = new Date();
  const start = new Date(now);
  
  if (months < 1) {
    // Week case
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - months);
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(now)}`;
}

/**
 * Hook to generate AI contributor reviews
 */
export function useContributorReview({
  repoPath,
  contributorEmail,
  timeRangeMonths,
}: UseContributorReviewOptions): UseContributorReviewResult {
  const [review, setReview] = useState<ContributorReviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Calculate time range (handle week case where timeRangeMonths < 1)
  const since = Math.floor(
    new Date(
      Date.now() - (timeRangeMonths < 1 ? 7 : timeRangeMonths * 30) * 24 * 60 * 60 * 1000
    ).getTime() / 1000
  );

  // Fetch commit history (used when generating review)
  // We fetch a larger set and filter client-side
  const { data: allCommits } = useQuery({
    queryKey: ["commit-history-all", repoPath],
    queryFn: () => getCommitHistoryAllBranches(repoPath, 1000, 0),
    enabled: !!repoPath,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const generateReview = useCallback(async () => {
    if (!contributorEmail || !allCommits) {
      setError(new Error("No contributor selected or no commit data"));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Filter commits by contributor and time range
      const filteredCommits: CommitInfo[] = allCommits.filter(
        (c) => c.authorEmail === contributorEmail && c.time >= since
      );

      if (filteredCommits.length === 0) {
        setError(new Error("No commits found for this contributor in the selected time range"));
        setIsGenerating(false);
        return;
      }

      // Get contributor name from first commit
      const contributorName = filteredCommits[0].authorName;

      // Aggregate stats
      const totalCommits = filteredCommits.length;
      const totalFilesChanged = filteredCommits.reduce((sum, c) => sum + c.filesChanged, 0);
      const totalAdditions = filteredCommits.reduce((sum, c) => sum + c.additions, 0);
      const totalDeletions = filteredCommits.reduce((sum, c) => sum + c.deletions, 0);

      // Get commit summaries (first line of commit message)
      const commitSummaries = filteredCommits.map((c) => c.summary);

      // Call AI
      const result = await generateContributorReview({
        contributorName,
        contributorEmail,
        timeRangeLabel: getTimeRangeLabel(timeRangeMonths),
        commitSummaries,
        totalCommits,
        totalFilesChanged,
        totalAdditions,
        totalDeletions,
      });

      setReview(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsGenerating(false);
    }
  }, [contributorEmail, allCommits, since, timeRangeMonths]);

  const clearReview = useCallback(() => {
    setReview(null);
    setError(null);
  }, []);

  return {
    review,
    isGenerating,
    error,
    generateReview,
    clearReview,
  };
}

