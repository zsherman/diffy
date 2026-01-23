import { useCallback } from "react";
import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { produce } from "immer";
import type { RepositoryInfo, ViewMode, AIReviewData } from "../types/git";

// Panel visibility state (per-tab)
export interface PanelVisibility {
  showBranchesPanel: boolean;
  showFilesPanel: boolean;
  showDiffPanel: boolean;
  showStagingSidebar: boolean;
  showAIReviewPanel: boolean;
  showWorktreesPanel: boolean;
  showGraphPanel: boolean;
  showMergeConflictPanel: boolean;
}

// Per-repository tab state
export interface RepoTabState {
  // Repository info
  repository: RepositoryInfo;

  // Selection state
  selectedBranch: string | null;
  selectedCommit: string | null;
  selectedFile: string | null;

  // Filters
  branchFilter: string;
  commitFilter: string;
  worktreeFilter: string;

  // Commit form
  commitMessage: string;
  commitDescription: string;
  amendPreviousCommit: boolean;

  // View mode
  mainView: "history" | "changes" | "statistics";
  viewMode: ViewMode;
  selectedWorktree: string | null;

  // Statistics view (per-repo)
  statisticsContributorEmail: string | null;
  statisticsTimeRange: 0.25 | 1 | 3 | 6 | 12; // 0.25 = 1 week

  // AI Review (per-repo)
  aiReview: AIReviewData | null;
  aiReviewLoading: boolean;
  aiReviewError: string | null;

  // Panel visibility (per-tab)
  panels: PanelVisibility;

  // Serialized dockview layout (for restoration)
  dockviewLayout: unknown | null;
}

interface TabsContext {
  tabs: RepoTabState[];
  activeTabPath: string | null;
}

const STORAGE_KEY = "diffy-open-tabs";

