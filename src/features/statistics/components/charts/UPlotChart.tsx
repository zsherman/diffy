import { useRef, useEffect, useCallback } from "react";
import uPlot from "uplot";
import type { Options, AlignedData } from "uplot";

interface UPlotChartProps {
  options: Omit<Options, "width" | "height">;
  data: AlignedData;
  className?: string;
}

/**
 * Reusable uPlot React wrapper with:
 * - Auto resize via ResizeObserver
 * - Proper cleanup on unmount
 * - Data updates via setData()
 * - Theme-aware styling
 */
export function UPlotChart({ options, data, className = "" }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Create or update the plot
  const createPlot = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Destroy existing plot
    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const fullOptions: Options = {
      ...options,
      width,
      height,
    };

    plotRef.current = new uPlot(fullOptions, data, container);
  }, [options, data]);

  // Initialize plot and set up ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create initial plot
    createPlot();

    // Set up resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (plotRef.current && width > 0 && height > 0) {
        plotRef.current.setSize({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [createPlot]);

  // Update data when it changes
  useEffect(() => {
    if (plotRef.current) {
      plotRef.current.setData(data);
    }
  }, [data]);

  return (
    <div
      ref={containerRef}
      className={`uplot-container ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/**
 * Get CSS variable value from the document
 */
export function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Common theme colors for uPlot charts
 */
export function getThemeColors() {
  return {
    textPrimary: getCSSVar("--text-primary") || "#fbfbfb",
    textMuted: getCSSVar("--text-muted") || "#84848A",
    bgPrimary: getCSSVar("--bg-primary") || "#070707",
    bgSecondary: getCSSVar("--bg-secondary") || "#141415",
    bgTertiary: getCSSVar("--bg-tertiary") || "#1F1F21",
    borderPrimary: getCSSVar("--border-primary") || "#424245",
    accentBlue: getCSSVar("--accent-blue") || "#009fff",
    accentGreen: getCSSVar("--accent-green") || "#00cab1",
    accentRed: getCSSVar("--accent-red") || "#ff2e3f",
    accentYellow: getCSSVar("--accent-yellow") || "#ffca00",
    accentPurple: getCSSVar("--accent-purple") || "#c635e4",
  };
}

/**
 * Common axis configuration for time series charts
 */
export function getTimeAxisConfig(): Partial<uPlot.Axis> {
  const colors = getThemeColors();
  return {
    stroke: colors.textMuted,
    grid: {
      stroke: colors.borderPrimary,
      width: 1,
    },
    ticks: {
      stroke: colors.borderPrimary,
      width: 1,
    },
    font: "11px 'JetBrains Mono', monospace",
  };
}

/**
 * Common axis configuration for value axis
 */
export function getValueAxisConfig(): Partial<uPlot.Axis> {
  const colors = getThemeColors();
  return {
    stroke: colors.textMuted,
    grid: {
      stroke: colors.borderPrimary,
      width: 1,
    },
    ticks: {
      stroke: colors.borderPrimary,
      width: 1,
    },
    font: "11px 'JetBrains Mono', monospace",
  };
}

