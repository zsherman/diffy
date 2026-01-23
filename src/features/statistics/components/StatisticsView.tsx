import { useEffect } from "react";
import {
  ChartBar,
  CalendarBlank,
  Fire,
  GitCommit,
  TrendUp,
  Clock,
  CalendarCheck,
  Users,
} from "@phosphor-icons/react";
import { useActiveRepository } from "../../../stores/tabs-store";
import { useActiveTabStatistics } from "../../../stores/tabs-store";
import { useTheme } from "../../../stores/ui-store";
import { useContributionData } from "../hooks/useContributionData";
import { useContributorReview } from "../hooks/useContributorReview";
import { ContributionCalendar } from "./ContributionCalendar";
import { CalendarLegend } from "./CalendarLegend";
import { ContributorFilter } from "./ContributorFilter";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { ContributorReview } from "./ContributorReview";
import {
  CommitsOverTimeChart,
  CommitsByDayChart,
  CommitsByHourChart,
  TopContributorsChart,
} from "./charts";

/**
 * Get time range description text
 */
function getTimeRangeText(months: number): string {
  if (months < 1) return "Last week";
  if (months === 1) return "Last month";
  return `Last ${months} months`;
}

/**
 * Main statistics view showing contribution calendar, summary metrics, and charts
 */