// Load saved tabs from localStorage
function loadSavedTabs(): { paths: string[]; activeTabPath: string | null } {
  if (typeof window === "undefined") {
    return { paths: [], activeTabPath: null };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        paths: Array.isArray(parsed.paths) ? parsed.paths : [],
        activeTabPath: parsed.activeTabPath || null,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { paths: [], activeTabPath: null };
}

// Save tabs to localStorage
function saveTabs(tabs: RepoTabState[], activeTabPath: string | null) {
  if (typeof window === "undefined") return;
  try {
    const data = {
      paths: tabs.map((t) => t.repository.path),
      activeTabPath,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore save errors
  }
}

// Default panel visibility
const DEFAULT_PANELS: PanelVisibility = {
  showBranchesPanel: false,
  showFilesPanel: true,
  showDiffPanel: true,
  showStagingSidebar: false,
  showAIReviewPanel: false,
  showWorktreesPanel: false,
  showGraphPanel: false,
  showMergeConflictPanel: false,
};

// Create default tab state for a repository
function createTabState(repository: RepositoryInfo): RepoTabState {
  return {
    repository,
    selectedBranch: null,
    selectedCommit: null,
    selectedFile: null,
    branchFilter: "",
    commitFilter: "",
    worktreeFilter: "",
    commitMessage: "",
    commitDescription: "",
    amendPreviousCommit: false,
    mainView: "history",
    viewMode: "working",
    selectedWorktree: null,
    statisticsContributorEmail: null,
    statisticsTimeRange: 1,
    aiReview: null,
    aiReviewLoading: false,
    aiReviewError: null,
    panels: { ...DEFAULT_PANELS },
    dockviewLayout: null,
  };
}

export const tabsStore = createStore({
  context: {
    tabs: [],
    activeTabPath: null,
  } as TabsContext,
  on: {
    openTab: (ctx, event: { repository: RepositoryInfo }) =>
      produce(ctx, (draft) => {
        // Check if tab already exists
        const existingIndex = draft.tabs.findIndex(
          (t) => t.repository.path === event.repository.path,
        );

        if (existingIndex >= 0) {
          // Tab exists, just switch to it
          draft.activeTabPath = event.repository.path;
        } else {
          // Add new tab
          draft.tabs.push(createTabState(event.repository));
          draft.activeTabPath = event.repository.path;
        }
        saveTabs(draft.tabs, draft.activeTabPath);
      }),

    switchTab: (ctx, event: { path: string }) =>
      produce(ctx, (draft) => {
        const exists = draft.tabs.some((t) => t.repository.path === event.path);
        if (exists) {
          draft.activeTabPath = event.path;
          saveTabs(draft.tabs, draft.activeTabPath);
        }
      }),

    closeTab: (ctx, event: { path: string }) =>
      produce(ctx, (draft) => {
        const index = draft.tabs.findIndex(
          (t) => t.repository.path === event.path,
        );
        if (index < 0) return;

        draft.tabs.splice(index, 1);

        // Update active tab if we closed the active one
        if (draft.activeTabPath === event.path) {
          if (draft.tabs.length > 0) {
            // Switch to adjacent tab
            const newIndex = Math.min(index, draft.tabs.length - 1);
            draft.activeTabPath = draft.tabs[newIndex].repository.path;
          } else {
            draft.activeTabPath = null;
          }
        }
        saveTabs(draft.tabs, draft.activeTabPath);
      }),

    // Update tab state for the active tab
    updateActiveTab: (
      ctx,
      event: { updates: Partial<Omit<RepoTabState, "repository">> },
    ) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) {
          Object.assign(tab, event.updates);
        }
      }),

    // Update head branch for a specific repo
    setHeadBranch: (ctx, event: { path: string; branch: string }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find((t) => t.repository.path === event.path);
        if (tab) {
          tab.repository.headBranch = event.branch;
        }
      }),

    // Restore tabs from saved paths (called on app load)
    restoreTabs: (
      ctx,
      event: { tabs: RepoTabState[]; activeTabPath: string | null },
    ) =>
      produce(ctx, (draft) => {
        draft.tabs = event.tabs;
        draft.activeTabPath = event.activeTabPath;
      }),

    // Clear commit form for active tab
    clearCommitForm: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) {
          tab.commitMessage = "";
          tab.commitDescription = "";
          tab.amendPreviousCommit = false;
        }
      }),

    // Clear AI review for active tab
    clearAIReview: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) {
          tab.aiReview = null;
          tab.aiReviewError = null;
        }
      }),

    // Batch update all panel visibility at once (to avoid intermediate states)
    syncPanels: (ctx, event: { panels: Partial<PanelVisibility> }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) {
          Object.assign(tab.panels, event.panels);
        }
      }),

    // Individual panel toggles
    setShowBranchesPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showBranchesPanel = event.show;
      }),

    toggleBranchesPanel: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showBranchesPanel = !tab.panels.showBranchesPanel;
      }),

    setShowFilesPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showFilesPanel = event.show;
      }),

    setShowDiffPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showDiffPanel = event.show;
      }),

    setShowStagingSidebar: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showStagingSidebar = event.show;
      }),

    toggleStagingSidebar: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showStagingSidebar = !tab.panels.showStagingSidebar;
      }),

    setShowAIReviewPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showAIReviewPanel = event.show;
      }),

    setShowWorktreesPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showWorktreesPanel = event.show;
      }),

    toggleWorktreesPanel: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showWorktreesPanel = !tab.panels.showWorktreesPanel;
      }),

    setShowGraphPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showGraphPanel = event.show;
      }),

    toggleGraphPanel: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showGraphPanel = !tab.panels.showGraphPanel;
      }),

    setShowMergeConflictPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) tab.panels.showMergeConflictPanel = event.show;
      }),

    toggleMergeConflictPanel: (ctx) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab)
          tab.panels.showMergeConflictPanel =
            !tab.panels.showMergeConflictPanel;
      }),

    // Save dockview layout for current tab
    saveDockviewLayout: (ctx, event: { layout: unknown }) =>
      produce(ctx, (draft) => {
        const tab = draft.tabs.find(
          (t) => t.repository.path === draft.activeTabPath,
        );
        if (tab) {
          tab.dockviewLayout = event.layout;
        }
      }),
  },
});

