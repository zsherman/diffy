import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCommitActivityAllBranches } from "../../../lib/tauri";
import type { CommitActivity } from "../../../types/git";
import {
  formatDateKey,
  addMonths,
  getStartOfToday,
  getEndOfToday,
  calculateStreak,
} from "../utils/date-utils";
import {
  aggregateWeekly,
  aggregateByDayOfWeek,
  aggregateByHour,
  getTopContributors,
  calculateAvgCommitsPerWeek,
  type WeeklyBucket,
  type DistributionBucket,
  type ContributorStats,
} from "../utils/series";

export interface Contributor {
  name: string;
  email: string;
  commitCount: number;
}

export interface ContributionSummary {
  totalCommits: number;
  activeDays: number;
  currentStreak: number;
  avgCommitsPerWeek: number;
}

export interface ChartData {
  weeklyBuckets: WeeklyBucket[];
  dayBuckets: DistributionBucket[];
  hourBuckets: DistributionBucket[];
  topContributors: ContributorStats[];
}

export interface ContributionData {
  contributionsByDay: Map<string, number>;
  contributors: Contributor[];
  maxCount: number;
  summary: ContributionSummary;
  chartData: ChartData;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

interface UseContributionDataOptions {
  repoPath: string;
  months?: number;
  contributorEmail?: string | null;
}

/**
 * Hook to fetch and aggregate contribution data for the calendar
 * - Fetches raw activity once per (repoPath, since, until)
 * - Aggregates by day and contributor client-side
 * - Filters by contributor without refetching
 */
export function useContributionData({
  repoPath,
  months = 12,
  contributorEmail,
}: UseContributionDataOptions): ContributionData {
  // Calculate time range (last N months)
  const { since, until } = useMemo(() => {
    const end = getEndOfToday();
    const start = addMonths(getStartOfToday(), -months);
    return {
      since: Math.floor(start.getTime() / 1000),
      until: Math.floor(end.getTime() / 1000),
    };
  }, [months]);

  // Fetch raw activity data
  const {
    data: rawActivity,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["commit-activity", repoPath, since, until],
    queryFn: () => getCommitActivityAllBranches(repoPath, since, until),
    enabled: !!repoPath,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Aggregate data - recomputed when rawActivity or contributorEmail changes
  const aggregatedData = useMemo(() => {
    const emptyChartData: ChartData = {
      weeklyBuckets: [],
      dayBuckets: [],
      hourBuckets: [],
      topContributors: [],
    };

    if (!rawActivity || rawActivity.length === 0) {
      return {
        contributionsByDay: new Map<string, number>(),
        contributors: [] as Contributor[],
        maxCount: 0,
        summary: {
          totalCommits: 0,
          activeDays: 0,
          currentStreak: 0,
          avgCommitsPerWeek: 0,
        },
        chartData: emptyChartData,
      };
    }

    // Build contributors list from all activity
    const contributorMap = new Map<
      string,
      { name: string; email: string; count: number }
    >();
    for (const activity of rawActivity) {
      const existing = contributorMap.get(activity.authorEmail);
      if (existing) {
        existing.count++;
      } else {
        contributorMap.set(activity.authorEmail, {
          name: activity.authorName,
          email: activity.authorEmail,
          count: 1,
        });
      }
    }

    const contributors: Contributor[] = Array.from(contributorMap.values())
      .map((c) => ({
        name: c.name,
        email: c.email,
        commitCount: c.count,
      }))
      .sort((a, b) => b.commitCount - a.commitCount);

    // Filter activity by contributor if specified
    const filteredActivity: CommitActivity[] = contributorEmail
      ? rawActivity.filter((a) => a.authorEmail === contributorEmail)
      : rawActivity;

    // Aggregate by day
    const contributionsByDay = new Map<string, number>();
    for (const activity of filteredActivity) {
      // Convert Unix timestamp to local date
      const date = new Date(activity.time * 1000);
      const key = formatDateKey(date);
      contributionsByDay.set(key, (contributionsByDay.get(key) ?? 0) + 1);
    }

    // Calculate max count for level scaling
    let maxCount = 0;
    for (const count of contributionsByDay.values()) {
      if (count > maxCount) maxCount = count;
    }

    // Calculate chart data from filtered activity
    const weeklyBuckets = aggregateWeekly(filteredActivity, since, until);
    const dayBuckets = aggregateByDayOfWeek(filteredActivity);
    const hourBuckets = aggregateByHour(filteredActivity);
    // Top contributors always from all activity (not filtered)
    const topContributors = getTopContributors(rawActivity, 10);

    // Calculate summary
    const totalCommits = filteredActivity.length;
    const activeDays = contributionsByDay.size;
    const currentStreak = calculateStreak(contributionsByDay, getStartOfToday());
    const avgCommitsPerWeek = calculateAvgCommitsPerWeek(weeklyBuckets);

    return {
      contributionsByDay,
      contributors,
      maxCount,
      summary: {
        totalCommits,
        activeDays,
        currentStreak,
        avgCommitsPerWeek,
      },
      chartData: {
        weeklyBuckets,
        dayBuckets,
        hourBuckets,
        topContributors,
      },
    };
  }, [rawActivity, contributorEmail, since, until]);

  return {
    ...aggregatedData,
    isLoading,
    isError,
    error: error as Error | null,
  };
}

