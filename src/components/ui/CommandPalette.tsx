import { Command } from "cmdk";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  GitBranch,
  GitMerge,
  GitFork,
  Files,
  Code,
  Stack,
  Robot,
  CloudArrowDown,
  ArrowDown,
  ArrowUp,
  Rows,
  SplitVertical,
  TextAa,
  Layout,
  GearSix,
  Keyboard,
  GitCommit,
  Sun,
  Moon,
  TreeStructure,
  Plus,
  BookBookmark,
  Trash,
  SignOut,
  FolderOpen,
  CaretRight,
  ArrowLeft,
  ArrowCounterClockwise,
  Warning,
  Timer,
  MagnifyingGlass,
  ClockCounterClockwise,
  ChartBar,
  ListBullets,
  Check,
  Palette,
} from "@phosphor-icons/react";
import {
  useUIStore,
  useAppView,
  getDockviewApi,
  isReactScanEnabled,
  toggleReactScanAndReload,
} from "../../stores/ui-store";
import { useTabsStore, useActiveTabView } from "../../stores/tabs-store";
import { useMergeConflictStore } from "../../stores/merge-conflict-store";
import { useToast } from "./Toast";
import {
  gitFetch,
  gitPull,
  gitPush,
  openRepository,
  discoverRepository,
  getMergeStatus,
  parseFileConflicts,
  listBranches,
  mergeBranch,
  getStatus,
  rebaseOnto,
  getRebaseStatus,
} from "../../lib/tauri";
import { getErrorMessage } from "../../lib/errors";
import { applyLayout, layoutPresets } from "../../lib/layouts";
import {
  clearAllSavedLayouts,
  LAYOUT_STORAGE_PREFIX,
  encodeRepoPath,
} from "../layout/DockviewLayout";
import {
  getRecentRepositories,
  type RecentRepository,
} from "../../lib/recent-repos";
import { THEMES, getTheme, type ThemeId } from "../../lib/themes";

