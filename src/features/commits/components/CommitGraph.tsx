import type { CommitGraph as CommitGraphType } from '../../../types/git';

interface CommitGraphProps {
  graph: CommitGraphType;
  rowHeight: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
}

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

export function CommitGraphSVG({ graph, rowHeight, visibleStartIndex, visibleEndIndex }: CommitGraphProps) {
  if (!graph || graph.nodes.length === 0) return null;

  const width = (graph.max_columns + 1) * COLUMN_WIDTH;
  const height = graph.nodes.length * rowHeight;

  // Only render visible portion plus some buffer
  const buffer = 5;
  const startIndex = Math.max(0, visibleStartIndex - buffer);
  const endIndex = Math.min(graph.nodes.length, visibleEndIndex + buffer);

  const visibleNodes = graph.nodes.slice(startIndex, endIndex);

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
          const targetY = conn.to_row * rowHeight + rowHeight / 2;
          const targetX = conn.to_column * COLUMN_WIDTH + COLUMN_WIDTH / 2;

          // Bezier curve for merge lines
          if (conn.is_merge || conn.from_column !== conn.to_column) {
            const midY = (y + targetY) / 2;
            const path = `M ${x} ${y} C ${x} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
            return (
              <path
                key={`${node.commit_id}-conn-${connIdx}`}
                d={path}
                fill="none"
                stroke={conn.is_merge ? COLORS[conn.to_column % COLORS.length] : color}
                strokeWidth={2}
                strokeOpacity={0.7}
              />
            );
          }

          // Straight line for same column
          return (
            <line
              key={`${node.commit_id}-conn-${connIdx}`}
              x1={x}
              y1={y}
              x2={targetX}
              y2={targetY}
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.7}
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
          <circle
            key={`${node.commit_id}-node`}
            cx={x}
            cy={y}
            r={NODE_RADIUS}
            fill={color}
            stroke="#1e1e2e"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
