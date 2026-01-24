import { useCallback } from "react";
import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { produce } from "immer";
import type { DockviewApi } from "dockview-react";
import type { AIReviewReviewerId, PanelId } from "../types/git";
import { tabsStore, type PanelVisibility } from "./tabs-store";
import { type ThemeId, isValidThemeId, getDefaultTheme } from "../lib/themes";

// Dockview API reference (stored outside of xstate store for direct access)
let dockviewApiRef: DockviewApi | null = null;

export function setDockviewApi(api: DockviewApi | null) {
  dockviewApiRef = api;
}

export function getDockviewApi(): DockviewApi | null {
  return dockviewApiRef;
}

type Theme = ThemeId;
type AppView = "workspace" | "skills";

// Remote action types for fetch/pull operations
export type RemoteActionType = "fetch_all" | "pull_ff" | "pull_ff_only" | "pull_rebase";

export const REMOTE_ACTION_OPTIONS: { id: RemoteActionType; label: string }[] = [
  { id: "fetch_all", label: "Fetch All" },
  { id: "pull_ff", label: "Pull (fast-forward if possible)" },
  { id: "pull_ff_only", label: "Pull (fast-forward only)" },
  { id: "pull_rebase", label: "Pull (rebase)" },
];

// UIContext now only contains truly global/window-level state
interface UIContext {
  // Theme
  theme: Theme;

  // Global app-level view (workspace vs skills)
  appView: AppView;

  // Panel focus (window-level - which panel has keyboard focus)
  activePanel: PanelId;

  // Global dialogs
  showHelpOverlay: boolean;
  showCommandPalette: boolean;
  showSettingsDialog: boolean;
  showSkillsDialog: boolean;

  // Global preferences
  diffViewMode: "split" | "unified";
  diffFontSize: number;
  panelFontSize: number;
  graphColumnWidths: { branchTag: number; graph: number };

  // Skills (global selection)
  selectedSkillIds: string[];

  // AI Review
  aiReviewReviewerId: AIReviewReviewerId;

  // Developer/Performance settings
  perfTracingEnabled: boolean;

  // Git remote action default
  defaultRemoteAction: RemoteActionType;
}

// Get initial theme from localStorage
function getInitialTheme(): Theme {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-theme");
    if (saved && isValidThemeId(saved)) {
      return saved;
    }
  }
  return getDefaultTheme();
}

// Get initial selected skills from localStorage
function getInitialSelectedSkills(): string[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-selected-skills");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
  return [];
}

function getInitialAIReviewReviewerId(): AIReviewReviewerId {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-ai-reviewer");
    if (saved === "claude-cli" || saved === "coderabbit-cli") {
      return saved;
    }
  }
  return "claude-cli";
}

// Get initial perf tracing setting from localStorage
function getInitialPerfTracingEnabled(): boolean {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-perf-tracing");
    return saved === "true";
  }
  return false;
}

// Get initial remote action from localStorage
function getInitialDefaultRemoteAction(): RemoteActionType {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-default-remote-action");
    if (saved && REMOTE_ACTION_OPTIONS.some(opt => opt.id === saved)) {
      return saved as RemoteActionType;
    }
  }
  return "pull_ff"; // Default to "Pull (fast-forward if possible)"
}

// Non-reactive getter for perf tracing (used in trace functions outside React)
export function isPerfTracingEnabled(): boolean {
  const enabled = uiStore.getSnapshot().context.perfTracingEnabled;
  return enabled;
}

// Toggle perf tracing (used by Command Palette)
export function togglePerfTracing(): void {
  const current = isPerfTracingEnabled();
  console.log(
    `[DEBUG] togglePerfTracing: current=${current}, setting to ${!current}`,
  );
  uiStore.send({ type: "setPerfTracingEnabled", enabled: !current });
}

// React Scan localStorage helpers (separate from store since it must be checked before React loads)
const REACT_SCAN_KEY = "diffy-react-scan";

export function isReactScanEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REACT_SCAN_KEY) === "true";
}

export function setReactScanEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REACT_SCAN_KEY, String(enabled));
}

export function toggleReactScanAndReload(): void {
  const newValue = !isReactScanEnabled();
  setReactScanEnabled(newValue);
  window.location.reload();
}

