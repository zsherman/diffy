import { memo, useMemo } from "react";
import type { CommitGraph as CommitGraphType } from "../../../types/git";

interface CommitGraphProps {
  graph: CommitGraphType;
  rowHeight: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
}

const COLUMN_WIDTH = 20;
const NODE_RADIUS = 5;
const STROKE_WIDTH = 2.5;
const BUFFER = 5;
const COLORS = [
  '#5B9BD5', // blue
  '#6CC070', // green
  '#E5A84B', // amber
  '#B07CC6', // purple
  '#E86A6A', // red
  '#4ECDC4', // teal
  '#F5A962', // orange
  '#7C9EB2', // slate
];

// Memoized graph component to avoid re-renders when parent updates
export const CommitGraphSVG = memo(function CommitGraphSVG({
  graph,
  rowHeight,
  visibleStartIndex,
  visibleEndIndex,
}: CommitGraphProps) {
  // Memoize visible range calculation
  const { startIndex, visibleNodes } = useMemo(() => {
    if (!graph || graph.nodes.length === 0) {
      return { startIndex: 0, visibleNodes: [] };
    }
    const start = Math.max(0, visibleStartIndex - BUFFER);
    const end = Math.min(graph.nodes.length, visibleEndIndex + BUFFER);
    return {
      startIndex: start,
      visibleNodes: graph.nodes.slice(start, end),
    };
  }, [graph, visibleStartIndex, visibleEndIndex]);

  if (!graph || graph.nodes.length === 0) return null;

  const width = (graph.maxColumns + 1) * COLUMN_WIDTH;
  const height = graph.nodes.length * rowHeight;

  return (
    <svg
      width={width}
      height={height}
      className="absolute left-0 top-0 pointer-events-none"
      style={{ minWidth: width }}
    >
      {/* Render connections first (below nodes) */}
      {visibleNodes.map((node, idx) => {
        const actualIndex = startIndex + idx;
        const y = actualIndex * rowHeight + rowHeight / 2;
        const x = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
        const color = COLORS[node.column % COLORS.length];

        return node.connections.map((conn, connIdx) => {
          const targetY = conn.toRow * rowHeight + rowHeight / 2;
          const targetX = conn.toColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const lineColor = conn.isMerge ? COLORS[conn.toColumn % COLORS.length] : color;

          // Smooth S-curve for merge/diagonal lines
          if (conn.isMerge || conn.fromColumn !== conn.toColumn) {
            // Create smooth curve with better control points
            const curveStart = y + rowHeight * 0.15;
            const curveEnd = targetY - rowHeight * 0.15;
            const path = `M ${x} ${y} L ${x} ${curveStart} C ${x} ${curveStart + (curveEnd - curveStart) * 0.3}, ${targetX} ${curveEnd - (curveEnd - curveStart) * 0.3}, ${targetX} ${curveEnd} L ${targetX} ${targetY}`;
            return (
              <path
                key={`${node.commitId}-conn-${connIdx}`}
                d={path}
                fill="none"
                stroke={lineColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }

          // Straight line for same column
          return (
            <line
              key={`${node.commitId}-conn-${connIdx}`}
              x1={x}
              y1={y}
              x2={targetX}
              y2={targetY}
              stroke={color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          );
        });
      })}

      {/* Render nodes on top */}
      {visibleNodes.map((node, idx) => {
        const actualIndex = startIndex + idx;
        const y = actualIndex * rowHeight + rowHeight / 2;
        const x = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
        const color = COLORS[node.column % COLORS.length];

        return (
          <g key={`${node.commitId}-node`}>
            {/* Outer glow */}
            <circle
              cx={x}
              cy={y}
              r={NODE_RADIUS + 1}
              fill="none"
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.3}
            />
            {/* Main node */}
            <circle
              cx={x}
              cy={y}
              r={NODE_RADIUS}
              fill={color}
              stroke="var(--bg-primary)"
              strokeWidth={2}
            />
            {/* Inner highlight */}
            <circle
              cx={x - 1}
              cy={y - 1}
              r={NODE_RADIUS * 0.35}
              fill="rgba(255,255,255,0.4)"
            />
          </g>
        );
      })}
    </svg>
  );
});