export function StatisticsView() {
  const repository = useActiveRepository();
  const {
    statisticsContributorEmail,
    setStatisticsContributorEmail,
    statisticsTimeRange,
    setStatisticsTimeRange,
  } = useActiveTabStatistics();
  const { theme } = useTheme();

  const {
    contributionsByDay,
    contributors,
    maxCount,
    summary,
    chartData,
    isLoading,
    isError,
    error,
  } = useContributionData({
    repoPath: repository?.path ?? "",
    months: statisticsTimeRange,
    contributorEmail: statisticsContributorEmail,
  });

  // Get the selected contributor's name for the review component
  const selectedContributor = contributors.find(
    (c) => c.email === statisticsContributorEmail
  );

  // Contributor review hook
  const {
    review,
    isGenerating,
    error: reviewError,
    generateReview,
    clearReview,
  } = useContributorReview({
    repoPath: repository?.path ?? "",
    contributorEmail: statisticsContributorEmail,
    timeRangeMonths: statisticsTimeRange,
  });

  // Clear review when contributor or time range changes
  useEffect(() => {
    clearReview();
  }, [statisticsContributorEmail, statisticsTimeRange, clearReview]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <ChartBar
            size={48}
            weight="duotone"
            className="mx-auto text-text-muted mb-3 animate-pulse"
          />
          <p className="text-text-muted text-sm">Loading statistics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center max-w-md px-4">
          <ChartBar
            size={48}
            weight="duotone"
            className="mx-auto text-accent-red mb-3"
          />
          <p className="text-text-primary mb-1 font-medium">
            Failed to load statistics
          </p>
          <p className="text-text-muted text-sm">
            {error?.message ?? "An unknown error occurred"}
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
          <ChartBar
            size={48}
            weight="duotone"
            className="mx-auto text-text-muted mb-3"
          />
          <p className="text-text-muted text-sm">No repository selected</p>
        </div>
      </div>
    );
  }

  // Empty state (no commits in range)
  const hasData = summary.totalCommits > 0;
  const showTopContributors =
    !statisticsContributorEmail && chartData.topContributors.length > 1;
  const showContributorReview = !!statisticsContributorEmail && hasData;

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-auto">
      <div className="flex-1 p-8">
        <div className="w-full max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-text-primary">
                Contribution Activity
              </h2>
              <p className="text-sm text-text-muted">
                {getTimeRangeText(statisticsTimeRange)} of commit activity
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <TimeRangeSelector
                value={statisticsTimeRange}
                onChange={setStatisticsTimeRange}
              />
              {contributors.length > 0 && (
                <ContributorFilter
                  contributors={contributors}
                  selectedEmail={statisticsContributorEmail}
                  onSelect={setStatisticsContributorEmail}
                />
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <GitCommit size={16} weight="bold" />
                <span className="text-xs uppercase tracking-wide">
                  Total Commits
                </span>
              </div>
              <p className="text-2xl font-semibold text-text-primary">
                {summary.totalCommits.toLocaleString()}
              </p>
            </div>

            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <CalendarBlank size={16} weight="bold" />
                <span className="text-xs uppercase tracking-wide">
                  Active Days
                </span>
              </div>
              <p className="text-2xl font-semibold text-text-primary">
                {summary.activeDays.toLocaleString()}
              </p>
            </div>

            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Fire size={16} weight="bold" />
                <span className="text-xs uppercase tracking-wide">
                  Current Streak
                </span>
              </div>
              <p className="text-2xl font-semibold text-text-primary">
                {summary.currentStreak}{" "}
                <span className="text-sm font-normal text-text-muted">
                  day{summary.currentStreak !== 1 ? "s" : ""}
                </span>
              </p>
            </div>

            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <TrendUp size={16} weight="bold" />
                <span className="text-xs uppercase tracking-wide">
                  Avg/Week
                </span>
              </div>
              <p className="text-2xl font-semibold text-text-primary">
                {summary.avgCommitsPerWeek.toFixed(1)}
              </p>
            </div>
          </div>

          {/* AI Contributor Review - only when a contributor is selected */}
          {showContributorReview && selectedContributor && (
            <ContributorReview
              contributorName={selectedContributor.name}
              review={review}
              isGenerating={isGenerating}
              error={reviewError}
              onGenerate={generateReview}
              onClear={clearReview}
            />
          )}

          {/* Calendar */}
          <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
            {hasData ? (
              <>
                <div className="overflow-x-auto pb-2">
                  <ContributionCalendar
                    contributionsByDay={contributionsByDay}
                    maxCount={maxCount}
                    months={statisticsTimeRange}
                  />
                </div>

                {/* Legend */}
                <div className="flex justify-end mt-4">
                  <CalendarLegend />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <CalendarBlank
                  size={48}
                  weight="duotone"
                  className="text-text-muted mb-3"
                />
                <p className="text-text-primary font-medium mb-1">
                  No contributions in this period
                </p>
                <p className="text-text-muted text-sm">
                  {statisticsContributorEmail
                    ? `This contributor has no commits in the ${getTimeRangeText(statisticsTimeRange).toLowerCase()}`
                    : `This repository has no commits in the ${getTimeRangeText(statisticsTimeRange).toLowerCase()}`}
                </p>
              </div>
            )}
          </div>

          {/* Activity Trends - Commits Over Time */}
          {hasData && (
            <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
              <div className="flex items-center gap-2 text-text-muted mb-4">
                <TrendUp size={16} weight="bold" />
                <span className="text-sm font-medium text-text-primary">
                  Commits Over Time
                </span>
                <span className="text-xs text-text-muted">(weekly)</span>
              </div>
              <div className="h-48">
                <CommitsOverTimeChart
                  key={`commits-time-${theme}-${statisticsTimeRange}`}
                  weeklyBuckets={chartData.weeklyBuckets}
                />
              </div>
            </div>
          )}

          {/* Commit Patterns - Day of Week & Hour */}
          {hasData && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
                <div className="flex items-center gap-2 text-text-muted mb-4">
                  <CalendarCheck size={16} weight="bold" />
                  <span className="text-sm font-medium text-text-primary">
                    Activity by Day
                  </span>
                </div>
                <div className="h-40">
                  <CommitsByDayChart
                    key={`commits-day-${theme}`}
                    dayBuckets={chartData.dayBuckets}
                  />
                </div>
              </div>

              <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
                <div className="flex items-center gap-2 text-text-muted mb-4">
                  <Clock size={16} weight="bold" />
                  <span className="text-sm font-medium text-text-primary">
                    Activity by Hour
                  </span>
                </div>
                <div className="h-40">
                  <CommitsByHourChart
                    key={`commits-hour-${theme}`}
                    hourBuckets={chartData.hourBuckets}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Top Contributors - only when "All contributors" selected */}
          {hasData && showTopContributors && (
            <div className="bg-bg-secondary rounded-lg p-6 border border-border-primary">
              <div className="flex items-center gap-2 text-text-muted mb-4">
                <Users size={16} weight="bold" />
                <span className="text-sm font-medium text-text-primary">
                  Top Contributors
                </span>
              </div>
              <div className="h-64">
                <TopContributorsChart
                  key={`contributors-${theme}`}
                  contributors={chartData.topContributors}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
