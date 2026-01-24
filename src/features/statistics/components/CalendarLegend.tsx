interface CalendarLegendProps {
  /** Time range in months - used to adjust legend for week strip view */
  months?: number;
}

/**
 * Legend for contribution calendar showing color intensity levels.
 */
export function CalendarLegend({ months = 12 }: CalendarLegendProps) {
  const levels = [0, 1, 2, 3, 4] as const;
  const levelOpacity = {
    0: 1, // Using bg-tertiary, so full opacity
    1: 0.25,
    2: 0.45,
    3: 0.65,
    4: 1,
  };

  // Week strip (months < 1) uses larger legend cells
  const isWeekStrip = months < 1;
  const cellSize = isWeekStrip ? 14 : 11;
  const cellGap = isWeekStrip ? 3 : 2;
  const borderRadius = isWeekStrip ? 4 : 2;

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted">
      <span>Less</span>
      <div className="flex" style={{ gap: cellGap }}>
        {levels.map((level) => (
          <div
            key={level}
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius,
              backgroundColor:
                level === 0
                  ? "var(--bg-tertiary)"
                  : "var(--accent-green)",
              opacity: level === 0 ? 1 : levelOpacity[level],
            }}
            title={level === 0 ? "No contributions" : `Level ${level}`}
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}
