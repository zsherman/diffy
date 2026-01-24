import { useState, useEffect } from "react";
import type { IDockviewHeaderActionsProps } from "dockview-react";
import {
  ArrowsOutSimple,
  ArrowsInSimple,
  Rows,
  SplitHorizontal,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { useUIStore } from "../../stores/ui-store";

export function DockviewHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const [isMaximized, setIsMaximized] = useState(() => group.api.isMaximized());
  const {
    diffViewMode,
    setDiffViewMode,
    showAIReviewPanel,
    setShowAIReviewPanel,
  } = useUIStore();

  // Check if this group contains the diff panel
  const isDiffPanel = group.panels.some((panel) => panel.id === "diff");

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

  const buttonClass =
    "p-1 rounded transition-colors text-white/40 hover:text-white hover:bg-white/10";

  return (
    <div className="flex items-center gap-0.5 h-full pr-2">
      {isDiffPanel && (
        <>
          <button
            onClick={() => setDiffViewMode("unified")}
            className={`p-1 rounded transition-colors ${
              diffViewMode === "unified"
                ? "bg-white/20 text-white"
                : "text-white/40 hover:bg-white/10 hover:text-white"
            }`}
            title="Unified view"
          >
            <Rows size={14} weight="bold" />
          </button>
          <button
            onClick={() => setDiffViewMode("split")}
            className={`p-1 rounded transition-colors ${
              diffViewMode === "split"
                ? "bg-white/20 text-white"
                : "text-white/40 hover:bg-white/10 hover:text-white"
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
                ? "bg-accent-purple/30 text-accent-purple"
                : "text-white/40 hover:bg-white/10 hover:text-white"
            }`}
            title={showAIReviewPanel ? "Hide AI Review" : "Show AI Review"}
          >
            <Sparkle size={14} weight="bold" />
          </button>
          <div className="w-px h-3 bg-white/20 mx-1" />
        </>
      )}
      <button
        onClick={handleToggleMaximize}
        className={buttonClass}
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <ArrowsInSimple size={14} weight="bold" />
        ) : (
          <ArrowsOutSimple size={14} weight="bold" />
        )}
      </button>
      <button
        onClick={() => {
          // Close the active panel in this group
          const activePanel = group.activePanel;
          if (activePanel) {
            activePanel.api.close();
          }
        }}
        className="p-1 rounded transition-colors text-white/40 hover:text-accent-red hover:bg-white/10"
        title="Close panel"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
