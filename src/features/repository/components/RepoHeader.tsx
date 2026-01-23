import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  Warning,
  ClockCounterClockwise,
  GitDiff,
  ChartBar,
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  CloudArrowDown,
  ListBullets,
} from "@phosphor-icons/react";
import {
  getStatus,
  getMergeStatus,
  parseFileConflicts,
  gitFetch,
  gitPull,
  gitPush,
  getAheadBehind,
} from "../../../lib/tauri";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useUIStore, getDockviewApi } from "../../../stores/ui-store";
import { useMergeConflictStore } from "../../../stores/merge-conflict-store";
import { useToast } from "../../../components/ui/Toast";
import { applyLayout } from "../../../lib/layouts";
import { getErrorMessage } from "../../../lib/errors";
import { BranchSwitcher } from "../../../components/ui/BranchSwitcher";
import { LayoutSwitcher } from "../../../components/ui/LayoutSwitcher";

type ViewMode = "history" | "changes" | "statistics" | "changelog";

export function RepoHeader() {
  const { repository } = useTabsStore();
  const { mainView, setMainView, setSelectedCommit } = useActiveTabState();
  const { showMergeConflictPanel, setShowMergeConflictPanel } = useUIStore();
  const { enterMergeMode, isActive: isMergeActive } = useMergeConflictStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const hasShownMergeToast = useRef(false);

  // Git action states
  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // Fetch working directory status for badge count
  const { data: status } = useQuery({
    queryKey: ["status", repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000,
    refetchOnMount: false,
  });

  // Fetch merge status
  const { data: mergeStatus } = useQuery({
    queryKey: ["merge-status", repository?.path],
    queryFn: () => getMergeStatus(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 60000,
    staleTime: 10000,
  });

  // Fetch ahead/behind counts
  const { data: aheadBehind } = useQuery({
    queryKey: ["aheadBehind", repository?.path],
    queryFn: () => getAheadBehind(repository!.path),
    enabled: !!repository,
    refetchInterval: 30000,
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
          },
        },
      );
    }

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

  // Determine current view
  const api = getDockviewApi();
  const currentView: ViewMode = (() => {
    if (mainView === "statistics") return "statistics";
    if (mainView === "changelog") return "changelog";
    if (!api) return mainView;
    const hasStaging = api.getPanel("staging") !== undefined;
    const hasCommits = api.getPanel("commits") !== undefined;
    if (hasStaging && !hasCommits) return "changes";
    if (hasCommits && !hasStaging) return "history";
    return mainView;
  })();

  const handleViewChange = useCallback(
    (view: ViewMode) => {
      // Allow switching when coming FROM overlay views (statistics or changelog)
      const isOverlayView =
        mainView === "statistics" || mainView === "changelog";
      if (view === currentView && !isOverlayView) return;

      // Update state immediately so the tab selection paints first
      setMainView(view);
      if (view === "changes") {
        setSelectedCommit(null);
      }

      // Schedule layout mutations after the pressed state can paint
      // This makes the tab switch feel more responsive
      requestAnimationFrame(() => {
        const dockApi = getDockviewApi();
        if (dockApi) {
          if (view === "history") {
            applyLayout(dockApi, "standard");
          } else if (view === "changes") {
            applyLayout(dockApi, "changes");
          }
        }
      });
    },
    [setMainView, setSelectedCommit, currentView, mainView],
  );

  // Git action handlers
  const handleFetch = async () => {
    if (!repository || isFetching) return;
    setIsFetching(true);
    try {
      await gitFetch(repository.path);
      toast.success("Fetch complete", "Successfully fetched from remote");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["aheadBehind"] });
    } catch (error) {
      console.error("Fetch failed:", error);
      toast.error("Fetch failed", getErrorMessage(error));
    } finally {
      setIsFetching(false);
    }
  };

  const handlePull = async () => {
    if (!repository || isPulling) return;
    setIsPulling(true);
    try {
      const result = await gitPull(repository.path);
      toast.success(
        "Pull complete",
        result || "Successfully pulled from remote",
      );
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["aheadBehind"] });
    } catch (error) {
      console.error("Pull failed:", error);
      toast.error("Pull failed", getErrorMessage(error));
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    if (!repository || isPushing) return;
    setIsPushing(true);
    try {
      await gitPush(repository.path);
      toast.success("Push complete", "Successfully pushed to remote");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["aheadBehind"] });
    } catch (error) {
      console.error("Push failed:", error);
      toast.error("Push failed", getErrorMessage(error));
    } finally {
      setIsPushing(false);
    }
  };

  const handleOpenMergeConflicts = async () => {
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
  };

  const toggleButtonClass =
    "flex items-center gap-1.5 px-3 py-1 text-text-muted transition-colors data-[pressed]:bg-bg-hover data-[pressed]:text-text-primary hover:text-text-primary text-xs";

  const toolbarButtonClass =
    "flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue";

  if (!repository) return null;

  return (
    <div
      data-tauri-drag-region
      className="grid grid-cols-[1fr_auto_1fr] items-center px-3 h-[38px] bg-bg-tertiary border-b border-border-primary select-none text-xs"
    >
      {/* Left: Merge conflict chip, branch switcher, git actions */}
      <div className="flex items-center gap-2">
        {/* Merge conflict indicator */}
        {hasConflicts && (
          <button
            onClick={handleOpenMergeConflicts}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-yellow/20 text-xs hover:bg-accent-yellow/30 transition-colors"
            title="Click to resolve merge conflicts"
          >
            <Warning size={14} weight="fill" className="text-accent-yellow" />
            <span className="text-accent-yellow font-medium">
              {mergeStatus.conflictingFiles.length} conflict
              {mergeStatus.conflictingFiles.length > 1 ? "s" : ""}
            </span>
          </button>
        )}

        <BranchSwitcher />

        {/* Separator */}
        <div className="w-px h-4 bg-border-primary mx-1" />

        {/* Git actions toolbar */}
        <Toolbar.Root className="flex items-center gap-0.5">
          <Toolbar.Button
            className={toolbarButtonClass}
            onClick={handleFetch}
            disabled={isFetching}
          >
            {isFetching ? (
              <ArrowsClockwise
                size={14}
                weight="bold"
                className="animate-spin"
              />
            ) : (
              <CloudArrowDown size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">Fetch</span>
          </Toolbar.Button>

          <Toolbar.Button
            className={`${toolbarButtonClass} relative`}
            onClick={handlePull}
            disabled={isPulling}
          >
            {isPulling ? (
              <ArrowsClockwise
                size={14}
                weight="bold"
                className="animate-spin"
              />
            ) : (
              <ArrowDown size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">Pull</span>
            {aheadBehind && aheadBehind.behind > 0 && !isPulling && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-medium bg-accent-orange text-white rounded-full">
                {aheadBehind.behind > 99 ? "99+" : aheadBehind.behind}
              </span>
            )}
          </Toolbar.Button>

          <Toolbar.Button
            className={`${toolbarButtonClass} relative`}
            onClick={handlePush}
            disabled={isPushing}
          >
            {isPushing ? (
              <ArrowsClockwise
                size={14}
                weight="bold"
                className="animate-spin"
              />
            ) : (
              <ArrowUp size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">Push</span>
            {aheadBehind && aheadBehind.ahead > 0 && !isPushing && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-medium bg-accent-blue text-white rounded-full">
                {aheadBehind.ahead > 99 ? "99+" : aheadBehind.ahead}
              </span>
            )}
          </Toolbar.Button>
        </Toolbar.Root>
      </div>

      {/* Center: View mode buttons + Layout switcher */}
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
          className={`${toggleButtonClass} ${currentView === "statistics" ? "bg-bg-hover text-text-primary" : ""}`}
        >
          <ChartBar size={14} weight="bold" />
          <span className="hidden sm:inline">Statistics</span>
        </button>
        <button
          onClick={() => handleViewChange("changelog")}
          aria-label="Changelog view"
          aria-pressed={currentView === "changelog"}
          className={`${toggleButtonClass} ${currentView === "changelog" ? "bg-bg-hover text-text-primary" : ""}`}
        >
          <ListBullets size={14} weight="bold" />
          <span className="hidden sm:inline">Changelog</span>
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-border-primary" />

        {/* Layout switcher inline */}
        <LayoutSwitcher />
      </div>

      {/* Right: empty for grid balance */}
      <div />
    </div>
  );
}
