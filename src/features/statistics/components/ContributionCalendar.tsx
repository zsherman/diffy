import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  buildWeeksGrid,
  buildWeekStripDays,
  formatDateKey,
  formatDateForTooltip,
  formatDayLabel,
  getContributionLevel,
  getMonthLabel,
  getStartOfToday,
} from "../utils/date-utils";

interface ContributionCalendarProps {
  contributionsByDay: Map<string, number>;
  maxCount: number;
  months?: number;
  /** Optional contributor name to show in tooltips when filtered */
  contributorName?: string;
}

// Layout constants
const LABEL_WIDTH = 32; // Width for day labels (Mon, Wed, Fri)
const MIN_CELL_WIDTH = 10;
const MIN_CELL_HEIGHT = 10;
const MAX_CELL_HEIGHT = 32;
const GAP = 3;

// Level colors using opacity on accent-green
const LEVEL_OPACITY: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 1, // bg-tertiary
  1: 0.25,
  2: 0.45,
  3: 0.65,
  4: 1,
};

// Tooltip payload type
interface TooltipPayload {
  date: string;
  count: number;
  contributorName?: string;
}

// Shared tooltip handle for all calendar cells
const calendarTooltip = Tooltip.createHandle<TooltipPayload>();

// ============================================================================
// Shared Tooltip Popup Component
// ============================================================================

function CalendarTooltipPopup() {
  return (
    <Tooltip.Root handle={calendarTooltip}>
      {({ payload }) => (
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={8}>
            <Tooltip.Popup className="px-3 py-2 rounded-md bg-bg-secondary border border-border-primary shadow-lg text-sm z-50">
              {payload && (
                <div className="space-y-0.5">
                  <div className="text-text-primary font-medium">{payload.date}</div>
                  <div className="text-text-muted">
                    {payload.count} commit{payload.count !== 1 ? "s" : ""}
                    {payload.contributorName && (
                      <span> by {payload.contributorName}</span>
                    )}
                  </div>
                </div>
              )}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      )}
    </Tooltip.Root>
  );
}

// ============================================================================
// Calendar Cell Component
// ============================================================================

interface CalendarCellProps {
  date: Date;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  width: number;
  height: number;
  contributorName?: string;
  showCount?: boolean;
  isToday?: boolean;
}

