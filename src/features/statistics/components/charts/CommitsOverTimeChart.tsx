import { useMemo } from "react";
import type { Options } from "uplot";
import { UPlotChart, getThemeColors, getTimeAxisConfig, getValueAxisConfig } from "./UPlotChart";
import type { WeeklyBucket } from "../../utils/series";
import { weeklyToUPlotData } from "../../utils/series";

interface CommitsOverTimeChartProps {
  weeklyBuckets: WeeklyBucket[];
}

/**
 * Weekly commits over time - line/area chart
 */
export function CommitsOverTimeChart({ weeklyBuckets }: CommitsOverTimeChartProps) {
  const data = useMemo(() => weeklyToUPlotData(weeklyBuckets), [weeklyBuckets]);

  const options = useMemo((): Omit<Options, "width" | "height"> => {
    const colors = getThemeColors();
    
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
          time: true,
        },
        y: {
          auto: true,
          range: (u, min, max) => [0, Math.max(max * 1.1, 1)],
        },
      },
      axes: [
        {
          ...getTimeAxisConfig(),
          values: (u, vals) => vals.map((v) => {
            const date = new Date(v * 1000);
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          }),
          space: 60,
          incrs: [
            // Weekly intervals
            7 * 24 * 60 * 60,
            14 * 24 * 60 * 60,
            28 * 24 * 60 * 60,
          ],
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
          stroke: colors.accentBlue,
          fill: `${colors.accentBlue}33`,
          width: 2,
          points: {
            show: false,
          },
          paths: (u, seriesIdx, idx0, idx1) => {
            // Area fill with smooth curve
            const xdata = u.data[0];
            const ydata = u.data[seriesIdx];
            
            const stroke = new Path2D();
            const fill = new Path2D();
            
            const xScale = u.scales.x;
            const yScale = u.scales.y;
            
            if (!xScale || !yScale) return null;
            
            let started = false;
            
            for (let i = idx0; i <= idx1; i++) {
              const xVal = xdata[i];
              const yVal = ydata[i];
              
              if (xVal == null || yVal == null) continue;
              
              const x = u.valToPos(xVal, "x", true);
              const y = u.valToPos(yVal, "y", true);
              
              if (!started) {
                stroke.moveTo(x, y);
                fill.moveTo(x, u.valToPos(0, "y", true));
                fill.lineTo(x, y);
                started = true;
              } else {
                stroke.lineTo(x, y);
                fill.lineTo(x, y);
              }
            }
            
            if (started) {
              const lastX = u.valToPos(xdata[idx1]!, "x", true);
              fill.lineTo(lastX, u.valToPos(0, "y", true));
              fill.closePath();
            }
            
            return {
              stroke,
              fill,
            };
          },
        },
      ],
    };
  }, []);

  if (weeklyBuckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No commit data available
      </div>
    );
  }

  return <UPlotChart options={options} data={data} className="h-full" />;
}

