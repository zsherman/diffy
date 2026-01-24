import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  Warning,
  Folders,
  ChartBar,
  ArrowUp,
  ArrowsClockwise,
  ListBullets,
  BookBookmark,
} from "@phosphor-icons/react";
import {
  getStatus,
  getMergeStatus,
  getRebaseStatus,
  parseFileConflicts,
  gitRemoteAction,
  gitPush,
  getAheadBehind,
} from "../../../lib/tauri";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useUIStore, useAppView, getDockviewApi, useDefaultRemoteAction } from "../../../stores/ui-store";
import { useMergeConflictStore } from "../../../stores/merge-conflict-store";
import { GitFork } from "@phosphor-icons/react";
import { useToast } from "../../../components/ui/Toast";
import { applyLayout } from "../../../lib/layouts";
import { getErrorMessage } from "../../../lib/errors";
import { BranchSwitcher } from "../../../components/ui/BranchSwitcher";
import { WorktreeSwitcher } from "../../../components/ui/WorktreeSwitcher";
import { PanelSelector } from "../../../components/ui/PanelSelector";
import { RemoteActionSelect } from "../../../components/ui";

type MainView = "repository" | "statistics" | "changelog";

/**
 * Invalidates git-related queries after remote operations.
 * Uses predicate-based invalidation to match queries regardless of key structure.
 * 
 * Query invalidation strategy by operation:
 * - fetch: branches, commits, aheadBehind (remote refs change, no local working dir impact)
 * - pull: branches, commits, status, aheadBehind, working-diff-* (can modify working directory)
 * - push: branches, commits, status, aheadBehind, graph (updates remote tracking, graph may show new remote state)
 */
function invalidateGitQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  queryNames: string[],
) {
  for (const name of queryNames) {
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === name,
      refetchType: "all",
    });
  }
}

