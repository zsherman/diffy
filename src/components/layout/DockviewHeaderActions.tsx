import { useState, useEffect } from 'react';
import type { IDockviewHeaderActionsProps } from 'dockview-react';
import { ArrowsOutSimple, ArrowsInSimple, Rows, SplitHorizontal, Sparkle } from '@phosphor-icons/react';
import { useUIStore } from '../../stores/ui-store';

export function DockviewHeaderActions({ containerApi, group }: IDockviewHeaderActionsProps) {
  const [isMaximized, setIsMaximized] = useState(() => group.api.isMaximized());
  const { diffViewMode, setDiffViewMode, showAIReviewPanel, setShowAIReviewPanel } = useUIStore();

  // Check if this group contains the diff panel
  const isDiffPanel = group.panels.some((panel) => panel.id === 'diff');

  useEffect(() => {
    const disposable = containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(group.api.isMaximized());
    });
    return () => disposable.dispose();
  }, [containerApi, group.api]);

  const handleToggleMaximize = () => {
    if (isMaximized) {
      group.api.exitMaximized();
    } else {
      group.api.maximize();
    }
  };

  return (
    <div className="flex items-center gap-1 h-full">
      {isDiffPanel && (
        <>
          <button
            onClick={() => setDiffViewMode('unified')}
            className={`p-1 rounded transition-colors ${
              diffViewMode === 'unified'
                ? 'bg-white/20 text-white'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            }`}
            title="Unified view"
          >
            <Rows size={14} weight="bold" />
          </button>
          <button
            onClick={() => setDiffViewMode('split')}
            className={`p-1 rounded transition-colors ${
              diffViewMode === 'split'
                ? 'bg-white/20 text-white'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            }`}
            title="Split view"
          >
            <SplitHorizontal size={14} weight="bold" />
          </button>
          <div className="w-px h-3 bg-white/20 mx-1" />
          <button
            onClick={() => setShowAIReviewPanel(!showAIReviewPanel)}
            className={`p-1 rounded transition-colors ${
              showAIReviewPanel
                ? 'bg-accent-purple/30 text-accent-purple'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            }`}
            title={showAIReviewPanel ? 'Hide AI Review' : 'Show AI Review'}
          >
            <Sparkle size={14} weight="bold" />
          </button>
          <div className="w-px h-3 bg-white/20 mx-1" />
        </>
      )}
      <button
        onClick={handleToggleMaximize}
        className="p-1 hover:bg-white/10 rounded transition-colors"
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <ArrowsInSimple size={14} weight="bold" />
        ) : (
          <ArrowsOutSimple size={14} weight="bold" />
        )}
      </button>
    </div>
  );
}
