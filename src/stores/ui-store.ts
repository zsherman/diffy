import { useCallback } from "react";
import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { produce } from "immer";
import type { DockviewApi } from "dockview-react";
import type { PanelId } from "../types/git";
import { tabsStore, type PanelVisibility } from "./tabs-store";

// Dockview API reference (stored outside of xstate store for direct access)
let dockviewApiRef: DockviewApi | null = null;

export function setDockviewApi(api: DockviewApi | null) {
  dockviewApiRef = api;
}

export function getDockviewApi(): DockviewApi | null {
  return dockviewApiRef;
}

type Theme = "pierre-dark" | "pierre-light";

// UIContext now only contains truly global/window-level state
interface UIContext {
  // Theme
  theme: Theme;

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

  // Developer/Performance settings
  perfTracingEnabled: boolean;
}

// Get initial theme from localStorage
function getInitialTheme(): Theme {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-theme");
    if (saved === "pierre-dark" || saved === "pierre-light") {
      return saved;
    }
  }
  return "pierre-dark";
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

// Get initial perf tracing setting from localStorage
function getInitialPerfTracingEnabled(): boolean {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("diffy-perf-tracing");
    return saved === "true";
  }
  return false;
}

// Non-reactive getter for perf tracing (used in trace functions outside React)
export function isPerfTracingEnabled(): boolean {
  return uiStore.getSnapshot().context.perfTracingEnabled;
}

// Toggle perf tracing (used by Command Palette)
export function togglePerfTracing(): void {
  const current = isPerfTracingEnabled();
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
    perfTracingEnabled: getInitialPerfTracingEnabled(),
  } as UIContext,
  on: {
    setTheme: (ctx, event: { theme: Theme }) =>
      produce(ctx, (draft) => {
        draft.theme = event.theme;
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-theme", event.theme);
        }
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
        draft.perfTracingEnabled = event.enabled;
        if (typeof window !== "undefined") {
          localStorage.setItem("diffy-perf-tracing", String(event.enabled));
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

// Wrapper hook - maintains backward compatible API but reads panel state from tabs-store
export function useUIStore() {
  // Global state from uiStore
  const theme = useSelector(uiStore, (s) => s.context.theme);
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
  const perfTracingEnabled = useSelector(
    uiStore,
    (s) => s.context.perfTracingEnabled,
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

  // Memoize all actions to prevent infinite loops when used in useEffect dependencies
  const setTheme = useCallback(
    (theme: Theme) => uiStore.send({ type: "setTheme", theme }),
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
    (enabled: boolean) => uiStore.send({ type: "setPerfTracingEnabled", enabled }),
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

  // Batch panel sync action
  const syncPanels = useCallback(
    (panels: Partial<PanelVisibility>) =>
      tabsStore.send({ type: "syncPanels", panels }),
    [],
  );

  return {
    // Global state
    theme,
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
    perfTracingEnabled,

    // Panel visibility (from tabs-store per-tab state)
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,

    // Global actions (memoized)
    setTheme,
    setActivePanel,
    setShowHelpOverlay,
    setShowCommandPalette,
    setShowSettingsDialog,
    setDiffViewMode,
    setDiffFontSize,
    setPanelFontSize,
    setGraphColumnWidths,
    setSelectedSkillIds,
    toggleSkillSelection,
    setShowSkillsDialog,
    clearSelectedSkills,
    setPerfTracingEnabled,

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
    syncPanels,
  };
}