export function RepoHeader() {
  const { repository } = useTabsStore();
  const { mainView, setMainView } = useActiveTabState();
  const { appView, setAppView } = useAppView();
  const { showMergeConflictPanel, setShowMergeConflictPanel } = useUIStore();
  const { enterMergeMode, enterConflictMode, isActive: isConflictModeActive } = useMergeConflictStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const hasShownMergeToast = useRef(false);
  const hasShownRebaseToast = useRef(false);

  // Git action states
  const [isRemoteActionLoading, setIsRemoteActionLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const { defaultRemoteAction } = useDefaultRemoteAction();

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

  // Fetch rebase status
  const { data: rebaseStatus } = useQuery({
    queryKey: ["rebase-status", repository?.path],
    queryFn: () => getRebaseStatus(repository!.path),
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
      !isConflictModeActive &&
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
    isConflictModeActive,
    repository,
    enterMergeMode,
    setShowMergeConflictPanel,
    toast,
  ]);

  // Show toast when rebase conflicts are detected
  useEffect(() => {
    if (
      rebaseStatus?.inRebase &&
      rebaseStatus.conflictingFiles.length > 0 &&
      !showMergeConflictPanel &&
      !isConflictModeActive &&
      !hasShownRebaseToast.current
    ) {
      hasShownRebaseToast.current = true;
      const conflictCount = rebaseStatus.conflictingFiles.length;
      toast.withAction(
        "Rebase Conflicts Detected",
        `${conflictCount} file${conflictCount > 1 ? "s have" : " has"} conflicts that need to be resolved`,
        "warning",
        {
          label: "Resolve Conflicts",
          onClick: async () => {
            if (!repository) return;
            try {
              const fileInfos = await Promise.all(
                rebaseStatus.conflictingFiles.map((filePath) =>
                  parseFileConflicts(repository.path, filePath),
                ),
              );
              enterConflictMode(fileInfos, rebaseStatus.ontoRef, 'rebase');
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

    if (!rebaseStatus?.inRebase || rebaseStatus.conflictingFiles.length === 0) {
      hasShownRebaseToast.current = false;
    }
  }, [
    rebaseStatus,
    showMergeConflictPanel,
    isConflictModeActive,
    repository,
    enterConflictMode,
    setShowMergeConflictPanel,
    toast,
  ]);

  // Count total uncommitted files
  const uncommittedCount = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

  // Show conflict indicator when in merge or rebase state
  const hasMergeConflicts =
    mergeStatus?.inMerge && mergeStatus.conflictingFiles.length > 0;
  const hasRebaseConflicts =
    rebaseStatus?.inRebase && rebaseStatus.conflictingFiles.length > 0;

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

  // Handle mode changes (repository/statistics/changelog)
  const handleModeChange = useCallback(
    (mode: MainView) => {
      // Always switch to workspace view first
      if (appView !== "workspace") {
        setAppView("workspace");
      }
      // Only update mainView if we have a repository
      if (repository && mode !== mainView) {
        setMainView(mode);
      }
    },
    [setMainView, mainView, appView, setAppView, repository],
  );

  // Handle skills view toggle
  const handleSkillsClick = useCallback(() => {
    setAppView(appView === "skills" ? "workspace" : "skills");
  }, [appView, setAppView]);

  // Git action handlers
  const handleRemoteAction = async () => {
    if (!repository || isRemoteActionLoading) return;
    setIsRemoteActionLoading(true);
    
    const isFetchAction = defaultRemoteAction === "fetch_all";
    const actionLabel = isFetchAction ? "Fetch" : "Pull";
    
    try {
      const result = await gitRemoteAction(repository.path, defaultRemoteAction);
      toast.success(
        `${actionLabel} complete`,
        result || `Successfully ${actionLabel.toLowerCase()}ed from remote`,
      );
      
      if (isFetchAction) {
        // Fetch updates remote refs but doesn't modify working directory
        invalidateGitQueries(queryClient, ["branches", "commits", "aheadBehind"]);
      } else {
        // Pull can modify working directory, so invalidate status and diffs too
        invalidateGitQueries(queryClient, [
          "branches",
          "commits",
          "status",
          "working-diff-staged",
          "working-diff-unstaged",
        ]);
        // Refetch aheadBehind immediately to update badge
        await queryClient.refetchQueries({
          queryKey: ["aheadBehind", repository.path],
        });
      }
    } catch (error) {
      console.error(`${actionLabel} failed:`, error);
      toast.error(`${actionLabel} failed`, getErrorMessage(error));
    } finally {
      setIsRemoteActionLoading(false);
    }
  };

  const handlePush = async () => {
    if (!repository || isPushing) return;
    setIsPushing(true);
    try {
      await gitPush(repository.path);
      toast.success("Push complete", "Successfully pushed to remote");
      // Push updates remote tracking info and graph visualization
      invalidateGitQueries(queryClient, [
        "branches",
        "commits",
        "status",
        "graph",
      ]);
      // Refetch aheadBehind immediately to update badge
      await queryClient.refetchQueries({
        queryKey: ["aheadBehind", repository.path],
      });
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

  const handleOpenRebaseConflicts = async () => {
    if (!repository || !rebaseStatus) return;
    try {
      const fileInfos = await Promise.all(
        rebaseStatus.conflictingFiles.map((filePath) =>
          parseFileConflicts(repository.path, filePath),
        ),
      );
      enterConflictMode(fileInfos, rebaseStatus.ontoRef, 'rebase');
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
    "flex items-center gap-1.5 px-3 py-1 text-text-muted transition-colors data-pressed:bg-bg-hover data-pressed:text-text-primary hover:text-text-primary text-xs";

  const toolbarButtonClass =
    "flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-blue";

  // Determine which workspace view button is active (only when not in skills view and we have a repo)
  const isWorkspaceActive = appView === "workspace";
  const isRepoViewActive = isWorkspaceActive && repository && mainView === "repository";
  const isStatisticsActive = isWorkspaceActive && repository && mainView === "statistics";
  const isChangelogActive = isWorkspaceActive && repository && mainView === "changelog";
  const isSkillsActive = appView === "skills";

  return (
    <div
      data-tauri-drag-region
      className="grid grid-cols-[1fr_auto_1fr] items-center px-3 h-[38px] bg-bg-tertiary border-b border-border-primary select-none text-xs"
    >
      {/* Left: Merge conflict chip, branch switcher, git actions (only when repo is open) */}
      <div className="flex items-center gap-2">
        {repository && (
          <>
            {/* Merge conflict indicator */}
            {hasMergeConflicts && (
              <button
                onClick={handleOpenMergeConflicts}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-yellow/20 text-xs hover:bg-accent-yellow/30 transition-colors whitespace-nowrap shrink-0"
                title="Click to resolve merge conflicts"
              >
                <Warning size={14} weight="fill" className="text-accent-yellow" />
                <span className="text-accent-yellow font-medium">
                  {mergeStatus!.conflictingFiles.length} merge conflict
                  {mergeStatus!.conflictingFiles.length > 1 ? "s" : ""}
                </span>
              </button>
            )}

            {/* Rebase conflict indicator */}
            {hasRebaseConflicts && (
              <button
                onClick={handleOpenRebaseConflicts}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-orange/20 text-xs hover:bg-accent-orange/30 transition-colors whitespace-nowrap shrink-0"
                title="Click to resolve rebase conflicts"
              >
                <GitFork size={14} weight="fill" className="text-accent-orange" />
                <span className="text-accent-orange font-medium">
                  {rebaseStatus!.conflictingFiles.length} rebase conflict
                  {rebaseStatus!.conflictingFiles.length > 1 ? "s" : ""}
                </span>
              </button>
            )}

            <BranchSwitcher />

            {/* Separator between branch and worktree */}
            <div className="w-px h-4 bg-border-primary" />

            <WorktreeSwitcher />

            {/* Separator */}
            <div className="w-px h-4 bg-border-primary mx-1" />

            {/* Git actions toolbar */}
            <Toolbar.Root className="flex items-center gap-0.5">
              {/* Remote action (fetch/pull) with dropdown selector */}
              <div className="relative">
                <RemoteActionSelect
                  isLoading={isRemoteActionLoading}
                  onExecute={handleRemoteAction}
                />
                {/* Behind badge - show when pull action is selected and there are commits behind */}
                {aheadBehind && aheadBehind.behind > 0 && !isRemoteActionLoading && defaultRemoteAction !== "fetch_all" && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-medium bg-accent-orange text-white rounded-full pointer-events-none">
                    {aheadBehind.behind > 99 ? "99+" : aheadBehind.behind}
                  </span>
                )}
              </div>

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
          </>
        )}
      </div>

      {/* Center: Mode selector */}
      <div className="flex items-center border border-border-primary rounded-sm bg-bg-secondary">
        <button
          onClick={() => handleModeChange("repository")}
          aria-label="Repository view"
          aria-pressed={isRepoViewActive}
          disabled={!repository}
          className={`${toggleButtonClass} rounded-l ${isRepoViewActive ? "bg-bg-hover text-text-primary" : ""} ${!repository ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Folders size={14} weight="bold" />
          <span className="hidden sm:inline">Repository</span>
          {uncommittedCount > 0 && !isRepoViewActive && (
            <span className="px-1.5 py-0.5 bg-accent-blue text-white text-[10px] rounded-full leading-none">
              {uncommittedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleModeChange("statistics")}
          aria-label="Statistics view"
          aria-pressed={isStatisticsActive}
          disabled={!repository}
          className={`${toggleButtonClass} ${isStatisticsActive ? "bg-bg-hover text-text-primary" : ""} ${!repository ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ChartBar size={14} weight="bold" />
          <span className="hidden sm:inline">Statistics</span>
        </button>
        <button
          onClick={() => handleModeChange("changelog")}
          aria-label="Changelog view"
          aria-pressed={isChangelogActive}
          disabled={!repository}
          className={`${toggleButtonClass} ${isChangelogActive ? "bg-bg-hover text-text-primary" : ""} ${!repository ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ListBullets size={14} weight="bold" />
          <span className="hidden sm:inline">Changelog</span>
        </button>
        <button
          onClick={handleSkillsClick}
          aria-label="Skills view"
          aria-pressed={isSkillsActive}
          className={`${toggleButtonClass} rounded-r ${isSkillsActive ? "bg-bg-hover text-text-primary" : ""}`}
        >
          <BookBookmark size={14} weight="bold" />
          <span className="hidden sm:inline">Skills</span>
        </button>
      </div>

      {/* Right: Panel selector (only visible in repository mode with a repo) */}
      <div className="flex items-center justify-end">
        {isRepoViewActive && <PanelSelector />}
      </div>
    </div>
  );
}