export const uiStore = createStore({
  context: {
    theme: getInitialTheme(),
    appView: "workspace",
    activePanel: "commits",
    showHelpOverlay: false,
    showCommandPalette: false,
    showSettingsDialog: false,
    showSkillsDialog: false,
    diffViewMode: "unified",
    diffFontSize: 12,
    panelFontSize: 13,
    graphColumnWidths: { branchTag: 180, graph: 120 },
    selectedSkillIds: getInitialSelectedSkills(),
    aiReviewReviewerId: getInitialAIReviewReviewerId(),
    perfTracingEnabled: getInitialPerfTracingEnabled(),
    defaultRemoteAction: getInitialDefaultRemoteAction(),
  } as UIContext,
  on: {
    setTheme: (ctx, event: { theme: Theme }) =>
      produce(ctx, (draft) => {
        draft.theme = event.theme;
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-theme", event.theme);
        }
      }),
    setAppView: (ctx, event: { view: AppView }) =>
      produce(ctx, (draft) => {
        draft.appView = event.view;
      }),
    setActivePanel: (ctx, event: { panel: PanelId }) =>
      produce(ctx, (draft) => {
        draft.activePanel = event.panel;
      }),
    setShowHelpOverlay: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showHelpOverlay = event.show;
      }),
    setShowCommandPalette: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showCommandPalette = event.show;
      }),
    setShowSettingsDialog: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showSettingsDialog = event.show;
      }),
    setDiffViewMode: (ctx, event: { mode: "split" | "unified" }) =>
      produce(ctx, (draft) => {
        draft.diffViewMode = event.mode;
      }),
    setDiffFontSize: (ctx, event: { size: number }) =>
      produce(ctx, (draft) => {
        draft.diffFontSize = event.size;
      }),
    setPanelFontSize: (ctx, event: { size: number }) =>
      produce(ctx, (draft) => {
        draft.panelFontSize = event.size;
      }),
    setGraphColumnWidths: (
      ctx,
      event: { widths: { branchTag: number; graph: number } },
    ) =>
      produce(ctx, (draft) => {
        draft.graphColumnWidths = event.widths;
      }),
    setSelectedSkillIds: (ctx, event: { skillIds: string[] }) =>
      produce(ctx, (draft) => {
        draft.selectedSkillIds = event.skillIds;
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "diffy-selected-skills",
            JSON.stringify(event.skillIds),
          );
        }
      }),
    setAIReviewReviewerId: (ctx, event: { reviewerId: AIReviewReviewerId }) =>
      produce(ctx, (draft) => {
        draft.aiReviewReviewerId = event.reviewerId;
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-ai-reviewer", event.reviewerId);
        }
      }),
    toggleSkillSelection: (ctx, event: { skillId: string }) =>
      produce(ctx, (draft) => {
        const index = draft.selectedSkillIds.indexOf(event.skillId);
        if (index >= 0) {
          draft.selectedSkillIds.splice(index, 1);
        } else {
          draft.selectedSkillIds.push(event.skillId);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "diffy-selected-skills",
            JSON.stringify(draft.selectedSkillIds),
          );
        }
      }),
    setShowSkillsDialog: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showSkillsDialog = event.show;
      }),
    clearSelectedSkills: (ctx) =>
      produce(ctx, (draft) => {
        draft.selectedSkillIds = [];
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-selected-skills", JSON.stringify([]));
        }
      }),
    setPerfTracingEnabled: (ctx, event: { enabled: boolean }) =>
      produce(ctx, (draft) => {
        console.log(
          `[DEBUG] setPerfTracingEnabled action: setting to ${event.enabled}`,
        );
        draft.perfTracingEnabled = event.enabled;
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-perf-tracing", String(event.enabled));
          console.log(
            `[DEBUG] localStorage 'diffy-perf-tracing' set to: ${localStorage.getItem("diffy-perf-tracing")}`,
          );
        }
      }),
    setDefaultRemoteAction: (ctx, event: { action: RemoteActionType }) =>
      produce(ctx, (draft) => {
        draft.defaultRemoteAction = event.action;
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-default-remote-action", event.action);
        }
      }),
  },
});

