import { useMemo } from "react";
import type { Options } from "uplot";
import { UPlotChart, getThemeColors, getValueAxisConfig } from "./UPlotChart";
import type { DistributionBucket } from "../../utils/series";
import { distributionToUPlotData } from "../../utils/series";

interface CommitsByDayChartProps {
  dayBuckets: DistributionBucket[];
}

/**
 * Commits by day of week - bar chart
 */
export function CommitsByDayChart({ dayBuckets }: CommitsByDayChartProps) {
  const data = useMemo(() => distributionToUPlotData(dayBuckets), [dayBuckets]);
  const labels = useMemo(() => dayBuckets.map((b) => b.label), [dayBuckets]);

  const options = useMemo((): Omit<Options, "width" | "height"> => {
    const colors = getThemeColors();
    const barWidth = 0.6;

    return {
      padding: [16, 16, 0, 0],
      cursor: {
        show: true,
        x: true,
        y: false,
        drag: { x: false, y: false },
      },
      legend: {
        show: false,
      },
      scales: {
        x: {
          time: false,
          range: [-0.5, 6.5],
        },
        y: {
          auto: true,
          range: (u, min, max) => [0, Math.max(max * 1.1, 1)],
        },
      },
      axes: [
        {
          stroke: colors.textMuted,
          grid: { show: false },
          ticks: { show: false },
          font: "11px 'JetBrains Mono', monospace",
          values: (u, vals) => vals.map((v) => labels[Math.round(v)] ?? ""),
          space: 40,
          gap: 8,
        },
        {
          ...getValueAxisConfig(),
          values: (u, vals) => vals.map((v) => Math.round(v).toString()),
          size: 40,
        },
      ],
      series: [
        {},
        {
          label: "Commits",
          stroke: colors.accentGreen,
          fill: colors.accentGreen,
          width: 0,
          points: { show: false },
          paths: (u, seriesIdx, idx0, idx1) => {
            const xdata = u.data[0];
            const ydata = u.data[seriesIdx];

            const fill = new Path2D();

            for (let i = idx0; i <= idx1; i++) {
              const xVal = xdata[i];
              const yVal = ydata[i];

              if (xVal == null || yVal == null) continue;

              const x = u.valToPos(xVal, "x", true);
              const y = u.valToPos(yVal, "y", true);
              const y0 = u.valToPos(0, "y", true);

              // Calculate bar dimensions
              const pxPerUnit = Math.abs(u.valToPos(1, "x", true) - u.valToPos(0, "x", true));
              const barPx = pxPerUnit * barWidth;
              const left = x - barPx / 2;

              // Draw rounded rect bar
              const radius = 3;
              const height = y0 - y;
              
              if (height > 0) {
                fill.moveTo(left + radius, y);
                fill.lineTo(left + barPx - radius, y);
                fill.arcTo(left + barPx, y, left + barPx, y + radius, radius);
                fill.lineTo(left + barPx, y0);
                fill.lineTo(left, y0);
                fill.lineTo(left, y + radius);
                fill.arcTo(left, y, left + radius, y, radius);
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
  }, [labels]);

  if (dayBuckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No commit data available
      </div>
    );
  }

  return <UPlotChart options={options} data={data} className="h-full" />;
}

