import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Warning,
  ClockCounterClockwise,
  GitDiff,
  ChartBar,
} from "@phosphor-icons/react";
import {
  getStatus,
  getMergeStatus,
  parseFileConflicts,
} from "../../../lib/tauri";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useUIStore, getDockviewApi } from "../../../stores/ui-store";
import { useMergeConflictStore } from "../../../stores/merge-conflict-store";
import { useToast } from "../../../components/ui/Toast";
import { applyLayout } from "../../../lib/layouts";

type ViewMode = "history" | "changes" | "statistics";

export function RepoSelector() {
  const { repository } = useTabsStore();
  const { mainView, setMainView, setSelectedCommit } = useActiveTabState();
  const { showMergeConflictPanel, setShowMergeConflictPanel } = useUIStore();
  const { enterMergeMode, isActive: isMergeActive } = useMergeConflictStore();
  const toast = useToast();
  const hasShownMergeToast = useRef(false);

  // Fetch working directory status for badge count
  // Long staleTime since file watcher handles invalidation - prevents duplicate fetches on tab switch
  const { data: status } = useQuery({
    queryKey: ["status", repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000, // 30s - watcher invalidates on changes
    refetchOnMount: false, // Don't refetch if data exists - watcher handles updates
  });

  // Fetch merge status - longer safety interval since git operations may not trigger watcher
  const { data: mergeStatus } = useQuery({
    queryKey: ["merge-status", repository?.path],
    queryFn: () => getMergeStatus(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 60000, // Safety refetch every 60s
    staleTime: 10000,
  });

  // Show toast when merge conflicts are detected
  useEffect(() => {
    if (
      mergeStatus?.inMerge &&
      mergeStatus.conflictingFiles.length > 0 &&
      !showMergeConflictPanel &&
      !isMergeActive &&
      !hasShownMergeToast.current
    ) {
      hasShownMergeToast.current = true;
      const conflictCount = mergeStatus.conflictingFiles.length;
      toast.withAction(
        "Merge Conflicts Detected",
        `${conflictCount} file${conflictCount > 1 ? "s have" : " has"} conflicts that need to be resolved`,
        "warning",
        {
          label: "Resolve Conflicts",
          onClick: async () => {
            if (!repository) return;
            try {
              // Load conflict info for all files
              const fileInfos = await Promise.all(
                mergeStatus.conflictingFiles.map((filePath) =>
                  parseFileConflicts(repository.path, filePath),
                ),
              );
              enterMergeMode(fileInfos, mergeStatus.theirBranch);
              setShowMergeConflictPanel(true);
              // Switch to merge conflict layout
              const api = getDockviewApi();
              if (api) {
                applyLayout(api, "merge-conflict");
              }
            } catch (error) {
              console.error("Failed to load conflict info:", error);
            }
          },
        },
      );
    }

    // Reset toast flag when merge is resolved
    if (!mergeStatus?.inMerge || mergeStatus.conflictingFiles.length === 0) {
      hasShownMergeToast.current = false;
    }
  }, [
    mergeStatus,
    showMergeConflictPanel,
    isMergeActive,
    repository,
    enterMergeMode,
    setShowMergeConflictPanel,
    toast,
  ]);

  // Count total uncommitted files
  const uncommittedCount = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

  // Show merge indicator when in merge state
  const hasConflicts =
    mergeStatus?.inMerge && mergeStatus.conflictingFiles.length > 0;

  // Update window title when repository changes
  useEffect(() => {
    const updateTitle = async () => {
      const window = getCurrentWindow();
      if (repository) {
        await window.setTitle(repository.name);
      } else {
        await window.setTitle("Diffy");
      }
    };
    updateTitle();
  }, [repository]);

  // Determine current view based on actual panels in the layout
  const api = getDockviewApi();
  const currentView: ViewMode = (() => {
    if (!api) return mainView;
    const hasStaging = api.getPanel("staging") !== undefined;
    const hasCommits = api.getPanel("commits") !== undefined;
    if (hasStaging && !hasCommits) return "changes";
    if (hasCommits && !hasStaging) return "history";
    return mainView;
  })();

  const handleViewChange = useCallback(
    (view: ViewMode) => {
      if (view === currentView) return;

      setMainView(view);

      const dockApi = getDockviewApi();
      if (dockApi) {
        if (view === "history") {
          applyLayout(dockApi, "standard");
        } else if (view === "changes") {
          setSelectedCommit(null);
          applyLayout(dockApi, "changes");
        }
      }
    },
    [setMainView, setSelectedCommit, currentView],
  );

  const toggleButtonClass =
    "flex items-center gap-1.5 px-3 py-1 text-text-muted transition-colors data-[pressed]:bg-bg-hover data-[pressed]:text-text-primary hover:text-text-primary text-xs";

  if (!repository) return null;

  return (
    <div
      data-tauri-drag-region
      className="relative flex items-center justify-center px-3 h-[38px] bg-bg-tertiary border-b border-border-primary select-none"
    >
      {/* Merge conflict indicator - positioned left */}
      {hasConflicts && (
        <div className="absolute left-3 flex items-center">
          <button
            onClick={async () => {
              if (!repository || !mergeStatus) return;
              try {
                const fileInfos = await Promise.all(
                  mergeStatus.conflictingFiles.map((filePath) =>
                    parseFileConflicts(repository.path, filePath),
                  ),
                );
                enterMergeMode(fileInfos, mergeStatus.theirBranch);
                setShowMergeConflictPanel(true);
                const api = getDockviewApi();
                if (api) {
                  applyLayout(api, "merge-conflict");
                }
              } catch (error) {
                console.error("Failed to load conflict info:", error);
              }
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-yellow/20 text-xs hover:bg-accent-yellow/30 transition-colors"
            title="Click to resolve merge conflicts"
          >
            <Warning size={14} weight="fill" className="text-accent-yellow" />
            <span className="text-accent-yellow font-medium">
              {mergeStatus.conflictingFiles.length} conflict
              {mergeStatus.conflictingFiles.length > 1 ? "s" : ""}
            </span>
          </button>
        </div>
      )}

      {/* Center - View mode buttons */}
      <div className="flex items-center border border-border-primary rounded bg-bg-secondary">
        <button
          onClick={() => handleViewChange("history")}
          aria-label="History view"
          aria-pressed={currentView === "history"}
          className={`${toggleButtonClass} rounded-l ${currentView === "history" ? "bg-bg-hover text-text-primary" : ""}`}
        >
          <ClockCounterClockwise size={14} weight="bold" />
          <span className="hidden sm:inline">History</span>
        </button>
        <button
          onClick={() => handleViewChange("changes")}
          aria-label="Changes view"
          aria-pressed={currentView === "changes"}
          className={`${toggleButtonClass} ${currentView === "changes" ? "bg-bg-hover text-text-primary" : ""}`}
        >
          <GitDiff size={14} weight="bold" />
          <span className="hidden sm:inline">Changes</span>
          {uncommittedCount > 0 && (
            <span className="px-1.5 py-0.5 bg-accent-blue text-white text-[10px] rounded-full leading-none">
              {uncommittedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleViewChange("statistics")}
          aria-label="Statistics view"
          aria-pressed={currentView === "statistics"}
          className={`${toggleButtonClass} rounded-r ${currentView === "statistics" ? "bg-bg-hover text-text-primary" : ""}`}
        >
          <ChartBar size={14} weight="bold" />
          <span className="hidden sm:inline">Statistics</span>
        </button>
      </div>
    </div>
  );
}