// Helper to get active tab's panel state from tabsStore
function getActiveTabPanels(s: {
  context: {
    tabs: { repository: { path: string }; panels: PanelVisibility }[];
    activeTabPath: string | null;
  };
}) {
  const tab = s.context.tabs.find(
    (t) => t.repository.path === s.context.activeTabPath,
  );
  return (
    tab?.panels ?? {
      showBranchesPanel: false,
      showFilesPanel: true,
      showDiffPanel: true,
      showStagingSidebar: false,
      showAIReviewPanel: false,
      showWorktreesPanel: false,
      showGraphPanel: false,
      showMergeConflictPanel: false,
      showReflogPanel: false,
    }
  );
}

// Focused hook for just theme (used by DockviewLayout and other components that only need theme)
export function useTheme() {
  const theme = useSelector(uiStore, (s) => s.context.theme);
  const setTheme = useCallback(
    (t: Theme) => uiStore.send({ type: "setTheme", theme: t }),
    [],
  );
  return { theme, setTheme };
}

// Focused hook for app-level view (workspace vs skills)
export function useAppView() {
  const appView = useSelector(uiStore, (s) => s.context.appView);
  const setAppView = useCallback(
    (view: "workspace" | "skills") =>
      uiStore.send({ type: "setAppView", view }),
    [],
  );
  return { appView, setAppView };
}

// Focused hook for just activePanel (used by DockviewPanelWrapper)
// Avoids re-renders when unrelated UI state changes (theme, dialogs, preferences)
export function useActivePanel() {
  const activePanel = useSelector(uiStore, (s) => s.context.activePanel);
  const setActivePanel = useCallback(
    (panel: PanelId) => uiStore.send({ type: "setActivePanel", panel }),
    [],
  );
  return { activePanel, setActivePanel };
}

// Focused hook for diff view settings (used by DiffViewer, ConflictEditor, etc.)
// Combines all diff-related settings in a single hook with custom equality
export function useDiffSettings() {
  const settings = useSelector(
    uiStore,
    (s) => ({
      theme: s.context.theme,
      diffViewMode: s.context.diffViewMode,
      diffFontSize: s.context.diffFontSize,
    }),
    (a, b) =>
      a.theme === b.theme &&
      a.diffViewMode === b.diffViewMode &&
      a.diffFontSize === b.diffFontSize,
  );
  const setDiffViewMode = useCallback(
    (mode: "split" | "unified") =>
      uiStore.send({ type: "setDiffViewMode", mode }),
    [],
  );
  const setDiffFontSize = useCallback(
    (size: number) => uiStore.send({ type: "setDiffFontSize", size }),
    [],
  );
  return { ...settings, setDiffViewMode, setDiffFontSize };
}

// Focused hook for just panel font size (used by list components)
export function usePanelFontSize() {
  return useSelector(uiStore, (s) => s.context.panelFontSize);
}

// Focused hook for skills selection (used by AIReviewContent, SkillSelector)
export function useSkillsSelection() {
  const selectedSkillIds = useSelector(
    uiStore,
    (s) => s.context.selectedSkillIds,
  );
  const setSelectedSkillIds = useCallback(
    (skillIds: string[]) =>
      uiStore.send({ type: "setSelectedSkillIds", skillIds }),
    [],
  );
  const toggleSkillSelection = useCallback(
    (skillId: string) =>
      uiStore.send({ type: "toggleSkillSelection", skillId }),
    [],
  );
  const clearSelectedSkills = useCallback(
    () => uiStore.send({ type: "clearSelectedSkills" }),
    [],
  );
  return {
    selectedSkillIds,
    setSelectedSkillIds,
    toggleSkillSelection,
    clearSelectedSkills,
  };
}

// Focused hook for graph column widths (used by GraphTableView)
export function useGraphColumnWidths() {
  const graphColumnWidths = useSelector(
    uiStore,
    (s) => s.context.graphColumnWidths,
    (a, b) => a.branchTag === b.branchTag && a.graph === b.graph,
  );
  const setGraphColumnWidths = useCallback(
    (widths: { branchTag: number; graph: number }) =>
      uiStore.send({ type: "setGraphColumnWidths", widths }),
    [],
  );
  return { graphColumnWidths, setGraphColumnWidths };
}