// Focused hook for just activeTabPath (used by DockviewLayout)
export function useActiveTabPath() {
  return useSelector(tabsStore, (s) => s.context.activeTabPath);
}

// Focused hook for just tab actions (no state subscriptions - used by AppContent)
// These are stable callbacks that don't cause re-renders
export function useTabActions() {
  const openTab = useCallback(
    (repository: RepositoryInfo) =>
      tabsStore.send({ type: "openTab", repository }),
    [],
  );
  const restoreTabs = useCallback(
    (tabs: RepoTabState[], activeTabPath: string | null) =>
      tabsStore.send({ type: "restoreTabs", tabs, activeTabPath }),
    [],
  );
  return { openTab, restoreTabs };
}

// Focused hook for checking if any tabs exist (used by App)
export function useHasOpenTabs() {
  return useSelector(tabsStore, (s) => s.context.tabs.length > 0);
}

// Focused hook for active repository (used by App and other components)
export function useActiveRepository() {
  return useSelector(
    tabsStore,
    (s) => {
      if (!s.context.activeTabPath) return null;
      const tab = s.context.tabs.find(
        (t) => t.repository.path === s.context.activeTabPath,
      );
      return tab?.repository ?? null;
    },
    // Custom equality check based on path to avoid unnecessary re-renders
    (a, b) => a?.path === b?.path,
  );
}

// Hook for accessing tabs store with granular selectors
export function useTabsStore() {
  const tabs = useSelector(tabsStore, (s) => s.context.tabs);
  const activeTabPath = useSelector(tabsStore, (s) => s.context.activeTabPath);

  // Get active tab - use stable selector
  const activeTab = useSelector(
    tabsStore,
    (s) => {
      if (!s.context.activeTabPath) return null;
      return (
        s.context.tabs.find(
          (t) => t.repository.path === s.context.activeTabPath,
        ) ?? null
      );
    },
    // Custom equality check to prevent unnecessary re-renders
    (a, b) => a?.repository.path === b?.repository.path,
  );

  // Active repository - also use stable selector
  const repository = useSelector(
    tabsStore,
    (s) => {
      if (!s.context.activeTabPath) return null;
      const tab = s.context.tabs.find(
        (t) => t.repository.path === s.context.activeTabPath,
      );
      return tab?.repository ?? null;
    },
    // Custom equality check based on path
    (a, b) => a?.path === b?.path,
  );

  // Memoize actions to prevent infinite loops when used in useEffect/useCallback dependencies
  const openTab = useCallback(
    (repository: RepositoryInfo) =>
      tabsStore.send({ type: "openTab", repository }),
    [],
  );
  const closeTab = useCallback(
    (path: string) => tabsStore.send({ type: "closeTab", path }),
    [],
  );
  const switchTab = useCallback(
    (path: string) => tabsStore.send({ type: "switchTab", path }),
    [],
  );
  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setHeadBranch = useCallback(
    (path: string, branch: string) =>
      tabsStore.send({ type: "setHeadBranch", path, branch }),
    [],
  );
  const restoreTabs = useCallback(
    (tabs: RepoTabState[], activeTabPath: string | null) =>
      tabsStore.send({ type: "restoreTabs", tabs, activeTabPath }),
    [],
  );
  const clearCommitForm = useCallback(
    () => tabsStore.send({ type: "clearCommitForm" }),
    [],
  );
  const clearAIReview = useCallback(
    () => tabsStore.send({ type: "clearAIReview" }),
    [],
  );

  return {
    // State
    tabs,
    activeTabPath,
    activeTab,
    repository,

    // Actions (memoized)
    openTab,
    closeTab,
    switchTab,
    updateActiveTab,
    setHeadBranch,
    restoreTabs,
    clearCommitForm,
    clearAIReview,
  };
}

// =============================================================================
// FOCUSED HOOKS - Use these for better performance (fewer subscriptions)
// =============================================================================