function CalendarCell({
  date,
  count,
  level,
  width,
  height,
  contributorName,
  showCount = false,
  isToday = false,
}: CalendarCellProps) {
  const payload: TooltipPayload = {
    date: formatDateForTooltip(date),
    count,
    contributorName,
  };

  const isLarge = Math.min(width, height) >= 40;
  const borderRadius = isLarge ? 6 : 2;

  return (
    <Tooltip.Trigger
      handle={calendarTooltip}
      payload={payload}
      className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-1 rounded-xs"
      render={<button type="button" aria-label={`${payload.date}: ${count} commits`} />}
    >
      <div
        className="transition-opacity hover:opacity-80 flex items-center justify-center"
        style={{
          width,
          height,
          borderRadius,
          backgroundColor: level === 0 ? "var(--bg-tertiary)" : "var(--accent-green)",
          opacity: LEVEL_OPACITY[level],
          border: isToday ? "2px solid var(--accent-green)" : "none",
          boxSizing: "border-box",
        }}
      >
        {showCount && count > 0 && (
          <span
            className="text-white font-medium pointer-events-none"
            style={{
              fontSize: Math.min(width, height) > 40 ? 14 : 12,
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            {count}
          </span>
        )}
      </div>
    </Tooltip.Trigger>
  );
}

// ============================================================================
// WeekStrip Mode - 7 large day cells for "1 week" view
// ============================================================================

interface WeekStripProps {
  contributionsByDay: Map<string, number>;
  maxCount: number;
  contributorName?: string;
}

const WEEK_CELL_SIZE = 48;
const WEEK_CELL_GAP = 8;

function WeekStrip({ contributionsByDay, maxCount, contributorName }: WeekStripProps) {
  const days = useMemo(() => buildWeekStripDays(), []);
  const today = getStartOfToday();

  return (
    <div className="flex flex-col gap-2">
      {/* Day labels row */}
      <div className="flex" style={{ gap: WEEK_CELL_GAP }}>
        {days.map((date) => {
          const { dayOfWeek, dayNum } = formatDayLabel(date);
          const isToday = date.getTime() === today.getTime();
          return (
            <div
              key={formatDateKey(date)}
              className="flex flex-col items-center"
              style={{ width: WEEK_CELL_SIZE }}
            >
              <span className={`text-[11px] ${isToday ? "text-accent-green font-medium" : "text-text-muted"}`}>
                {dayOfWeek}
              </span>
              <span className={`text-[10px] ${isToday ? "text-accent-green" : "text-text-muted"}`}>
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>
      {/* Cells row */}
      <div className="flex" style={{ gap: WEEK_CELL_GAP }}>
        {days.map((date) => {
          const key = formatDateKey(date);
          const count = contributionsByDay.get(key) ?? 0;
          const level = getContributionLevel(count, maxCount);
          const isToday = date.getTime() === today.getTime();

          return (
            <CalendarCell
              key={key}
              date={date}
              count={count}
              level={level}
              width={WEEK_CELL_SIZE}
              height={WEEK_CELL_SIZE}
              contributorName={contributorName}
              showCount={true}
              isToday={isToday}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// WeeksGrid Mode - GitHub-style week columns for 1+ months
// ============================================================================

interface WeeksGridProps {
  contributionsByDay: Map<string, number>;
  maxCount: number;
  months: number;
  contributorName?: string;
}

// Day labels (Mon, Wed, Fri for GitHub-style)
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/**
 * Calculate cell dimensions to fill available width exactly.
 * @param containerWidth - Available width for the grid
 * @param numWeeks - Number of week columns
 * @returns Cell dimensions that fill the width exactly
 */
function calculateCellDimensions(containerWidth: number, numWeeks: number): {
  cellWidth: number;
  cellHeight: number;
} {
  // Available width for cells = container - label column - gaps between weeks
  const availableWidth = containerWidth - LABEL_WIDTH - (numWeeks - 1) * GAP;
  const cellWidth = Math.max(MIN_CELL_WIDTH, availableWidth / numWeeks);
  
  // Cell height scales with width but stays shorter for a horizontal feel
  const heightRatio = 0.55; // Height is 55% of width for wide cells
  const cellHeight = Math.max(MIN_CELL_HEIGHT, Math.min(MAX_CELL_HEIGHT, cellWidth * heightRatio));
  
  return { cellWidth, cellHeight };
}

function WeeksGrid({ contributionsByDay, maxCount, months, contributorName }: WeeksGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Build the weeks grid
  const weeks = useMemo(
    () => buildWeeksGrid(getStartOfToday(), months, 0), // 0 = Sunday start
    [months],
  );

  // Measure container width on mount and resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.offsetWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Calculate cell dimensions based on container width
  const { cellWidth, cellHeight } = useMemo(() => {
    if (containerWidth === 0) {
      // Default dimensions before measurement
      return { cellWidth: 14, cellHeight: 11 };
    }
    return calculateCellDimensions(containerWidth, weeks.length);
  }, [containerWidth, weeks.length]);

  const today = getStartOfToday();

  // Get month labels and their positions (week indices where month changes)
  const monthLabels = useMemo(() => {
    const labels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      const month = firstDayOfWeek.getMonth();

      if (month !== lastMonth) {
        labels.push({
          label: getMonthLabel(firstDayOfWeek),
          weekIndex,
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [weeks]);

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-1">
      {/* Month labels row */}
      <div className="flex" style={{ marginLeft: LABEL_WIDTH }}>
        {monthLabels.map(({ label, weekIndex }, index) => {
          // Calculate the span until the next label or end
          const nextWeekIndex = monthLabels[index + 1]?.weekIndex ?? weeks.length;
          const spanWeeks = nextWeekIndex - weekIndex;
          const width = spanWeeks * (cellWidth + GAP) - GAP;

          return (
            <div
              key={`month-${index}`}
              className="text-[10px] text-text-muted"
              style={{ width, flexShrink: 0 }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Grid content */}
      <div className="flex">
        {/* Day labels column */}
        <div className="flex flex-col" style={{ width: LABEL_WIDTH, gap: GAP }}>
          {DAY_LABELS.map((label, index) => (
            <div
              key={`day-${index}`}
              className="text-[10px] text-text-muted flex items-center"
              style={{ height: cellHeight }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks columns */}
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="flex flex-col" style={{ gap: GAP }}>
              {week.map((date, _dayIndex) => {
                const key = formatDateKey(date);
                const count = contributionsByDay.get(key) ?? 0;
                const level = getContributionLevel(count, maxCount);

                // Don't render future dates
                if (date > today) {
                  return (
                    <div
                      key={key}
                      style={{ width: cellWidth, height: cellHeight }}
                    />
                  );
                }

                return (
                  <CalendarCell
                    key={key}
                    date={date}
                    count={count}
                    level={level}
                    width={cellWidth}
                    height={cellHeight}
                    contributorName={contributorName}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main ContributionCalendar component
// ============================================================================

/**
 * Adaptive contribution calendar that switches between:
 * - WeekStrip: 7 large day cells for "1 week" view (months < 1)
 * - WeeksGrid: GitHub-style week columns for 1+ months
 *
 * Features rich Base UI tooltips with contributor context.
 */
export function ContributionCalendar({
  contributionsByDay,
  maxCount,
  months = 12,
  contributorName,
}: ContributionCalendarProps) {
  return (
    <Tooltip.Provider>
      {/* Shared tooltip popup - renders once for all cells */}
      <CalendarTooltipPopup />

      {/* Calendar content */}
      {months < 1 ? (
        <WeekStrip
          contributionsByDay={contributionsByDay}
          maxCount={maxCount}
          contributorName={contributorName}
        />
      ) : (
        <WeeksGrid
          contributionsByDay={contributionsByDay}
          maxCount={maxCount}
          months={months}
          contributorName={contributorName}
        />
      )}
    </Tooltip.Provider>
  );
}