// Focused hook for default remote action (used by RepoHeader)
export function useDefaultRemoteAction() {
  const defaultRemoteAction = useSelector(
    uiStore,
    (s) => s.context.defaultRemoteAction,
  );
  const setDefaultRemoteAction = useCallback(
    (action: RemoteActionType) =>
      uiStore.send({ type: "setDefaultRemoteAction", action }),
    [],
  );
  return { defaultRemoteAction, setDefaultRemoteAction };
}

// Focused hook for dialogs (used by CommandPalette, SettingsDialog, etc.)
export function useDialogs() {
  const showHelpOverlay = useSelector(
    uiStore,
    (s) => s.context.showHelpOverlay,
  );
  const showCommandPalette = useSelector(
    uiStore,
    (s) => s.context.showCommandPalette,
  );
  const showSettingsDialog = useSelector(
    uiStore,
    (s) => s.context.showSettingsDialog,
  );
  const showSkillsDialog = useSelector(
    uiStore,
    (s) => s.context.showSkillsDialog,
  );
  const setShowHelpOverlay = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowHelpOverlay", show }),
    [],
  );
  const setShowCommandPalette = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowCommandPalette", show }),
    [],
  );
  const setShowSettingsDialog = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowSettingsDialog", show }),
    [],
  );
  const setShowSkillsDialog = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowSkillsDialog", show }),
    [],
  );
  return {
    showHelpOverlay,
    showCommandPalette,
    showSettingsDialog,
    showSkillsDialog,
    setShowHelpOverlay,
    setShowCommandPalette,
    setShowSettingsDialog,
    setShowSkillsDialog,
  };
}