// Centralized selector helper to avoid repeated tabs.find() in each selector
type TabsState = { context: TabsContext };
function selectActiveTab(s: TabsState): RepoTabState | null {
  if (!s.context.activeTabPath) return null;
  return (
    s.context.tabs.find((t) => t.repository.path === s.context.activeTabPath) ??
    null
  );
}

// Default panel state for when no tab is active
const DEFAULT_PANEL_STATE: PanelVisibility = {
  showBranchesPanel: false,
  showFilesPanel: true,
  showDiffPanel: true,
  showStagingSidebar: false,
  showAIReviewPanel: false,
  showWorktreesPanel: false,
  showGraphPanel: false,
  showMergeConflictPanel: false,
};

// Shallow equality check for panel visibility
function panelsEqual(a: PanelVisibility, b: PanelVisibility): boolean {
  return (
    a.showBranchesPanel === b.showBranchesPanel &&
    a.showFilesPanel === b.showFilesPanel &&
    a.showDiffPanel === b.showDiffPanel &&
    a.showStagingSidebar === b.showStagingSidebar &&
    a.showAIReviewPanel === b.showAIReviewPanel &&
    a.showWorktreesPanel === b.showWorktreesPanel &&
    a.showGraphPanel === b.showGraphPanel &&
    a.showMergeConflictPanel === b.showMergeConflictPanel
  );
}

// Hook for panel visibility state only (used by DockviewLayout)
// Uses a SINGLE selector with shallow equality to minimize re-renders
export function useActiveTabPanels() {
  // Single subscription for all panel state - much better than 8 separate selectors
  const panels = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.panels ?? DEFAULT_PANEL_STATE,
    panelsEqual,
  );

  // Destructure for convenient access
  const {
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,
  } = panels;

  // Panel actions (memoized)
  const syncPanels = useCallback(
    (panels: Partial<PanelVisibility>) =>
      tabsStore.send({ type: "syncPanels", panels }),
    [],
  );
  const setShowBranchesPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowBranchesPanel", show }),
    [],
  );
  const toggleBranchesPanel = useCallback(
    () => tabsStore.send({ type: "toggleBranchesPanel" }),
    [],
  );
  const setShowFilesPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowFilesPanel", show }),
    [],
  );
  const setShowDiffPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowDiffPanel", show }),
    [],
  );
  const setShowStagingSidebar = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowStagingSidebar", show }),
    [],
  );
  const toggleStagingSidebar = useCallback(
    () => tabsStore.send({ type: "toggleStagingSidebar" }),
    [],
  );
  const setShowAIReviewPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowAIReviewPanel", show }),
    [],
  );
  const setShowWorktreesPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowWorktreesPanel", show }),
    [],
  );
  const toggleWorktreesPanel = useCallback(
    () => tabsStore.send({ type: "toggleWorktreesPanel" }),
    [],
  );
  const setShowGraphPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowGraphPanel", show }),
    [],
  );
  const toggleGraphPanel = useCallback(
    () => tabsStore.send({ type: "toggleGraphPanel" }),
    [],
  );
  const setShowMergeConflictPanel = useCallback(
    (show: boolean) =>
      tabsStore.send({ type: "setShowMergeConflictPanel", show }),
    [],
  );
  const toggleMergeConflictPanel = useCallback(
    () => tabsStore.send({ type: "toggleMergeConflictPanel" }),
    [],
  );

  return {
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,
    syncPanels,
    setShowBranchesPanel,
    toggleBranchesPanel,
    setShowFilesPanel,
    setShowDiffPanel,
    setShowStagingSidebar,
    toggleStagingSidebar,
    setShowAIReviewPanel,
    setShowWorktreesPanel,
    toggleWorktreesPanel,
    setShowGraphPanel,
    toggleGraphPanel,
    setShowMergeConflictPanel,
    toggleMergeConflictPanel,
  };
}

// View state type for single selector
type ViewState = {
  mainView: "history" | "changes" | "statistics";
  viewMode: ViewMode;
};
const DEFAULT_VIEW_STATE: ViewState = {
  mainView: "history",
  viewMode: "working",
};

