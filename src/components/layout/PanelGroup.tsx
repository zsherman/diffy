import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface PanelGroupProps {
  children: React.ReactNode[];
  direction?: 'horizontal' | 'vertical';
  initialSizes?: number[];
  minSize?: number;
}

export function PanelGroup({
  children,
  direction = 'horizontal',
  initialSizes,
  minSize = 10,
}: PanelGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragStateRef = useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [sizes, setSizes] = useState<number[]>(
    initialSizes || children.map(() => 100 / children.length)
  );
  const [isDragging, setIsDragging] = useState<number | null>(null);

  // Memoize children to prevent unnecessary re-renders
  const memoizedChildren = useMemo(() => children, [children]);

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const startPos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;

    dragStateRef.current = {
      index,
      startPos,
      startSizes: [...sizes],
    };
    setIsDragging(index);

    // Disable text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
  }, [direction, sizes]);

  useEffect(() => {
    if (isDragging === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current || !containerRef.current) return;

      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use RAF to batch updates
      rafRef.current = requestAnimationFrame(() => {
        if (!dragStateRef.current || !containerRef.current) return;

        const { index, startPos, startSizes } = dragStateRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const totalSize = direction === 'horizontal' ? rect.width : rect.height;
        const currentPos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
        const deltaPercent = ((currentPos - startPos) / totalSize) * 100;

        const newLeft = startSizes[index] + deltaPercent;
        const newRight = startSizes[index + 1] - deltaPercent;

        if (newLeft >= minSize && newRight >= minSize) {
          // Update DOM directly for smooth resizing, avoid React re-render
          const leftPanel = panelRefs.current[index];
          const rightPanel = panelRefs.current[index + 1];

          if (leftPanel && rightPanel) {
            const prop = direction === 'horizontal' ? 'width' : 'height';
            leftPanel.style[prop] = `${newLeft}%`;
            rightPanel.style[prop] = `${newRight}%`;
          }
        }
      });
    };

    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Sync final sizes to state
      if (dragStateRef.current && containerRef.current) {
        const newSizes: number[] = [];
        panelRefs.current.forEach((panel) => {
          if (panel) {
            const rect = panel.getBoundingClientRect();
            const containerRect = containerRef.current!.getBoundingClientRect();
            const totalSize = direction === 'horizontal' ? containerRect.width : containerRect.height;
            const size = direction === 'horizontal' ? rect.width : rect.height;
            newSizes.push((size / totalSize) * 100);
          }
        });
        if (newSizes.length === sizes.length) {
          setSizes(newSizes);
        }
      }

      dragStateRef.current = null;
      setIsDragging(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, direction, minSize, sizes.length]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${direction === 'vertical' ? 'flex-col' : 'flex-row'}`}
    >
      {memoizedChildren.map((child, index) => (
        <React.Fragment key={index}>
          <div
            ref={(el) => { panelRefs.current[index] = el; }}
            style={{
              [direction === 'horizontal' ? 'width' : 'height']: `${sizes[index]}%`,
              flexShrink: 0,
            }}
            className="overflow-hidden"
          >
            {child}
          </div>
          {index < memoizedChildren.length - 1 && (
            <div
              className={`resize-handle flex-shrink-0 ${
                direction === 'horizontal'
                  ? 'w-1 cursor-col-resize'
                  : 'h-1 cursor-row-resize'
              } ${isDragging === index ? 'bg-accent-blue' : ''}`}
              onMouseDown={(e) => handleMouseDown(index, e)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