// Wrapper hook - maintains backward compatible API but reads panel state from tabs-store
export function useUIStore() {
  // Global state from uiStore
  const theme = useSelector(uiStore, (s) => s.context.theme);
  const appView = useSelector(uiStore, (s) => s.context.appView);
  const activePanel = useSelector(uiStore, (s) => s.context.activePanel);
  const showHelpOverlay = useSelector(
    uiStore,
    (s) => s.context.showHelpOverlay,
  );
  const showCommandPalette = useSelector(
    uiStore,
    (s) => s.context.showCommandPalette,
  );
  const showSettingsDialog = useSelector(
    uiStore,
    (s) => s.context.showSettingsDialog,
  );
  const showSkillsDialog = useSelector(
    uiStore,
    (s) => s.context.showSkillsDialog,
  );
  const diffViewMode = useSelector(uiStore, (s) => s.context.diffViewMode);
  const diffFontSize = useSelector(uiStore, (s) => s.context.diffFontSize);
  const panelFontSize = useSelector(uiStore, (s) => s.context.panelFontSize);
  const graphColumnWidths = useSelector(
    uiStore,
    (s) => s.context.graphColumnWidths,
  );
  const selectedSkillIds = useSelector(
    uiStore,
    (s) => s.context.selectedSkillIds,
  );
  const aiReviewReviewerId = useSelector(
    uiStore,
    (s) => s.context.aiReviewReviewerId,
  );
  const perfTracingEnabled = useSelector(
    uiStore,
    (s) => s.context.perfTracingEnabled,
  );
  const defaultRemoteAction = useSelector(
    uiStore,
    (s) => s.context.defaultRemoteAction,
  );

  // Panel visibility from tabsStore (per-tab state)
  const showBranchesPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showBranchesPanel,
  );
  const showFilesPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showFilesPanel,
  );
  const showDiffPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showDiffPanel,
  );
  const showStagingSidebar = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showStagingSidebar,
  );
  const showAIReviewPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showAIReviewPanel,
  );
  const showWorktreesPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showWorktreesPanel,
  );
  const showGraphPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showGraphPanel,
  );
  const showMergeConflictPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showMergeConflictPanel,
  );
  const showReflogPanel = useSelector(
    tabsStore,
    (s) => getActiveTabPanels(s).showReflogPanel,
  );

  // Memoize all actions to prevent infinite loops when used in useEffect dependencies
  const setTheme = useCallback(
    (theme: Theme) => uiStore.send({ type: "setTheme", theme }),
    [],
  );
  const setAppView = useCallback(
    (view: "workspace" | "skills") =>
      uiStore.send({ type: "setAppView", view }),
    [],
  );
  const setActivePanel = useCallback(
    (panel: PanelId) => uiStore.send({ type: "setActivePanel", panel }),
    [],
  );
  const setShowHelpOverlay = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowHelpOverlay", show }),
    [],
  );
  const setShowCommandPalette = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowCommandPalette", show }),
    [],
  );
  const setShowSettingsDialog = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowSettingsDialog", show }),
    [],
  );
  const setDiffViewMode = useCallback(
    (mode: "split" | "unified") =>
      uiStore.send({ type: "setDiffViewMode", mode }),
    [],
  );
  const setDiffFontSize = useCallback(
    (size: number) => uiStore.send({ type: "setDiffFontSize", size }),
    [],
  );
  const setPanelFontSize = useCallback(
    (size: number) => uiStore.send({ type: "setPanelFontSize", size }),
    [],
  );
  const setGraphColumnWidths = useCallback(
    (widths: { branchTag: number; graph: number }) =>
      uiStore.send({ type: "setGraphColumnWidths", widths }),
    [],
  );
  const setSelectedSkillIds = useCallback(
    (skillIds: string[]) =>
      uiStore.send({ type: "setSelectedSkillIds", skillIds }),
    [],
  );
  const setAIReviewReviewerId = useCallback(
    (reviewerId: AIReviewReviewerId) =>
      uiStore.send({ type: "setAIReviewReviewerId", reviewerId }),
    [],
  );
  const toggleSkillSelection = useCallback(
    (skillId: string) =>
      uiStore.send({ type: "toggleSkillSelection", skillId }),
    [],
  );
  const setShowSkillsDialog = useCallback(
    (show: boolean) => uiStore.send({ type: "setShowSkillsDialog", show }),
    [],
  );
  const clearSelectedSkills = useCallback(
    () => uiStore.send({ type: "clearSelectedSkills" }),
    [],
  );
  const setPerfTracingEnabled = useCallback(
    (enabled: boolean) =>
      uiStore.send({ type: "setPerfTracingEnabled", enabled }),
    [],
  );
  const setDefaultRemoteAction = useCallback(
    (action: RemoteActionType) =>
      uiStore.send({ type: "setDefaultRemoteAction", action }),
    [],
  );

  // Panel visibility actions delegate to tabsStore (for backward compatibility)
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
  const setShowReflogPanel = useCallback(
    (show: boolean) => tabsStore.send({ type: "setShowReflogPanel", show }),
    [],
  );
  const toggleReflogPanel = useCallback(
    () => tabsStore.send({ type: "toggleReflogPanel" }),
    [],
  );

  // Batch panel sync action
  const syncPanels = useCallback(
    (panels: Partial<PanelVisibility>) =>
      tabsStore.send({ type: "syncPanels", panels }),
    [],
  );

  return {
    // Global state
    theme,
    appView,
    activePanel,
    showHelpOverlay,
    showCommandPalette,
    showSettingsDialog,
    showSkillsDialog,
    diffViewMode,
    diffFontSize,
    panelFontSize,
    graphColumnWidths,
    selectedSkillIds,
    aiReviewReviewerId,
    perfTracingEnabled,
    defaultRemoteAction,

    // Panel visibility (from tabs-store per-tab state)
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,
    showReflogPanel,

    // Global actions (memoized)
    setTheme,
    setAppView,
    setActivePanel,
    setShowHelpOverlay,
    setShowCommandPalette,
    setShowSettingsDialog,
    setDiffViewMode,
    setDiffFontSize,
    setPanelFontSize,
    setGraphColumnWidths,
    setSelectedSkillIds,
    setAIReviewReviewerId,
    toggleSkillSelection,
    setShowSkillsDialog,
    clearSelectedSkills,
    setPerfTracingEnabled,
    setDefaultRemoteAction,

    // Panel visibility actions (delegated to tabs-store, memoized)
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
    setShowReflogPanel,
    toggleReflogPanel,
    syncPanels,
  };
}
