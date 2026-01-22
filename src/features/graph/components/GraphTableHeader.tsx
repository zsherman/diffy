import { memo, useCallback, useRef, useState } from 'react';

interface GraphTableHeaderProps {
  branchTagWidth: number;
  graphWidth: number;
  onResize: (column: 'branchTag' | 'graph', width: number) => void;
  minBranchTagWidth: number;
  maxBranchTagWidth: number;
  minGraphWidth: number;
}

const ResizeHandle = memo(function ResizeHandle({
  onDrag,
}: {
  onDrag: (delta: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      startXRef.current = e.clientX;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDrag]);

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-blue/50 ${
        isDragging ? 'bg-accent-blue/50' : ''
      }`}
      onMouseDown={handleMouseDown}
    />
  );
});

export const GraphTableHeader = memo(function GraphTableHeader({
  branchTagWidth,
  graphWidth,
  onResize,
  minBranchTagWidth,
  maxBranchTagWidth,
  minGraphWidth,
}: GraphTableHeaderProps) {
  const handleBranchTagResize = useCallback(
    (delta: number) => {
      const newWidth = Math.max(
        minBranchTagWidth,
        Math.min(maxBranchTagWidth, branchTagWidth + delta)
      );
      onResize('branchTag', newWidth);
    },
    [branchTagWidth, onResize, minBranchTagWidth, maxBranchTagWidth]
  );

  const handleGraphResize = useCallback(
    (delta: number) => {
      const newWidth = Math.max(minGraphWidth, graphWidth + delta);
      onResize('graph', newWidth);
    },
    [graphWidth, onResize, minGraphWidth]
  );

  return (
    <div className="flex border-b border-border-primary bg-bg-tertiary text-xs text-text-muted font-semibold uppercase tracking-wider">
      <div
        className="relative px-2 py-2 shrink-0"
        style={{ width: branchTagWidth }}
      >
        Branch/Tag
        <ResizeHandle onDrag={handleBranchTagResize} />
      </div>
      <div
        className="relative px-2 py-2 shrink-0"
        style={{ width: graphWidth }}
      >
        Graph
        <ResizeHandle onDrag={handleGraphResize} />
      </div>
      <div className="px-2 py-2 flex-1">Commit Message</div>
    </div>
  );
});
