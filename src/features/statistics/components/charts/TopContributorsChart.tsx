import { useMemo } from "react";
import type { Options } from "uplot";
import { UPlotChart, getThemeColors } from "./UPlotChart";
import type { ContributorStats } from "../../utils/series";
import { contributorsToUPlotData } from "../../utils/series";

interface TopContributorsChartProps {
  contributors: ContributorStats[];
}

/**
 * Top contributors - horizontal bar chart
 */
export function TopContributorsChart({ contributors }: TopContributorsChartProps) {
  const { data, labels } = useMemo(
    () => contributorsToUPlotData(contributors),
    [contributors],
  );

  const maxCount = useMemo(
    () => Math.max(...contributors.map((c) => c.count), 1),
    [contributors],
  );

  const options = useMemo((): Omit<Options, "width" | "height"> => {
    const colors = getThemeColors();
    const barWidth = 0.6;
    const numBars = contributors.length;

    return {
      padding: [8, 16, 0, 0],
      cursor: {
        show: true,
        x: false,
        y: true,
        drag: { x: false, y: false },
      },
      legend: {
        show: false,
      },
      scales: {
        // Swap x and y for horizontal bars
        x: {
          time: false,
          range: [0, maxCount * 1.1],
        },
        y: {
          time: false,
          range: [-0.5, numBars - 0.5],
          dir: -1, // Reverse so first contributor is at top
        },
      },
      axes: [
        {
          // X axis (count)
          stroke: colors.textMuted,
          grid: {
            stroke: colors.borderPrimary,
            width: 1,
          },
          ticks: { show: false },
          font: "11px 'JetBrains Mono', monospace",
          values: (u, vals) => vals.map((v) => Math.round(v).toString()),
          size: 24,
          gap: 4,
        },
        {
          // Y axis (names)
          stroke: colors.textMuted,
          grid: { show: false },
          ticks: { show: false },
          font: "11px 'JetBrains Mono', monospace",
          values: (u, vals) => {
            return vals.map((v) => {
              const idx = Math.round(v);
              const name = labels[idx];
              // Truncate long names
              if (name && name.length > 12) {
                return name.slice(0, 12) + "…";
              }
              return name ?? "";
            });
          },
          size: 100,
          gap: 8,
          side: 3, // Left side
        },
      ],
      series: [
        {},
        {
          label: "Commits",
          stroke: colors.accentYellow,
          fill: colors.accentYellow,
          width: 0,
          points: { show: false },
          paths: (u, seriesIdx, idx0, idx1) => {
            const xdata = u.data[0]; // This is actually the Y positions (contributor indices)
            const ydata = u.data[seriesIdx]; // This is actually the X values (commit counts)

            const fill = new Path2D();

            for (let i = idx0; i <= idx1; i++) {
              const yPos = xdata[i]; // Contributor index
              const xVal = ydata[i]; // Commit count

              if (yPos == null || xVal == null) continue;

              // For horizontal bars, we swap the meaning
              const y = u.valToPos(yPos, "y", true);
              const x0 = u.valToPos(0, "x", true);
              const x1 = u.valToPos(xVal, "x", true);

              // Calculate bar height
              const pxPerUnit = Math.abs(u.valToPos(1, "y", true) - u.valToPos(0, "y", true));
              const barPx = pxPerUnit * barWidth;
              const top = y - barPx / 2;

              // Draw horizontal rounded rect bar
              const radius = 3;
              const width = x1 - x0;

              if (width > 0) {
                fill.moveTo(x0, top);
                fill.lineTo(x1 - radius, top);
                fill.arcTo(x1, top, x1, top + radius, radius);
                fill.lineTo(x1, top + barPx - radius);
                fill.arcTo(x1, top + barPx, x1 - radius, top + barPx, radius);
                fill.lineTo(x0, top + barPx);
                fill.closePath();
              }
            }

            return {
              stroke: fill,
              fill,
            };
          },
        },
      ],
    };
  }, [labels, maxCount, contributors.length]);

  if (contributors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No contributor data available
      </div>
    );
  }

  return <UPlotChart options={options} data={data} className="h-full" />;
}

