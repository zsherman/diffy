import { memo, useMemo } from 'react';
import type { GraphNode, CommitGraph } from '../../../types/git';
import { AuthorAvatar } from './AuthorAvatar';

const COLUMN_WIDTH = 16;
const NODE_RADIUS = 4;
const COLORS = [
  '#89b4fa', // blue
  '#a6e3a1', // green
  '#f9e2af', // yellow
  '#cba6f7', // purple
  '#f38ba8', // red
  '#94e2d5', // teal
  '#fab387', // peach
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
  rowIndex: number
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
  rowIndex: number
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
    [graph, rowIndex]
  );

  const passThroughLines = useMemo(
    () => getPassThroughLines(graph, rowIndex),
    [graph, rowIndex]
  );

  const nodeColor = node ? COLORS[node.column % COLORS.length] : COLORS[0];
  const graphWidth = (graph.maxColumns + 1) * COLUMN_WIDTH;
  const centerY = rowHeight / 2;

  // Find the rightmost element for avatar positioning
  const rightmostColumn = useMemo(() => {
    let max = node ? node.column : -1;
    for (const line of passThroughLines) {
      if (line.column > max) max = line.column;
    }
    for (const line of incomingLines) {
      if (line.column > max) max = line.column;
    }
    return max;
  }, [node, passThroughLines, incomingLines]);

  const avatarX = (rightmostColumn + 1) * COLUMN_WIDTH + 8;

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
              strokeWidth={2}
              strokeOpacity={0.7}
            />
          );
        })}

        {/* Incoming lines (from top to node center) */}
        {incomingLines.map((line, idx) => {
          const toX = line.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const fromX = line.fromColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;

          if (line.isMerge) {
            // Curved line for merge/diagonal
            const path = `M ${fromX} 0 C ${fromX} ${centerY * 0.5}, ${toX} ${centerY * 0.5}, ${toX} ${centerY}`;
            return (
              <path
                key={`in-${idx}`}
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeOpacity={0.7}
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
              strokeWidth={2}
              strokeOpacity={0.7}
            />
          );
        })}

        {/* Outgoing lines (from node center to bottom) */}
        {node?.connections.map((conn, connIdx) => {
          const x = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const targetX = conn.toColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;

          if (conn.isMerge || conn.fromColumn !== conn.toColumn) {
            // Curved line for merges or diagonal connections
            const path = `M ${x} ${centerY} C ${x} ${centerY + rowHeight * 0.3}, ${targetX} ${rowHeight * 0.7}, ${targetX} ${rowHeight}`;
            return (
              <path
                key={`out-${connIdx}`}
                d={path}
                fill="none"
                stroke={conn.isMerge ? COLORS[conn.toColumn % COLORS.length] : nodeColor}
                strokeWidth={2}
                strokeOpacity={0.7}
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
              strokeWidth={2}
              strokeOpacity={0.7}
            />
          );
        })}

        {/* Node circle */}
        {node && (
          <circle
            cx={node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2}
            cy={centerY}
            r={NODE_RADIUS}
            fill={nodeColor}
            stroke="var(--bg-primary)"
            strokeWidth={1.5}
          />
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