export function CommandPalette() {
  const {
    showCommandPalette,
    setShowCommandPalette,
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    theme,
    diffViewMode,
    diffFontSize,
    selectedSkillIds,
    perfTracingEnabled,
    toggleBranchesPanel,
    setShowFilesPanel,
    setShowDiffPanel,
    toggleStagingSidebar,
    setShowAIReviewPanel,
    toggleWorktreesPanel,
    setShowWorktreesPanel,
    setShowMergeConflictPanel,
    setTheme,
    setDiffViewMode,
    setDiffFontSize,
    setShowSettingsDialog,
    setShowHelpOverlay,
    setActivePanel,
    setShowSkillsDialog,
    clearSelectedSkills,
    setPerfTracingEnabled,
  } = useUIStore();

  const { repository, openTab } = useTabsStore();
  const { mainView, setMainView } = useActiveTabView();
  const { appView, setAppView } = useAppView();
  const { enterMergeMode, enterConflictMode } = useMergeConflictStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Nested pages state
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const page = pages[pages.length - 1];
  const [branchesForMerge, setBranchesForMerge] = useState<
    Array<{ name: string; isHead: boolean }>
  >([]);
  const [branchesForRebase, setBranchesForRebase] = useState<
    Array<{ name: string; isHead: boolean; isRemote: boolean }>
  >([]);

  // Reset pages and search when dialog closes
  useEffect(() => {
    if (!showCommandPalette) {
      setPages([]);
      setSearch("");
    }
  }, [showCommandPalette]);

  // Get recent repos (excluding the currently open one)
  const recentRepos = useMemo(() => {
    if (!showCommandPalette) return [];
    const all = getRecentRepositories();
    // Filter out current repo - only show other repos to switch to
    return repository ? all.filter((r) => r.path !== repository.path) : all;
  }, [showCommandPalette, repository?.path]);

  const runCommand = (fn: () => void | Promise<void>) => {
    setShowCommandPalette(false);
    fn();
  };

  const handleFetch = async () => {
    if (!repository) return;
    try {
      await gitFetch(repository.path);
      toast.success("Fetch complete", "Successfully fetched from remote");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
    } catch (error) {
      toast.error("Fetch failed", getErrorMessage(error));
    }
  };

  const handlePull = async () => {
    if (!repository) return;
    try {
      const result = await gitPull(repository.path);
      toast.success(
        "Pull complete",
        result || "Successfully pulled from remote",
      );
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    } catch (error) {
      toast.error("Pull failed", getErrorMessage(error));
    }
  };

  const handlePush = async () => {
    if (!repository) return;
    try {
      await gitPush(repository.path);
      toast.success("Push complete", "Successfully pushed to remote");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    } catch (error) {
      toast.error("Push failed", getErrorMessage(error));
    }
  };

  const focusPanel = (panelId: string) => {
    const api = getDockviewApi();
    if (api) {
      const panel = api.getPanel(panelId);
      if (panel) {
        panel.api.setActive();
      }
    }
  };

  const { closeTab } = useTabsStore();

  const handleCloseRepository = () => {
    if (!repository) return;
    // Clear the saved layout for this specific repo so it starts fresh next time
    const layoutKey = LAYOUT_STORAGE_PREFIX + encodeRepoPath(repository.path);
    localStorage.removeItem(layoutKey);
    // Close the current tab
    closeTab(repository.path);
  };

  const handleSwitchRepository = async (repo: RecentRepository) => {
    try {
      const opened = await openRepository(repo.path);
      openTab(opened);
    } catch {
      try {
        const opened = await discoverRepository(repo.path);
        openTab(opened);
      } catch (e) {
        toast.error("Failed to open repository", getErrorMessage(e));
      }
    }
  };

  const handleResolveMergeConflicts = async () => {
    if (!repository) return;
    try {
      const mergeStatus = await getMergeStatus(repository.path);
      if (!mergeStatus.inMerge || mergeStatus.conflictingFiles.length === 0) {
        toast.info(
          "No merge conflicts",
          "There are no merge conflicts to resolve",
        );
        return;
      }
      const fileInfos = await Promise.all(
        mergeStatus.conflictingFiles.map((filePath) =>
          parseFileConflicts(repository.path, filePath),
        ),
      );
      enterMergeMode(fileInfos, mergeStatus.theirBranch);
      setShowMergeConflictPanel(true);
      setActivePanel("merge-conflict");
      // Switch to merge conflict layout
      const api = getDockviewApi();
      if (api) {
        applyLayout(api, "merge-conflict");
      }
    } catch (error) {
      toast.error("Failed to load conflicts", getErrorMessage(error));
    }
  };

  const handleOpenMergePage = async () => {
    if (!repository) return;
    try {
      const branches = await listBranches(repository.path);
      // Filter to local branches only (can't merge remote directly)
      setBranchesForMerge(
        branches
          .filter((b) => !b.isRemote)
          .map((b) => ({ name: b.name, isHead: b.isHead })),
      );
      setSearch("");
      setPages([...pages, "merge-branch"]);
    } catch (error) {
      toast.error("Failed to load branches", getErrorMessage(error));
    }
  };

  const handleMergeBranch = async (branchName: string) => {
    if (!repository) return;
    setShowCommandPalette(false);
    try {
      await mergeBranch(repository.path, branchName);
      toast.success(
        "Merge successful",
        `Merged ${branchName} into current branch`,
      );
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("conflicts")) {
        toast.warning(
          "Merge conflicts",
          "The merge has conflicts that need to be resolved",
        );
        // Open the merge conflict panel
        try {
          const mergeStatus = await getMergeStatus(repository.path);
          if (mergeStatus.conflictingFiles.length > 0) {
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
          }
        } catch (e) {
          console.error("Failed to load conflict info:", e);
        }
        queryClient.invalidateQueries({ queryKey: ["merge-status"] });
      } else {
        toast.error("Merge failed", errorMsg);
      }
    }
  };

  const handleOpenRebasePage = async () => {
    if (!repository) return;
    try {
      const branches = await listBranches(repository.path);
      // Include both local and remote branches for rebase
      setBranchesForRebase(
        branches.map((b) => ({ name: b.name, isHead: b.isHead, isRemote: b.isRemote })),
      );
      setSearch("");
      setPages([...pages, "rebase-onto"]);
    } catch (error) {
      toast.error("Failed to load branches", getErrorMessage(error));
    }
  };

  const handleRebaseOnto = async (ontoRef: string) => {
    if (!repository) return;
    setShowCommandPalette(false);

    // Preflight check: ensure clean working tree
    try {
      const status = await getStatus(repository.path);
      const hasChanges = status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0;
      
      if (hasChanges) {
        toast.error(
          "Cannot rebase with uncommitted changes",
          "Please commit or stash your changes before rebasing",
        );
        return;
      }
    } catch (error) {
      toast.error("Failed to check status", getErrorMessage(error));
      return;
    }

    // Perform the rebase
    try {
      await rebaseOnto(repository.path, ontoRef);
      toast.success(
        "Rebase successful",
        `Rebased current branch onto ${ontoRef}`,
      );
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["aheadBehind"] });
      queryClient.invalidateQueries({ queryKey: ["graph-commits"] });
      queryClient.invalidateQueries({ queryKey: ["graphTableGraph"] });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("conflict") || errorMsg.includes("CONFLICT")) {
        toast.warning(
          "Rebase conflicts",
          "The rebase has conflicts that need to be resolved",
        );
        // Open the conflict panel
        try {
          const rebaseStatus = await getRebaseStatus(repository.path);
          if (rebaseStatus.conflictingFiles.length > 0) {
            const fileInfos = await Promise.all(
              rebaseStatus.conflictingFiles.map((filePath) =>
                parseFileConflicts(repository.path, filePath),
              ),
            );
            enterConflictMode(fileInfos, rebaseStatus.ontoRef, 'rebase');
            setShowMergeConflictPanel(true);
            // Switch to merge conflict layout
            const api = getDockviewApi();
            if (api) {
              applyLayout(api, "merge-conflict");
            }
          }
        } catch (e) {
          console.error("Failed to load conflict info:", e);
        }
        queryClient.invalidateQueries({ queryKey: ["rebase-status"] });
      } else {
        toast.error("Rebase failed", errorMsg);
      }
    }
  };

  return (
    <Command.Dialog
      open={showCommandPalette}
      onOpenChange={setShowCommandPalette}
      label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onKeyDown={(e) => {
        // Escape goes to previous page, or closes if on root
        if (e.key === "Escape") {
          e.preventDefault();
          if (pages.length > 0) {
            setPages((pages) => pages.slice(0, -1));
          } else {
            setShowCommandPalette(false);
          }
        }
        // Backspace goes to previous page when search is empty
        if (e.key === "Backspace" && !search && pages.length > 0) {
          e.preventDefault();
          setPages((pages) => pages.slice(0, -1));
        }
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setShowCommandPalette(false)}
      />

      {/* Dialog content */}
      <div className="relative w-full max-w-2xl bg-bg-secondary rounded-lg shadow-xl border border-border-primary overflow-hidden">
        {/* Page header for nested pages */}
        {page && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border-primary bg-bg-tertiary">
            <button
              onClick={() => setPages((pages) => pages.slice(0, -1))}
              className="p-1 hover:bg-bg-hover rounded-sm"
            >
              <ArrowLeft size={14} className="text-text-muted" />
            </button>
            <span className="text-sm text-text-muted">
              {page === "recent" && "Recent Repositories"}
              {page === "merge-branch" && "Merge Branch"}
              {page === "rebase-onto" && "Rebase Onto..."}
              {page === "themes" && "Select Theme"}
            </span>
          </div>
        )}

        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder={
            page === "recent"
              ? "Search repositories..."
              : page === "merge-branch"
                ? "Search branches..."
                : page === "rebase-onto"
                  ? "Search branches..."
                  : page === "themes"
                    ? "Search themes..."
                    : "Type a command..."
          }
          className="w-full px-4 py-3 bg-transparent border-b border-border-primary text-text-primary placeholder-text-muted outline-hidden focus:outline-hidden focus-visible:outline-hidden focus:ring-0 text-sm"
        />

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-text-muted text-sm">
            No results found.
          </Command.Empty>

          {/* Recent Repositories Page */}
          {page === "recent" && (
            <>
              {recentRepos.map((repo) => (
                <Command.Item
                  key={repo.path}
                  onSelect={() =>
                    runCommand(() => handleSwitchRepository(repo))
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <FolderOpen size={16} className="text-text-muted" />
                  <span className="flex-1">{repo.name}</span>
                  <span className="text-xs text-text-muted truncate max-w-[300px]">
                    {repo.path}
                  </span>
                </Command.Item>
              ))}
              {recentRepos.length === 0 && (
                <div className="py-6 text-center text-text-muted text-sm">
                  No recent repositories
                </div>
              )}
            </>
          )}

          {/* Merge Branch Page */}
          {page === "merge-branch" && (
            <>
              {branchesForMerge
                .filter((b) => !b.isHead) // Don't show current branch
                .map((branch) => (
                  <Command.Item
                    key={branch.name}
                    onSelect={() => handleMergeBranch(branch.name)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <GitMerge size={16} className="text-text-muted" />
                    <span className="flex-1">{branch.name}</span>
                    <span className="text-xs text-text-muted">
                      Merge into current branch
                    </span>
                  </Command.Item>
                ))}
              {branchesForMerge.filter((b) => !b.isHead).length === 0 && (
                <div className="py-6 text-center text-text-muted text-sm">
                  No other branches available to merge
                </div>
              )}
            </>
          )}

          {/* Rebase Onto Page */}
          {page === "rebase-onto" && (
            <>
              {branchesForRebase
                .filter((b) => !b.isHead) // Don't show current branch
                .map((branch) => (
                  <Command.Item
                    key={branch.name}
                    onSelect={() => handleRebaseOnto(branch.name)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <GitFork size={16} className={branch.isRemote ? "text-accent-purple" : "text-text-muted"} />
                    <span className="flex-1">{branch.name}</span>
                    <span className="text-xs text-text-muted">
                      {branch.isRemote ? "Remote" : "Local"}
                    </span>
                  </Command.Item>
                ))}
              {branchesForRebase.filter((b) => !b.isHead).length === 0 && (
                <div className="py-6 text-center text-text-muted text-sm">
                  No other branches available to rebase onto
                </div>
              )}
            </>
          )}

          {/* Themes Page */}
          {page === "themes" && (
            <>
              {THEMES.map((t) => (
                <Command.Item
                  key={t.id}
                  onSelect={() =>
                    runCommand(() => setTheme(t.id as ThemeId))
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <span className="w-4 flex justify-center">
                    {theme === t.id && (
                      <Check size={14} weight="bold" className="text-accent-green" />
                    )}
                  </span>
                  {t.kind === "light" ? (
                    <Sun size={16} className="text-text-muted" />
                  ) : (
                    <Moon size={16} className="text-text-muted" />
                  )}
                  <span className="flex-1">{t.label}</span>
                  <span className="text-xs text-text-muted capitalize">
                    {t.kind}
                  </span>
                </Command.Item>
              ))}
            </>
          )}

          {/* Main menu (no page selected) */}
          {!page && (
            <>
              {/* Panels Group */}
              <Command.Group
                heading="Panels"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() => runCommand(toggleBranchesPanel)}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <GitBranch size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle Branches Panel</span>
                  <span className="text-xs text-text-muted">
                    {showBranchesPanel ? "Hide" : "Show"}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    1
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => setShowFilesPanel(!showFilesPanel))
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Files size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle Files Panel</span>
                  <span className="text-xs text-text-muted">
                    {showFilesPanel ? "Hide" : "Show"}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    3
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => setShowDiffPanel(!showDiffPanel))
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Code size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle Diff Panel</span>
                  <span className="text-xs text-text-muted">
                    {showDiffPanel ? "Hide" : "Show"}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    4
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() => runCommand(toggleStagingSidebar)}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Stack size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle Local Changes</span>
                  <span className="text-xs text-text-muted">
                    {showStagingSidebar ? "Hide" : "Show"}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    Cmd+Shift+S
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => setShowAIReviewPanel(!showAIReviewPanel))
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Robot size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle AI Review Panel</span>
                  <span className="text-xs text-text-muted">
                    {showAIReviewPanel ? "Hide" : "Show"}
                  </span>
                </Command.Item>

                <Command.Item
                  onSelect={() => runCommand(toggleWorktreesPanel)}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <TreeStructure size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle Worktrees Panel</span>
                  <span className="text-xs text-text-muted">
                    {showWorktreesPanel ? "Hide" : "Show"}
                  </span>
                </Command.Item>
              </Command.Group>

              {/* Repository Group - Switch/Close repos */}
              <Command.Group
                heading="Repository"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() => {
                    setSearch("");
                    setPages([...pages, "recent"]);
                  }}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  keywords={["switch", "recent", "open"]}
                >
                  <FolderOpen size={16} className="text-text-muted" />
                  <span className="flex-1">Open Recent...</span>
                  <CaretRight size={16} className="text-text-muted" />
                </Command.Item>

                {repository && (
                  <Command.Item
                    onSelect={() => runCommand(handleCloseRepository)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={["close", "exit", "quit"]}
                  >
                    <SignOut size={16} className="text-text-muted" />
                    <span className="flex-1">Close Repository</span>
                  </Command.Item>
                )}
              </Command.Group>

              {/* Views Group - Switch between main views */}
              {repository && (
                <Command.Group
                  heading="Views"
                  className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
                >
                  <Command.Item
                    onSelect={() =>
                      runCommand(() => {
                        setAppView("workspace");
                        setMainView("repository");
                      })
                    }
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={["repository", "history", "commits", "log", "changes", "working", "staged"]}
                  >
                    <ClockCounterClockwise
                      size={16}
                      className="text-text-muted"
                    />
                    <span className="flex-1">Go to Repository</span>
                    <span className="text-xs text-text-muted">
                      {appView === "workspace" && mainView === "repository" ? "Active" : ""}
                    </span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() =>
                      runCommand(() => {
                        setAppView("workspace");
                        setMainView("statistics");
                      })
                    }
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={[
                      "statistics",
                      "stats",
                      "contributions",
                      "calendar",
                      "heatmap",
                    ]}
                  >
                    <ChartBar size={16} className="text-text-muted" />
                    <span className="flex-1">Go to Statistics</span>
                    <span className="text-xs text-text-muted">
                      {appView === "workspace" && mainView === "statistics" ? "Active" : ""}
                    </span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() =>
                      runCommand(() => {
                        setAppView("workspace");
                        setMainView("changelog");
                      })
                    }
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={[
                      "changelog",
                      "release",
                      "notes",
                      "weekly",
                      "summary",
                    ]}
                  >
                    <ListBullets size={16} className="text-text-muted" />
                    <span className="flex-1">Go to Changelog</span>
                    <span className="text-xs text-text-muted">
                      {appView === "workspace" && mainView === "changelog" ? "Active" : ""}
                    </span>
                  </Command.Item>
                </Command.Group>
              )}

              {/* Navigation Group */}
              <Command.Group
                heading="Navigation"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      setActivePanel("branches");
                      focusPanel("branches");
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <GitBranch size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Branches</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    1
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      setActivePanel("commits");
                      focusPanel("commits");
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <GitCommit size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Commits</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    2
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      setActivePanel("files");
                      focusPanel("files");
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Files size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Files</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    3
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      setActivePanel("diff");
                      focusPanel("diff");
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Code size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Diff</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    4
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      setActivePanel("staging");
                      focusPanel("staging");
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Stack size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Local Changes</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    5
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      setShowWorktreesPanel(true);
                      setActivePanel("worktrees");
                      focusPanel("worktrees");
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <TreeStructure size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Worktrees</span>
                </Command.Item>
              </Command.Group>

              {/* Git Group - only show when repo is open */}
              {repository && (
                <Command.Group
                  heading="Git"
                  className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
                >
                  <Command.Item
                    onSelect={() => runCommand(handleFetch)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <CloudArrowDown size={16} className="text-text-muted" />
                    <span className="flex-1">Fetch from Remote</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(handlePull)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <ArrowDown size={16} className="text-text-muted" />
                    <span className="flex-1">Pull from Remote</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(handlePush)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <ArrowUp size={16} className="text-text-muted" />
                    <span className="flex-1">Push to Remote</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() =>
                      runCommand(() => {
                        setShowWorktreesPanel(true);
                        setActivePanel("worktrees");
                        focusPanel("worktrees");
                      })
                    }
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <Plus size={16} className="text-text-muted" />
                    <span className="flex-1">Create New Worktree</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(handleResolveMergeConflicts)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={["merge", "conflict", "resolve"]}
                  >
                    <Warning size={16} className="text-accent-yellow" />
                    <span className="flex-1">Resolve Merge Conflicts</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => handleOpenMergePage()}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={["merge", "branch", "combine"]}
                  >
                    <GitMerge size={16} className="text-text-muted" />
                    <span className="flex-1">Merge Branch...</span>
                    <CaretRight size={16} className="text-text-muted" />
                  </Command.Item>

                  <Command.Item
                    onSelect={() => handleOpenRebasePage()}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                    keywords={["rebase", "branch", "onto", "base"]}
                  >
                    <GitFork size={16} className="text-text-muted" />
                    <span className="flex-1">Rebase Onto...</span>
                    <CaretRight size={16} className="text-text-muted" />
                  </Command.Item>
                </Command.Group>
              )}

              {/* View Group */}
              <Command.Group
                heading="View"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() => {
                    setSearch("");
                    setPages([...pages, "themes"]);
                  }}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  keywords={["theme", "dark", "light", "appearance"]}
                >
                  <Palette size={16} className="text-text-muted" />
                  <span className="flex-1">Themes...</span>
                  <span className="text-xs text-text-muted">
                    {getTheme(theme)?.label ?? "Theme"}
                  </span>
                  <CaretRight size={16} className="text-text-muted" />
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() =>
                      setDiffViewMode(
                        diffViewMode === "split" ? "unified" : "split",
                      ),
                    )
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  {diffViewMode === "split" ? (
                    <Rows size={16} className="text-text-muted" />
                  ) : (
                    <SplitVertical size={16} className="text-text-muted" />
                  )}
                  <span className="flex-1">Toggle Diff View Mode</span>
                  <span className="text-xs text-text-muted">
                    {diffViewMode === "split"
                      ? "Switch to Unified"
                      : "Switch to Split"}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    V
                  </kbd>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() =>
                      setDiffFontSize(Math.min(diffFontSize + 1, 24)),
                    )
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <TextAa size={16} className="text-text-muted" />
                  <span className="flex-1">Increase Font Size</span>
                  <span className="text-xs text-text-muted">
                    {diffFontSize}px
                  </span>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    runCommand(() =>
                      setDiffFontSize(Math.max(diffFontSize - 1, 10)),
                    )
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <TextAa size={16} className="text-text-muted" />
                  <span className="flex-1">Decrease Font Size</span>
                  <span className="text-xs text-text-muted">
                    {diffFontSize}px
                  </span>
                </Command.Item>
              </Command.Group>

              {/* Layout Group */}
              <Command.Group
                heading="Layout"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      clearAllSavedLayouts();
                      window.location.reload();
                    })
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  keywords={["reset", "default", "clear"]}
                >
                  <ArrowCounterClockwise
                    size={16}
                    className="text-text-muted shrink-0"
                  />
                  <span className="shrink-0 whitespace-nowrap">
                    Reset Layout
                  </span>
                  <span className="flex-1 text-xs text-text-muted text-right">
                    Restore default layout
                  </span>
                </Command.Item>

                {layoutPresets.map((preset) => (
                  <Command.Item
                    key={preset.id}
                    onSelect={() =>
                      runCommand(() => {
                        const api = getDockviewApi();
                        if (api) {
                          applyLayout(api, preset.id);
                        }
                      })
                    }
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <Layout size={16} className="text-text-muted shrink-0" />
                    <span className="shrink-0 whitespace-nowrap">
                      Layout: {preset.name}
                    </span>
                    <span className="flex-1 text-xs text-text-muted text-right truncate">
                      {preset.description}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              {/* Skills Group */}
              <Command.Group
                heading="Skills"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() => runCommand(() => setAppView("skills"))}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  keywords={["skills", "agent", "install", "browse"]}
                >
                  <BookBookmark size={16} className="text-text-muted" />
                  <span className="flex-1">Go to Skills</span>
                  <span className="text-xs text-text-muted">
                    {appView === "skills" ? "Active" : ""}
                  </span>
                </Command.Item>

                <Command.Item
                  onSelect={() => runCommand(() => setShowSkillsDialog(true))}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <BookBookmark size={16} className="text-text-muted" />
                  <span className="flex-1">Manage Skills (Dialog)</span>
                </Command.Item>

                {selectedSkillIds.length > 0 && (
                  <Command.Item
                    onSelect={() => runCommand(clearSelectedSkills)}
                    className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  >
                    <Trash size={16} className="text-text-muted" />
                    <span className="flex-1">Clear Selected Skills</span>
                    <span className="text-xs text-text-muted">
                      {selectedSkillIds.length} selected
                    </span>
                  </Command.Item>
                )}
              </Command.Group>

              {/* Developer Group */}
              <Command.Group
                heading="Developer"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() =>
                    runCommand(() => setPerfTracingEnabled(!perfTracingEnabled))
                  }
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  keywords={["performance", "debug", "trace", "log"]}
                >
                  <Timer size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle Perf Tracing</span>
                  <span className="text-xs text-text-muted">
                    {perfTracingEnabled ? "On" : "Off"}
                  </span>
                </Command.Item>

                <Command.Item
                  onSelect={() => runCommand(toggleReactScanAndReload)}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                  keywords={["react", "scan", "render", "debug", "highlight"]}
                >
                  <MagnifyingGlass size={16} className="text-text-muted" />
                  <span className="flex-1">Toggle React Scan</span>
                  <span className="text-xs text-text-muted">
                    {isReactScanEnabled() ? "On (reload)" : "Off (reload)"}
                  </span>
                </Command.Item>
              </Command.Group>

              {/* General Group */}
              <Command.Group
                heading="General"
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-text-muted **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:font-medium"
              >
                <Command.Item
                  onSelect={() => runCommand(() => setShowSettingsDialog(true))}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <GearSix size={16} className="text-text-muted" />
                  <span className="flex-1">Open Settings</span>
                </Command.Item>

                <Command.Item
                  onSelect={() => runCommand(() => setShowHelpOverlay(true))}
                  className="flex items-center gap-3 px-2 py-2 rounded-sm cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
                >
                  <Keyboard size={16} className="text-text-muted" />
                  <span className="flex-1">Show Keyboard Shortcuts</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm text-text-muted font-mono text-xs">
                    ?
                  </kbd>
                </Command.Item>
              </Command.Group>
            </>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
