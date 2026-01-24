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
import { isLightTheme } from "../../lib/themes";

export function DockviewHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const [isMaximized, setIsMaximized] = useState(() => group.api.isMaximized());
  const {
    theme,
    diffViewMode,
    setDiffViewMode,
    showAIReviewPanel,
    setShowAIReviewPanel,
  } = useUIStore();

  // Check if this group contains the diff panel
  const isDiffPanel = group.panels.some((panel) => panel.id === "diff");
  const isLight = isLightTheme(theme);

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
    "p-1 rounded-sm transition-colors text-text-muted hover:text-text-primary hover:bg-bg-hover";
  const activeButtonClass = isLight
    ? "bg-bg-selected text-text-primary"
    : "bg-white/10 text-text-primary";
  const dividerClass = isLight ? "bg-border-primary/80" : "bg-white/20";

  return (
    <div className="flex items-center gap-0.5 h-full pr-2">
      {isDiffPanel && (
        <>
          <button
            onClick={() => setDiffViewMode("unified")}
            className={`p-1 rounded transition-colors ${
              diffViewMode === "unified"
                ? activeButtonClass
                : buttonClass
            }`}
            title="Unified view"
          >
            <Rows size={14} weight="bold" />
          </button>
          <button
            onClick={() => setDiffViewMode("split")}
            className={`p-1 rounded transition-colors ${
              diffViewMode === "split"
                ? activeButtonClass
                : buttonClass
            }`}
            title="Split view"
          >
            <SplitHorizontal size={14} weight="bold" />
          </button>
          <div className={`w-px h-3 ${dividerClass} mx-1`} />
          <button
            onClick={() => setShowAIReviewPanel(!showAIReviewPanel)}
            className={`p-1 rounded transition-colors ${
              showAIReviewPanel
                ? "bg-accent-purple/30 text-accent-purple"
                : buttonClass
            }`}
            title={showAIReviewPanel ? "Hide AI Review" : "Show AI Review"}
          >
            <Sparkle size={14} weight="bold" />
          </button>
          <div className={`w-px h-3 ${dividerClass} mx-1`} />
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
        className="p-1 rounded-sm transition-colors text-text-muted hover:text-accent-red hover:bg-bg-hover"
        title="Close panel"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