// Hook for view mode state (used by App, RepoSelector)
// Uses a SINGLE selector for both values
export function useActiveTabView() {
  const { mainView, viewMode } = useSelector(
    tabsStore,
    (s): ViewState => {
      const tab = selectActiveTab(s);
      return tab
        ? { mainView: tab.mainView, viewMode: tab.viewMode }
        : DEFAULT_VIEW_STATE;
    },
    (a, b) => a.mainView === b.mainView && a.viewMode === b.viewMode,
  );

  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setMainView = useCallback(
    (view: "history" | "changes" | "statistics") =>
      updateActiveTab({ mainView: view }),
    [updateActiveTab],
  );
  const setViewMode = useCallback(
    (mode: ViewMode) => updateActiveTab({ viewMode: mode }),
    [updateActiveTab],
  );

  return { mainView, viewMode, setMainView, setViewMode };
}

// Selection state type for single selector
type SelectionState = {
  selectedBranch: string | null;
  selectedCommit: string | null;
  selectedFile: string | null;
  selectedWorktree: string | null;
};
const DEFAULT_SELECTION_STATE: SelectionState = {
  selectedBranch: null,
  selectedCommit: null,
  selectedFile: null,
  selectedWorktree: null,
};

// Hook for selection state (used by CommitList, FileList, DiffViewer, etc.)
// Uses a SINGLE selector for all selection values
export function useActiveTabSelection() {
  const selection = useSelector(
    tabsStore,
    (s): SelectionState => {
      const tab = selectActiveTab(s);
      return tab
        ? {
            selectedBranch: tab.selectedBranch,
            selectedCommit: tab.selectedCommit,
            selectedFile: tab.selectedFile,
            selectedWorktree: tab.selectedWorktree,
          }
        : DEFAULT_SELECTION_STATE;
    },
    (a, b) =>
      a.selectedBranch === b.selectedBranch &&
      a.selectedCommit === b.selectedCommit &&
      a.selectedFile === b.selectedFile &&
      a.selectedWorktree === b.selectedWorktree,
  );

  const { selectedBranch, selectedCommit, selectedFile, selectedWorktree } =
    selection;

  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setSelectedBranch = useCallback(
    (branch: string | null) => updateActiveTab({ selectedBranch: branch }),
    [updateActiveTab],
  );
  const setSelectedCommit = useCallback(
    (commit: string | null) =>
      updateActiveTab({ selectedCommit: commit, selectedFile: null }),
    [updateActiveTab],
  );
  const setSelectedFile = useCallback(
    (file: string | null) => updateActiveTab({ selectedFile: file }),
    [updateActiveTab],
  );
  const setSelectedWorktree = useCallback(
    (worktree: string | null) =>
      updateActiveTab({ selectedWorktree: worktree }),
    [updateActiveTab],
  );

  return {
    selectedBranch,
    selectedCommit,
    selectedFile,
    selectedWorktree,
    setSelectedBranch,
    setSelectedCommit,
    setSelectedFile,
    setSelectedWorktree,
  };
}

// Hook for commit form state (used by StagingSidebar)
export function useActiveTabCommitForm() {
  const commitMessage = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.commitMessage ?? "",
  );
  const commitDescription = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.commitDescription ?? "",
  );
  const amendPreviousCommit = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.amendPreviousCommit ?? false,
  );

  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setCommitMessage = useCallback(
    (message: string) => updateActiveTab({ commitMessage: message }),
    [updateActiveTab],
  );
  const setCommitDescription = useCallback(
    (description: string) =>
      updateActiveTab({ commitDescription: description }),
    [updateActiveTab],
  );
  const setAmendPreviousCommit = useCallback(
    (amend: boolean) => updateActiveTab({ amendPreviousCommit: amend }),
    [updateActiveTab],
  );
  const clearCommitForm = useCallback(
    () => tabsStore.send({ type: "clearCommitForm" }),
    [],
  );

  return {
    commitMessage,
    commitDescription,
    amendPreviousCommit,
    setCommitMessage,
    setCommitDescription,
    setAmendPreviousCommit,
    clearCommitForm,
  };
}

