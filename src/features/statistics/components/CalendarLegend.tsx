/**
 * Legend for contribution calendar showing color intensity levels
 */
export function CalendarLegend() {
  const levels = [0, 1, 2, 3, 4] as const;
  const levelOpacity = {
    0: 1, // Using bg-tertiary, so full opacity
    1: 0.25,
    2: 0.45,
    3: 0.65,
    4: 1,
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted">
      <span>Less</span>
      <div className="flex gap-0.5">
        {levels.map((level) => (
          <div
            key={level}
            className="w-[11px] h-[11px] rounded-sm"
            style={{
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

