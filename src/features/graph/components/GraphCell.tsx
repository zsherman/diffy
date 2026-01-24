import { memo, useMemo } from "react";
import type { GraphNode, CommitGraph } from "../../../types/git";
import { AuthorAvatar } from "./AuthorAvatar";

const COLUMN_WIDTH = 20;
const NODE_RADIUS = 5;
const STROKE_WIDTH = 2.5;
const COLORS = [
  "#5B9BD5", // blue
  "#6CC070", // green
  "#E5A84B", // amber
  "#B07CC6", // purple
  "#E86A6A", // red
  "#4ECDC4", // teal
  "#F5A962", // orange
  "#7C9EB2", // slate
];

interface GraphCellProps {
  node: GraphNode | undefined;
  graph: CommitGraph;
  rowIndex: number;
  rowHeight: number;
  width: number;
  authorEmail: string;
}

interface IncomingLine {
  column: number;
  fromColumn: number;
  color: string;
  isMerge: boolean;
}

interface PassThroughLine {
  column: number;
  color: string;
}

// Calculate lines coming INTO this row from previous rows
function getIncomingLines(
  graph: CommitGraph,
  rowIndex: number,
): IncomingLine[] {
  const lines: IncomingLine[] = [];

  // Check all previous nodes for connections that end at this row
  for (let i = 0; i < rowIndex; i++) {
    const prevNode = graph.nodes[i];
    if (!prevNode) continue;

    for (const conn of prevNode.connections) {
      if (conn.toRow === rowIndex) {
        lines.push({
          column: conn.toColumn,
          fromColumn: conn.fromColumn,
          color: COLORS[conn.fromColumn % COLORS.length],
          isMerge: conn.isMerge || conn.fromColumn !== conn.toColumn,
        });
      }
    }
  }

  return lines;
}

// Calculate lines passing THROUGH this row (not ending here)
function getPassThroughLines(
  graph: CommitGraph,
  rowIndex: number,
): PassThroughLine[] {
  const lines: PassThroughLine[] = [];
  const seen = new Set<number>();

  // Check all previous nodes for connections that pass through this row
  for (let i = 0; i < rowIndex; i++) {
    const prevNode = graph.nodes[i];
    if (!prevNode) continue;

    for (const conn of prevNode.connections) {
      // If connection goes past this row (to a later row), it passes through
      if (conn.toRow > rowIndex) {
        // For straight vertical lines only
        if (conn.fromColumn === conn.toColumn && !seen.has(conn.fromColumn)) {
          seen.add(conn.fromColumn);
          lines.push({
            column: conn.fromColumn,
            color: COLORS[conn.fromColumn % COLORS.length],
          });
        }
      }
    }
  }

  return lines;
}

export const GraphCell = memo(function GraphCell({
  node,
  graph,
  rowIndex,
  rowHeight,
  width,
  authorEmail,
}: GraphCellProps) {
  const incomingLines = useMemo(
    () => getIncomingLines(graph, rowIndex),
    [graph, rowIndex],
  );

  const passThroughLines = useMemo(
    () => getPassThroughLines(graph, rowIndex),
    [graph, rowIndex],
  );

  const nodeColor = node ? COLORS[node.column % COLORS.length] : COLORS[0];
  const graphWidth = (graph.maxColumns + 1) * COLUMN_WIDTH;
  const centerY = rowHeight / 2;

  // Position avatar consistently at the right edge of the graph area
  const avatarX = graphWidth + 8;

  return (
    <div style={{ width }} className="shrink-0 relative flex items-center">
      <svg
        width={graphWidth}
        height={rowHeight}
        className="shrink-0"
        style={{ minWidth: graphWidth }}
      >
        {/* Pass-through lines (full height, behind everything) */}
        {passThroughLines.map((line) => {
          const x = line.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          return (
            <line
              key={`pass-${line.column}`}
              x1={x}
              y1={0}
              x2={x}
              y2={rowHeight}
              stroke={line.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          );
        })}

        {/* Incoming lines (from top to node center) */}
        {incomingLines.map((line, idx) => {
          const toX = line.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const fromX = line.fromColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;

          if (line.isMerge) {
            // Smooth S-curve using cubic bezier with better control points
            // Start vertical, then curve horizontally to the target
            const curveStart = rowHeight * 0.35;
            const curveEnd = centerY;
            const path = `M ${fromX} 0 L ${fromX} ${curveStart} C ${fromX} ${curveStart + (curveEnd - curveStart) * 0.5}, ${toX} ${curveEnd - (curveEnd - curveStart) * 0.3}, ${toX} ${curveEnd}`;
            return (
              <path
                key={`in-${idx}`}
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }

          // Straight vertical line
          return (
            <line
              key={`in-${idx}`}
              x1={toX}
              y1={0}
              x2={toX}
              y2={centerY}
              stroke={line.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          );
        })}

        {/* Outgoing lines (from node center to bottom) */}
        {node?.connections.map((conn, connIdx) => {
          const x = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const targetX = conn.toColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const lineColor = conn.isMerge
            ? COLORS[conn.toColumn % COLORS.length]
            : nodeColor;

          if (conn.isMerge || conn.fromColumn !== conn.toColumn) {
            // Smooth S-curve - start from node, go vertical briefly, then curve to target
            const curveStart = centerY;
            const curveEnd = rowHeight * 0.65;
            const path = `M ${x} ${curveStart} C ${x} ${curveStart + (curveEnd - curveStart) * 0.3}, ${targetX} ${curveEnd - (rowHeight - curveEnd) * 0.5}, ${targetX} ${curveEnd} L ${targetX} ${rowHeight}`;
            return (
              <path
                key={`out-${connIdx}`}
                d={path}
                fill="none"
                stroke={lineColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }

          // Straight vertical line from node to bottom
          return (
            <line
              key={`out-${connIdx}`}
              x1={x}
              y1={centerY}
              x2={targetX}
              y2={rowHeight}
              stroke={nodeColor}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          );
        })}

        {/* Node circle with subtle inner highlight */}
        {node && (
          <>
            {/* Outer glow/shadow */}
            <circle
              cx={node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2}
              cy={centerY}
              r={NODE_RADIUS + 1}
              fill="none"
              stroke={nodeColor}
              strokeWidth={1}
              strokeOpacity={0.3}
            />
            {/* Main node */}
            <circle
              cx={node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2}
              cy={centerY}
              r={NODE_RADIUS}
              fill={nodeColor}
              stroke="var(--bg-primary)"
              strokeWidth={2}
            />
            {/* Inner highlight for depth */}
            <circle
              cx={node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2 - 1}
              cy={centerY - 1}
              r={NODE_RADIUS * 0.35}
              fill="rgba(255,255,255,0.4)"
            />
          </>
        )}
      </svg>

      {/* Author avatar positioned after graph */}
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: avatarX }}
      >
        <AuthorAvatar email={authorEmail} size={24} ringColor={nodeColor} />
      </div>
    </div>
  );
});