// Hook for filter state (used by BranchList, CommitList, WorktreeList)
export function useActiveTabFilters() {
  const branchFilter = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.branchFilter ?? "",
  );
  const commitFilter = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.commitFilter ?? "",
  );
  const worktreeFilter = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.worktreeFilter ?? "",
  );

  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setBranchFilter = useCallback(
    (filter: string) => updateActiveTab({ branchFilter: filter }),
    [updateActiveTab],
  );
  const setCommitFilter = useCallback(
    (filter: string) => updateActiveTab({ commitFilter: filter }),
    [updateActiveTab],
  );
  const setWorktreeFilter = useCallback(
    (filter: string) => updateActiveTab({ worktreeFilter: filter }),
    [updateActiveTab],
  );

  return {
    branchFilter,
    commitFilter,
    worktreeFilter,
    setBranchFilter,
    setCommitFilter,
    setWorktreeFilter,
  };
}

// Hook for statistics view state (used by StatisticsView)
export function useActiveTabStatistics() {
  const statisticsContributorEmail = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.statisticsContributorEmail ?? null,
  );
  const statisticsTimeRange = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.statisticsTimeRange ?? 1,
  );

  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setStatisticsContributorEmail = useCallback(
    (email: string | null) =>
      updateActiveTab({ statisticsContributorEmail: email }),
    [updateActiveTab],
  );
  const setStatisticsTimeRange = useCallback(
    (range: 0.25 | 1 | 3 | 6 | 12) =>
      updateActiveTab({ statisticsTimeRange: range }),
    [updateActiveTab],
  );

  return {
    statisticsContributorEmail,
    setStatisticsContributorEmail,
    statisticsTimeRange,
    setStatisticsTimeRange,
  };
}

// Hook for AI review state (used by AIReviewContent)
export function useActiveTabAIReview() {
  const aiReview = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.aiReview ?? null,
    // Shallow equality for aiReview object
    (a, b) =>
      a === b ||
      (a?.summary === b?.summary && a?.bugs?.length === b?.bugs?.length),
  );
  const aiReviewLoading = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.aiReviewLoading ?? false,
  );
  const aiReviewError = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.aiReviewError ?? null,
  );

  const updateActiveTab = useCallback(
    (updates: Partial<Omit<RepoTabState, "repository">>) =>
      tabsStore.send({ type: "updateActiveTab", updates }),
    [],
  );
  const setAIReview = useCallback(
    (review: AIReviewData | null) => updateActiveTab({ aiReview: review }),
    [updateActiveTab],
  );
  const setAIReviewLoading = useCallback(
    (loading: boolean) => updateActiveTab({ aiReviewLoading: loading }),
    [updateActiveTab],
  );
  const setAIReviewError = useCallback(
    (error: string | null) => updateActiveTab({ aiReviewError: error }),
    [updateActiveTab],
  );
  const clearAIReview = useCallback(
    () => tabsStore.send({ type: "clearAIReview" }),
    [],
  );

  return {
    aiReview,
    aiReviewLoading,
    aiReviewError,
    setAIReview,
    setAIReviewLoading,
    setAIReviewError,
    clearAIReview,
  };
}

// =============================================================================
// LEGACY HOOK - Kept for backward compatibility, delegates to focused hooks
// =============================================================================

