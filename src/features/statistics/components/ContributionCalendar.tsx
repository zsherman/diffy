import { useMemo } from "react";
import {
  buildWeeksGrid,
  formatDateKey,
  formatDateForTooltip,
  getContributionLevel,
  getMonthLabel,
  getStartOfToday,
} from "../utils/date-utils";

interface ContributionCalendarProps {
  contributionsByDay: Map<string, number>;
  maxCount: number;
  months?: number;
}

// Cell dimensions
const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;

// Day labels (Mon, Wed, Fri for GitHub-style)
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const LABEL_WIDTH = 32;

// Level colors using opacity on accent-green
const LEVEL_OPACITY = {
  0: 1, // bg-tertiary
  1: 0.25,
  2: 0.45,
  3: 0.65,
  4: 1,
};

/**
 * GitHub-style contribution calendar SVG
 * Renders a grid of cells representing contribution counts per day
 */
export function ContributionCalendar({
  contributionsByDay,
  maxCount,
  months = 12,
}: ContributionCalendarProps) {
  // Build the weeks grid
  const weeks = useMemo(
    () => buildWeeksGrid(getStartOfToday(), months, 0), // 0 = Sunday start
    [months],
  );

  // Calculate dimensions
  const width = LABEL_WIDTH + weeks.length * CELL_TOTAL;
  const height = 7 * CELL_TOTAL + 20; // +20 for month labels

  // Get month labels and their positions
  const monthLabels = useMemo(() => {
    const labels: { label: string; x: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      const month = firstDayOfWeek.getMonth();

      // Add label when month changes
      if (month !== lastMonth) {
        labels.push({
          label: getMonthLabel(firstDayOfWeek),
          x: LABEL_WIDTH + weekIndex * CELL_TOTAL,
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [weeks]);

  return (
    <svg
      width={width}
      height={height}
      className="select-none"
      role="img"
      aria-label="Contribution calendar"
    >
      {/* Month labels */}
      {monthLabels.map(({ label, x }, index) => (
        <text
          key={`month-${index}`}
          x={x}
          y={10}
          className="fill-text-muted text-[10px]"
        >
          {label}
        </text>
      ))}

      {/* Day labels */}
      {DAY_LABELS.map((label, index) => (
        <text
          key={`day-${index}`}
          x={0}
          y={20 + index * CELL_TOTAL + CELL_SIZE - 2}
          className="fill-text-muted text-[10px]"
        >
          {label}
        </text>
      ))}

      {/* Calendar cells */}
      {weeks.map((week, weekIndex) =>
        week.map((date, dayIndex) => {
          const key = formatDateKey(date);
          const count = contributionsByDay.get(key) ?? 0;
          const level = getContributionLevel(count, maxCount);

          // Don't render future dates
          const today = getStartOfToday();
          if (date > today) return null;

          const x = LABEL_WIDTH + weekIndex * CELL_TOTAL;
          const y = 20 + dayIndex * CELL_TOTAL;

          const tooltipText = `${formatDateForTooltip(date)}: ${count} commit${count !== 1 ? "s" : ""}`;

          return (
            <rect
              key={key}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              fill={level === 0 ? "var(--bg-tertiary)" : "var(--accent-green)"}
              fillOpacity={LEVEL_OPACITY[level]}
              className="transition-opacity hover:opacity-80"
            >
              <title>{tooltipText}</title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}

