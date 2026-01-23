/**
 * Utilities for deriving chart-ready series from CommitActivity data
 */
import type { CommitActivity } from "../../../types/git";

/**
 * Weekly bucket for commits over time
 */
export interface WeeklyBucket {
  weekStart: number; // Unix timestamp (seconds) of week start
  count: number;
}

/**
 * Distribution bucket for day/hour patterns
 */
export interface DistributionBucket {
  label: string;
  value: number;
  count: number;
}

/**
 * Contributor stats for top contributors chart
 */
export interface ContributorStats {
  name: string;
  email: string;
  count: number;
}

/**
 * Get the start of the week (Sunday) for a given timestamp
 */
function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Aggregate commits into weekly buckets
 * Returns array sorted by weekStart ascending
 */
export function aggregateWeekly(
  activity: CommitActivity[],
  since: number,
  until: number,
): WeeklyBucket[] {
  // Create a map of week start -> count
  const buckets = new Map<number, number>();

  // Initialize all weeks in range (so we have zeros for empty weeks)
  let currentWeek = getWeekStart(since);
  const endWeek = getWeekStart(until);
  while (currentWeek <= endWeek) {
    buckets.set(currentWeek, 0);
    currentWeek += 7 * 24 * 60 * 60; // Add 7 days in seconds
  }

  // Count commits per week
  for (const commit of activity) {
    const weekStart = getWeekStart(commit.time);
    if (weekStart >= getWeekStart(since) && weekStart <= endWeek) {
      buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + 1);
    }
  }

  // Convert to sorted array
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekStart, count]) => ({ weekStart, count }));
}

/**
 * Aggregate commits by day of week (0=Sun, 6=Sat)
 */
export function aggregateByDayOfWeek(
  activity: CommitActivity[],
): DistributionBucket[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = Array.from({ length: 7 }, () => 0);

  for (const commit of activity) {
    const date = new Date(commit.time * 1000);
    const day = date.getDay();
    counts[day]++;
  }

  return days.map((label, index) => ({
    label,
    value: index,
    count: counts[index],
  }));
}

/**
 * Aggregate commits by hour of day (0-23)
 */
export function aggregateByHour(
  activity: CommitActivity[],
): DistributionBucket[] {
  const counts = Array.from({ length: 24 }, () => 0);

  for (const commit of activity) {
    const date = new Date(commit.time * 1000);
    const hour = date.getHours();
    counts[hour]++;
  }

  return counts.map((count, hour) => ({
    label: `${hour.toString().padStart(2, "0")}:00`,
    value: hour,
    count,
  }));
}

/**
 * Get top N contributors by commit count
 */
export function getTopContributors(
  activity: CommitActivity[],
  limit: number = 10,
): ContributorStats[] {
  const contributorMap = new Map<
    string,
    { name: string; email: string; count: number }
  >();

  for (const commit of activity) {
    const existing = contributorMap.get(commit.authorEmail);
    if (existing) {
      existing.count++;
    } else {
      contributorMap.set(commit.authorEmail, {
        name: commit.authorName,
        email: commit.authorEmail,
        count: 1,
      });
    }
  }

  return Array.from(contributorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Calculate average commits per week
 */
export function calculateAvgCommitsPerWeek(weeklyBuckets: WeeklyBucket[]): number {
  if (weeklyBuckets.length === 0) return 0;
  
  const total = weeklyBuckets.reduce((sum, bucket) => sum + bucket.count, 0);
  // Don't count weeks with 0 commits at the start/end of range
  const nonEmptyWeeks = weeklyBuckets.filter((b) => b.count > 0).length;
  
  if (nonEmptyWeeks === 0) return 0;
  return total / nonEmptyWeeks;
}

/**
 * Convert weekly buckets to uPlot-compatible AlignedData format
 * Returns [timestamps, counts] where timestamps are in seconds
 */
export function weeklyToUPlotData(
  buckets: WeeklyBucket[],
): [number[], number[]] {
  const timestamps = buckets.map((b) => b.weekStart);
  const counts = buckets.map((b) => b.count);
  return [timestamps, counts];
}

/**
 * Convert distribution buckets to uPlot-compatible format for bar charts
 * Returns [x values (indices), counts]
 */
export function distributionToUPlotData(
  buckets: DistributionBucket[],
): [number[], number[]] {
  const xValues = buckets.map((_, i) => i);
  const counts = buckets.map((b) => b.count);
  return [xValues, counts];
}

/**
 * Convert contributor stats to uPlot-compatible format for horizontal bar chart
 * Returns [indices, counts] and labels separately
 */
export function contributorsToUPlotData(
  contributors: ContributorStats[],
): { data: [number[], number[]]; labels: string[] } {
  const indices = contributors.map((_, i) => i);
  const counts = contributors.map((c) => c.count);
  const labels = contributors.map((c) => c.name);
  return { data: [indices, counts], labels };
}