// Hook for accessing per-repo state with individual selectors (for components that need specific fields)
// NOTE: Prefer using the focused hooks above for better performance
export function useActiveTabState() {
  // Use the focused hooks
  const panels = useActiveTabPanels();
  const view = useActiveTabView();
  const selection = useActiveTabSelection();
  const commitForm = useActiveTabCommitForm();
  const filters = useActiveTabFilters();
  const statistics = useActiveTabStatistics();
  const aiReview = useActiveTabAIReview();

  // Additional selectors not in focused hooks
  const dockviewLayout = useSelector(
    tabsStore,
    (s) => selectActiveTab(s)?.dockviewLayout ?? null,
  );
  const saveDockviewLayout = useCallback(
    (layout: unknown) => tabsStore.send({ type: "saveDockviewLayout", layout }),
    [],
  );

  return {
    // Selection state
    selectedBranch: selection.selectedBranch,
    selectedCommit: selection.selectedCommit,
    selectedFile: selection.selectedFile,
    selectedWorktree: selection.selectedWorktree,
    setSelectedBranch: selection.setSelectedBranch,
    setSelectedCommit: selection.setSelectedCommit,
    setSelectedFile: selection.setSelectedFile,
    setSelectedWorktree: selection.setSelectedWorktree,

    // Filter state
    branchFilter: filters.branchFilter,
    commitFilter: filters.commitFilter,
    worktreeFilter: filters.worktreeFilter,
    setBranchFilter: filters.setBranchFilter,
    setCommitFilter: filters.setCommitFilter,
    setWorktreeFilter: filters.setWorktreeFilter,

    // Commit form state
    commitMessage: commitForm.commitMessage,
    commitDescription: commitForm.commitDescription,
    amendPreviousCommit: commitForm.amendPreviousCommit,
    setCommitMessage: commitForm.setCommitMessage,
    setCommitDescription: commitForm.setCommitDescription,
    setAmendPreviousCommit: commitForm.setAmendPreviousCommit,
    clearCommitForm: commitForm.clearCommitForm,

    // View state
    mainView: view.mainView,
    viewMode: view.viewMode,
    setMainView: view.setMainView,
    setViewMode: view.setViewMode,

    // Statistics state
    statisticsContributorEmail: statistics.statisticsContributorEmail,
    setStatisticsContributorEmail: statistics.setStatisticsContributorEmail,

    // AI review state
    aiReview: aiReview.aiReview,
    aiReviewLoading: aiReview.aiReviewLoading,
    aiReviewError: aiReview.aiReviewError,
    setAIReview: aiReview.setAIReview,
    setAIReviewLoading: aiReview.setAIReviewLoading,
    setAIReviewError: aiReview.setAIReviewError,
    clearAIReview: aiReview.clearAIReview,

    // Panel visibility state
    showBranchesPanel: panels.showBranchesPanel,
    showFilesPanel: panels.showFilesPanel,
    showDiffPanel: panels.showDiffPanel,
    showStagingSidebar: panels.showStagingSidebar,
    showAIReviewPanel: panels.showAIReviewPanel,
    showWorktreesPanel: panels.showWorktreesPanel,
    showGraphPanel: panels.showGraphPanel,
    showMergeConflictPanel: panels.showMergeConflictPanel,
    syncPanels: panels.syncPanels,
    setShowBranchesPanel: panels.setShowBranchesPanel,
    toggleBranchesPanel: panels.toggleBranchesPanel,
    setShowFilesPanel: panels.setShowFilesPanel,
    setShowDiffPanel: panels.setShowDiffPanel,
    setShowStagingSidebar: panels.setShowStagingSidebar,
    toggleStagingSidebar: panels.toggleStagingSidebar,
    setShowAIReviewPanel: panels.setShowAIReviewPanel,
    setShowWorktreesPanel: panels.setShowWorktreesPanel,
    toggleWorktreesPanel: panels.toggleWorktreesPanel,
    setShowGraphPanel: panels.setShowGraphPanel,
    toggleGraphPanel: panels.toggleGraphPanel,
    setShowMergeConflictPanel: panels.setShowMergeConflictPanel,
    toggleMergeConflictPanel: panels.toggleMergeConflictPanel,

    // Dockview layout
    dockviewLayout,
    saveDockviewLayout,
  };
}

// Export utility for getting saved tab paths (used for restoration)
export function getSavedTabPaths() {
  return loadSavedTabs();
}

// Export createTabState for external use during restoration
export { createTabState };

// Export DEFAULT_PANELS for layout sync
export { DEFAULT_PANELS };
