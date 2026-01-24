import { useCallback, useEffect, useRef, memo } from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type SerializedDockview,
  type IDisposable,
} from "dockview-react";
import {
  useTheme,
  setDockviewApi,
  isPerfTracingEnabled,
} from "../../stores/ui-store";
import { isLightTheme } from "../../lib/themes";
import {
  useActiveTabPath,
  useActiveTabPanels,
  tabsStore,
  type PanelVisibility,
} from "../../stores/tabs-store";
import { layoutPresets } from "../../lib/layouts";
import {
  BranchesPanel,
  CommitsPanel,
  FilesPanel,
  FileTreePanel,
  DiffPanel,
  StagingPanel,
  AIReviewPanel,
  WorktreesPanel,
  GraphPanel,
  MergeConflictPanel,
  ReflogPanel,
  MermaidChangesPanel,
  CodeFlowPanel,
} from "./panels";
import { DockviewHeaderActions } from "./DockviewHeaderActions";
import { DockviewTab } from "./DockviewTab";

// Per-repo layout storage key prefix
export const LAYOUT_STORAGE_PREFIX = "diffy-dockview-layout:";

// Encode repo path for use as localStorage key
export function encodeRepoPath(path: string): string {
  return btoa(path).replace(
    /[+/=]/g,
    (c) => ({ "+": "-", "/": "_", "=": "" })[c] ?? c,
  );
}

// Clear all saved layouts for all repos
export function clearAllSavedLayouts() {
  const keysToRemove = Object.keys(localStorage).filter((k) =>
    k.startsWith(LAYOUT_STORAGE_PREFIX),
  );
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

const components = {
  branches: BranchesPanel,
  commits: CommitsPanel,
  files: FilesPanel,
  "file-tree": FileTreePanel,
  diff: DiffPanel,
  staging: StagingPanel,
  "ai-review": AIReviewPanel,
  worktrees: WorktreesPanel,
  graph: GraphPanel,
  "merge-conflict": MergeConflictPanel,
  reflog: ReflogPanel,
  "mermaid-changes": MermaidChangesPanel,
  codeflow: CodeFlowPanel,
};

// Apply a layout preset by ID (without triggering store sync - that's handled separately)
function applyLayoutPreset(api: DockviewApi, presetId: string) {
  const preset = layoutPresets.find((p) => p.id === presetId);
  if (preset) {
    trace(`applyLayoutPreset(${presetId})`, () => {
      preset.apply(api);
    });
  }
}

function createDefaultLayout(api: DockviewApi) {
  // Create three columns: commits | files | diff
  const commitsPanel = api.addPanel({
    id: "commits",
    component: "commits",
    title: "Commits",
    minimumWidth: 300,
  });

  const filesPanel = api.addPanel({
    id: "files",
    component: "files",
    title: "Files",
    position: { referencePanel: commitsPanel, direction: "right" },
    minimumWidth: 300,
  });

  api.addPanel({
    id: "diff",
    component: "diff",
    title: "Diff",
    position: { referencePanel: filesPanel, direction: "right" },
    minimumWidth: 300,
  });

  // Set initial sizes: 25% commits | 25% files | 50% diff
  const groups = api.groups;
  if (groups.length >= 3) {
    groups[0].api.setSize({ width: 300 });
    groups[1].api.setSize({ width: 300 });
    groups[2].api.setSize({ width: 600 });
  }
}

// Save layout for a specific repo path
function saveLayoutForRepo(api: DockviewApi, repoPath: string) {
  trace("saveLayoutForRepo", () => {
    try {
      const layout = api.toJSON();
      // Ensure locked is false for all groups when saving
      if (layout.grid?.root) {
        const unlockGroups = (node: unknown) => {
          if (node && typeof node === "object") {
            const n = node as Record<string, unknown>;
            if (n.type === "branch" && Array.isArray(n.data)) {
              n.data.forEach(unlockGroups);
            } else if (
              n.type === "leaf" &&
              n.data &&
              typeof n.data === "object"
            ) {
              (n.data as Record<string, unknown>).locked = false;
            }
          }
        };
        unlockGroups(layout.grid.root);
      }
      const key = LAYOUT_STORAGE_PREFIX + encodeRepoPath(repoPath);
      localStorage.setItem(key, JSON.stringify(layout));
    } catch (e) {
      console.warn("Failed to save layout:", e);
    }
  });
}

// Load layout for a specific repo path
function loadLayoutForRepo(repoPath: string): SerializedDockview | null {
  let result: SerializedDockview | null = null;
  trace("loadLayoutForRepo", () => {
    try {
      const key = LAYOUT_STORAGE_PREFIX + encodeRepoPath(repoPath);
      const saved = localStorage.getItem(key);
      if (saved) {
        result = JSON.parse(saved) as SerializedDockview;
      }
    } catch (e) {
      console.warn("Failed to load layout:", e);
    }
  });
  return result;
}

// Transaction counter to suppress panel removal syncing during layout application
let layoutTransactionDepth = 0;

// Performance tracing - uses runtime flag from ui-store
let renderCount = 0;
let effectCount = 0;

function trace(label: string, fn: () => void): void {
  if (!isPerfTracingEnabled()) {
    fn();
    return;
  }
  const start = performance.now();
  fn();
  const elapsed = performance.now() - start;
  console.log(`[perf] ${label}: ${elapsed.toFixed(2)}ms`);
}

function traceStart(label: string): () => void {
  if (!isPerfTracingEnabled()) return () => {};
  const start = performance.now();
  console.log(`[perf] ${label} started`);
  return () => {
    const elapsed = performance.now() - start;
    console.log(`[perf] ${label} completed: ${elapsed.toFixed(2)}ms`);
  };
}

// Use requestAnimationFrame to measure time until next paint
function traceUntilPaint(label: string): void {
  if (!isPerfTracingEnabled()) return;
  const start = performance.now();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const elapsed = performance.now() - start;
      console.log(`[perf] ${label} -> paint: ${elapsed.toFixed(2)}ms`);
    });
  });
}

export function setApplyingLayoutPreset(value: boolean) {
  if (value) {
    layoutTransactionDepth++;
  } else {
    layoutTransactionDepth = Math.max(0, layoutTransactionDepth - 1);
  }
}

function isInLayoutTransaction() {
  return layoutTransactionDepth > 0;
}

// Sync panel visibility from dockview to store (batched)
// Returns the panel state for updating lastReconcileRef
function syncPanelsFromDockview(api: DockviewApi): PanelVisibility {
  const panels: PanelVisibility = {
    showCommitsPanel: api.getPanel("commits") !== undefined,
    showBranchesPanel: api.getPanel("branches") !== undefined,
    showFilesPanel: api.getPanel("files") !== undefined,
    showFileTreePanel: api.getPanel("file-tree") !== undefined,
    showDiffPanel: api.getPanel("diff") !== undefined,
    showAIReviewPanel: api.getPanel("ai-review") !== undefined,
    showGraphPanel: api.getPanel("graph") !== undefined,
    showMergeConflictPanel: api.getPanel("merge-conflict") !== undefined,
    showStagingSidebar: api.getPanel("staging") !== undefined,
    showWorktreesPanel: api.getPanel("worktrees") !== undefined,
    showReflogPanel: api.getPanel("reflog") !== undefined,
    showMermaidChangesPanel: api.getPanel("mermaid-changes") !== undefined,
    showCodeFlowPanel: api.getPanel("codeflow") !== undefined,
  };
  trace("syncPanelsFromDockview", () => {
    tabsStore.send({ type: "syncPanels", panels });
  });
  return panels;
}

// Reconcile desired panel state with actual dockview panels
function reconcilePanels(api: DockviewApi, desired: PanelVisibility) {
  // Panel configs with their add positions
  const panelConfigs: Array<{
    id: string;
    component: string;
    title: string;
    showKey: keyof PanelVisibility;
    getPosition: () =>
      | {
          referencePanel?: ReturnType<DockviewApi["getPanel"]>;
          direction: string;
        }
      | { direction: string };
  }> = [
    {
      id: "commits",
      component: "commits",
      title: "Commits",
      showKey: "showCommitsPanel",
      getPosition: () => {
        const files = api.getPanel("files");
        const diff = api.getPanel("diff");
        if (files) return { referencePanel: files, direction: "left" };
        if (diff) return { referencePanel: diff, direction: "left" };
        return { direction: "left" };
      },
    },
    {
      id: "branches",
      component: "branches",
      title: "Branches",
      showKey: "showBranchesPanel",
      getPosition: () => {
        const commits = api.getPanel("commits");
        return commits
          ? { referencePanel: commits, direction: "left" }
          : { direction: "left" };
      },
    },
    {
      id: "files",
      component: "files",
      title: "Files",
      showKey: "showFilesPanel",
      getPosition: () => {
        const diff = api.getPanel("diff");
        const commits = api.getPanel("commits");
        if (diff) return { referencePanel: diff, direction: "above" };
        if (commits) return { referencePanel: commits, direction: "right" };
        return { direction: "right" };
      },
    },
    {
      id: "file-tree",
      component: "file-tree",
      title: "File Tree",
      showKey: "showFileTreePanel",
      getPosition: () => {
        const files = api.getPanel("files");
        const diff = api.getPanel("diff");
        const commits = api.getPanel("commits");
        if (files) return { referencePanel: files, direction: "within" };
        if (diff) return { referencePanel: diff, direction: "above" };
        if (commits) return { referencePanel: commits, direction: "right" };
        return { direction: "right" };
      },
    },
    {
      id: "diff",
      component: "diff",
      title: "Diff",
      showKey: "showDiffPanel",
      getPosition: () => {
        const files = api.getPanel("files");
        const commits = api.getPanel("commits");
        if (files) return { referencePanel: files, direction: "below" };
        if (commits) return { referencePanel: commits, direction: "right" };
        return { direction: "right" };
      },
    },
    {
      id: "staging",
      component: "staging",
      title: "Local Changes",
      showKey: "showStagingSidebar",
      getPosition: () => ({ direction: "right" }),
    },
    {
      id: "ai-review",
      component: "ai-review",
      title: "AI Review",
      showKey: "showAIReviewPanel",
      getPosition: () => {
        const diff = api.getPanel("diff");
        return diff
          ? { referencePanel: diff, direction: "right" }
          : { direction: "right" };
      },
    },
    {
      id: "worktrees",
      component: "worktrees",
      title: "Worktrees",
      showKey: "showWorktreesPanel",
      getPosition: () => {
        const branches = api.getPanel("branches");
        const commits = api.getPanel("commits");
        if (branches) return { referencePanel: branches, direction: "below" };
        if (commits) return { referencePanel: commits, direction: "left" };
        return { direction: "left" };
      },
    },
    {
      id: "graph",
      component: "graph",
      title: "Graph",
      showKey: "showGraphPanel",
      getPosition: () => {
        const commits = api.getPanel("commits");
        return commits
          ? { referencePanel: commits, direction: "within" }
          : { direction: "left" };
      },
    },
    {
      id: "merge-conflict",
      component: "merge-conflict",
      title: "Merge Conflicts",
      showKey: "showMergeConflictPanel",
      getPosition: () => {
        const diff = api.getPanel("diff");
        return diff
          ? { referencePanel: diff, direction: "within" }
          : { direction: "right" };
      },
    },
    {
      id: "reflog",
      component: "reflog",
      title: "Reflog",
      showKey: "showReflogPanel",
      getPosition: () => {
        const commits = api.getPanel("commits");
        return commits
          ? { referencePanel: commits, direction: "within" }
          : { direction: "left" };
      },
    },
    {
      id: "mermaid-changes",
      component: "mermaid-changes",
      title: "Changes Diagram",
      showKey: "showMermaidChangesPanel",
      getPosition: () => {
        const diff = api.getPanel("diff");
        const staging = api.getPanel("staging");
        if (staging) return { referencePanel: staging, direction: "within" };
        if (diff) return { referencePanel: diff, direction: "right" };
        return { direction: "right" };
      },
    },
    {
      id: "codeflow",
      component: "codeflow",
      title: "Code Flow",
      showKey: "showCodeFlowPanel",
      getPosition: () => {
        const diff = api.getPanel("diff");
        const mermaid = api.getPanel("mermaid-changes");
        if (mermaid) return { referencePanel: mermaid, direction: "within" };
        if (diff) return { referencePanel: diff, direction: "right" };
        return { direction: "right" };
      },
    },
  ];

  // Reconcile each panel
  trace("reconcilePanels", () => {
    for (const config of panelConfigs) {
      const exists = api.getPanel(config.id) !== undefined;
      const shouldExist = desired[config.showKey];

      if (shouldExist && !exists) {
        // Add panel
        trace(`  addPanel(${config.id})`, () => {
          api.addPanel({
            id: config.id,
            component: config.component,
            title: config.title,
            position: config.getPosition() as Parameters<
              DockviewApi["addPanel"]
            >[0]["position"],
          });
        });
      } else if (!shouldExist && exists) {
        // Remove panel
        trace(`  removePanel(${config.id})`, () => {
          const panel = api.getPanel(config.id);
          if (panel) {
            api.removePanel(panel);
          }
        });
      }
    }
  });
}

// Track previous values to detect what changed
let prevTheme: string | null = null;
let prevActiveTabPath: string | null = null;
let prevPanels: string | null = null;

export const DockviewLayout = memo(function DockviewLayout() {
  // Use focused hooks to minimize subscriptions and re-renders
  const { theme } = useTheme();
  const activeTabPath = useActiveTabPath();
  // Use focused hook for panel state only - avoids subscribing to unrelated state
  const {
    showCommitsPanel,
    showBranchesPanel,
    showFilesPanel,
    showFileTreePanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,
    showReflogPanel,
    showMermaidChangesPanel,
    showCodeFlowPanel,
  } = useActiveTabPanels();

  // Track renders with change detection (only when perf tracing enabled)
  const perfEnabled = isPerfTracingEnabled();
  if (perfEnabled) {
    renderCount++;
    const panelsKey = `${showBranchesPanel}-${showFilesPanel}-${showFileTreePanel}-${showDiffPanel}-${showStagingSidebar}-${showAIReviewPanel}-${showWorktreesPanel}-${showGraphPanel}-${showMergeConflictPanel}-${showReflogPanel}-${showMermaidChangesPanel}-${showCodeFlowPanel}`;
    const changes: string[] = [];
    if (prevTheme !== theme) changes.push(`theme: ${prevTheme} -> ${theme}`);
    if (prevActiveTabPath !== activeTabPath)
      changes.push(
        `path: ${prevActiveTabPath?.slice(-20)} -> ${activeTabPath?.slice(-20)}`,
      );
    if (prevPanels !== panelsKey) changes.push(`panels changed`);

    console.log(
      `[perf] DockviewLayout render #${renderCount}${changes.length ? ` (${changes.join(", ")})` : " (no prop change - parent render?)"}`,
    );

    prevTheme = theme;
    prevActiveTabPath = activeTabPath;
    prevPanels = panelsKey;
  }

  const apiRef = useRef<DockviewApi | null>(null);
  const isInitializedRef = useRef(false);
  const currentRepoPathRef = useRef<string | null>(null);
  const lastReconcileRef = useRef<PanelVisibility | null>(null);
  const pendingTabPathRef = useRef<string | null>(null); // Track pending tab switch during initialization
  const skipNextReconcileRef = useRef(false); // Skip reconcile once after tab switch

  // Store disposables in refs so we can clean them up on unmount
  const disposablesRef = useRef<IDisposable[]>([]);

  // Global keyboard shortcut: Ctrl+Shift+L to reset layout
  // Using useEffect to prevent duplicate listeners during HMR
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        clearAllSavedLayouts();
        window.location.reload();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cleanup effect - runs on unmount to dispose listeners and clear API ref
  useEffect(() => {
    return () => {
      if (isPerfTracingEnabled()) {
        console.log("[perf] DockviewLayout unmounting, cleaning up");
      }
      // Dispose all Dockview event listeners
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
      // Clear the global API reference
      setDockviewApi(null);
      apiRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);

  // Store panel visibility in ref for reconciliation comparison
  const desiredPanels: PanelVisibility = {
    showCommitsPanel,
    showBranchesPanel,
    showFilesPanel,
    showFileTreePanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,
    showReflogPanel,
    showMermaidChangesPanel,
    showCodeFlowPanel,
  };

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api;
    apiRef.current = api;
    setDockviewApi(api);

    // Listen for layout changes to persist for current repo
    const layoutDisposable = api.onDidLayoutChange(() => {
      if (currentRepoPathRef.current && !isInLayoutTransaction()) {
        saveLayoutForRepo(api, currentRepoPathRef.current);
      }
    });

    // Listen for panel removal to sync state (skip during layout transactions)
    const removeDisposable = api.onDidRemovePanel(() => {
      if (!isInLayoutTransaction()) {
        syncPanelsFromDockview(api);
      }
    });

    // Listen for panel addition to sync state (skip during layout transactions)
    const addDisposable = api.onDidAddPanel(() => {
      if (!isInLayoutTransaction()) {
        syncPanelsFromDockview(api);
      }
    });

    // Store disposables in ref for cleanup on unmount
    // (onReady return value is NOT consumed by DockviewReact)
    disposablesRef.current = [
      layoutDisposable,
      removeDisposable,
      addDisposable,
    ];

    isInitializedRef.current = true;

    // Check if there's a pending tab that needs layout loaded
    // This handles the case where activeTabPath was set before dockview was ready
    const pendingPath = pendingTabPathRef.current;
    if (pendingPath) {
      if (isPerfTracingEnabled())
        console.log(
          "[perf] onReady: Loading pending tab layout for",
          pendingPath,
        );
      pendingTabPathRef.current = null;
      currentRepoPathRef.current = pendingPath;

      const savedLayout = loadLayoutForRepo(pendingPath);
      setApplyingLayoutPreset(true);
      let syncedPanels: PanelVisibility;
      try {
        if (savedLayout) {
          try {
            trace("onReady api.fromJSON", () => api.fromJSON(savedLayout));
            api.groups.forEach((g) => {
              g.locked = false;
            });
            syncedPanels = syncPanelsFromDockview(api);
          } catch (e) {
            console.warn(
              "Failed to restore layout in onReady, creating default:",
              e,
            );
            createDefaultLayout(api);
            syncedPanels = syncPanelsFromDockview(api);
          }
        } else {
          createDefaultLayout(api);
          syncedPanels = syncPanelsFromDockview(api);
        }
        api.groups.forEach((g) => {
          g.locked = false;
        });
        // Update lastReconcileRef to prevent reconcile effect from fighting
        lastReconcileRef.current = syncedPanels;
      } finally {
        setTimeout(() => setApplyingLayoutPreset(false), 100);
      }
    } else {
      // No pending tab - this is a fresh mount (e.g., switching from Statistics view)
      // Check the current active tab path and mainView to determine what to show
      const ctx = tabsStore.getSnapshot().context;
      if (ctx.activeTabPath) {
        if (isPerfTracingEnabled())
          console.log(
            "[perf] onReady: Fresh mount, applying layout for mainView",
          );
        currentRepoPathRef.current = ctx.activeTabPath;

        setApplyingLayoutPreset(true);
        let syncedPanels: PanelVisibility;
        try {
          // First try to load saved layout
          const savedLayout = loadLayoutForRepo(ctx.activeTabPath);
          if (savedLayout) {
            try {
              trace("onReady (fresh) api.fromJSON", () =>
                api.fromJSON(savedLayout),
              );
              api.groups.forEach((g) => {
                g.locked = false;
              });
              syncedPanels = syncPanelsFromDockview(api);
            } catch (e) {
              console.warn(
                "Failed to restore layout in onReady (fresh), creating default:",
                e,
              );
              // Apply standard layout as default
              applyLayoutPreset(api, "standard");
              syncedPanels = syncPanelsFromDockview(api);
            }
          } else {
            // No saved layout - apply standard layout
            applyLayoutPreset(api, "standard");
            syncedPanels = syncPanelsFromDockview(api);
          }
          api.groups.forEach((g) => {
            g.locked = false;
          });
          // Update lastReconcileRef to prevent reconcile effect from fighting
          lastReconcileRef.current = syncedPanels;
        } finally {
          setTimeout(() => setApplyingLayoutPreset(false), 100);
        }
      }
    }
  }, []);

  // Handle tab switches - FAST PATH: don't rebuild panels, just update context
  // Panel content components (CommitList, FileList, etc.) react to activeTabPath changes
  // via useTabsStore()/useActiveRepository() hooks, so we don't need to tear down and rebuild.
  useEffect(() => {
    const api = apiRef.current;

    // If API isn't ready yet, store the pending path for onReady to handle
    if (!api || !isInitializedRef.current) {
      if (activeTabPath && activeTabPath !== pendingTabPathRef.current) {
        if (isPerfTracingEnabled())
          console.log(
            "[perf] Tab Switch Effect: API not ready, queuing",
            activeTabPath,
          );
        pendingTabPathRef.current = activeTabPath;
      }
      return;
    }

    // Check if repo actually changed
    if (currentRepoPathRef.current === activeTabPath) return;

    const endTrace = traceStart("Tab Switch Effect (fast)");
    traceUntilPaint("Tab Switch");

    // Save current layout in idle time (non-blocking)
    // Use requestIdleCallback if available (Chrome), otherwise setTimeout (Safari/WebKit)
    if (currentRepoPathRef.current) {
      const repoToSave = currentRepoPathRef.current;
      const saveLayout = () => {
        if (apiRef.current) {
          saveLayoutForRepo(apiRef.current, repoToSave);
        }
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(saveLayout, { timeout: 2000 });
      } else {
        setTimeout(saveLayout, 100);
      }
    }

    // Update current repo reference
    currentRepoPathRef.current = activeTabPath;

    if (!activeTabPath) {
      endTrace();
      return;
    }

    // FAST PATH: Don't clear panels or call fromJSON!
    // Panel content components will automatically update because they use
    // useTabsStore()/useActiveRepository() hooks that react to activeTabPath.
    
    // IMPORTANT: Sync lastReconcileRef with CURRENT Dockview state, not desired state.
    // This prevents the reconciliation effect from adding/removing panels based on
    // per-tab visibility. Panels stay as-is; only explicit user toggles will change them.
    lastReconcileRef.current = syncPanelsFromDockview(api);
    
    // Also sync the new tab's panel visibility state to match current Dockview state.
    // This ensures the tabs-store reflects reality (what panels are actually visible).
    // When user explicitly toggles a panel, that will create a delta that reconcile handles.

    // Skip the next reconcile effect - the syncPanels call above may cause a re-render
    // with new desiredPanels that differs from lastReconcileRef. We want to ignore that.
    skipNextReconcileRef.current = true;

    endTrace();
  }, [activeTabPath]);

  // Single reconciliation effect for panel visibility changes
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isInitializedRef.current || !activeTabPath) {
      if (isPerfTracingEnabled())
        console.log("[perf] Reconcile Effect skipped (not initialized)");
      return;
    }

    // Skip during layout transactions to prevent feedback loops
    if (isInLayoutTransaction()) {
      if (isPerfTracingEnabled())
        console.log("[perf] Reconcile Effect skipped (in transaction)");
      return;
    }

    // Skip once after tab switch - the tab switch effect already synced lastReconcileRef
    // and we don't want to reconcile based on the new tab's stored panel visibility.
    if (skipNextReconcileRef.current) {
      if (isPerfTracingEnabled())
        console.log("[perf] Reconcile Effect skipped (skipNextReconcile flag)");
      skipNextReconcileRef.current = false;
      // Update lastReconcileRef to match current desired state so future explicit toggles work
      lastReconcileRef.current = { ...desiredPanels };
      return;
    }

    // Skip if this is the same state (prevents double reconcile after tab switch)
    const lastPanels = lastReconcileRef.current;
    if (
      lastPanels &&
      lastPanels.showCommitsPanel === desiredPanels.showCommitsPanel &&
      lastPanels.showBranchesPanel === desiredPanels.showBranchesPanel &&
      lastPanels.showFilesPanel === desiredPanels.showFilesPanel &&
      lastPanels.showFileTreePanel === desiredPanels.showFileTreePanel &&
      lastPanels.showDiffPanel === desiredPanels.showDiffPanel &&
      lastPanels.showStagingSidebar === desiredPanels.showStagingSidebar &&
      lastPanels.showAIReviewPanel === desiredPanels.showAIReviewPanel &&
      lastPanels.showWorktreesPanel === desiredPanels.showWorktreesPanel &&
      lastPanels.showGraphPanel === desiredPanels.showGraphPanel &&
      lastPanels.showMergeConflictPanel === desiredPanels.showMergeConflictPanel &&
      lastPanels.showReflogPanel === desiredPanels.showReflogPanel &&
      lastPanels.showMermaidChangesPanel === desiredPanels.showMermaidChangesPanel &&
      lastPanels.showCodeFlowPanel === desiredPanels.showCodeFlowPanel
    ) {
      if (isPerfTracingEnabled())
        console.log("[perf] Reconcile Effect skipped (no change)");
      return;
    }

    // Log what changed
    if (isPerfTracingEnabled() && lastPanels) {
      const changes: string[] = [];
      if (lastPanels.showCommitsPanel !== desiredPanels.showCommitsPanel)
        changes.push(
          `commits: ${lastPanels.showCommitsPanel} -> ${desiredPanels.showCommitsPanel}`,
        );
      if (lastPanels.showBranchesPanel !== desiredPanels.showBranchesPanel)
        changes.push(
          `branches: ${lastPanels.showBranchesPanel} -> ${desiredPanels.showBranchesPanel}`,
        );
      if (lastPanels.showFilesPanel !== desiredPanels.showFilesPanel)
        changes.push(
          `files: ${lastPanels.showFilesPanel} -> ${desiredPanels.showFilesPanel}`,
        );
      if (lastPanels.showFileTreePanel !== desiredPanels.showFileTreePanel)
        changes.push(
          `fileTree: ${lastPanels.showFileTreePanel} -> ${desiredPanels.showFileTreePanel}`,
        );
      if (lastPanels.showDiffPanel !== desiredPanels.showDiffPanel)
        changes.push(
          `diff: ${lastPanels.showDiffPanel} -> ${desiredPanels.showDiffPanel}`,
        );
      if (lastPanels.showStagingSidebar !== desiredPanels.showStagingSidebar)
        changes.push(
          `staging: ${lastPanels.showStagingSidebar} -> ${desiredPanels.showStagingSidebar}`,
        );
      if (lastPanels.showAIReviewPanel !== desiredPanels.showAIReviewPanel)
        changes.push(
          `aiReview: ${lastPanels.showAIReviewPanel} -> ${desiredPanels.showAIReviewPanel}`,
        );
      if (lastPanels.showWorktreesPanel !== desiredPanels.showWorktreesPanel)
        changes.push(
          `worktrees: ${lastPanels.showWorktreesPanel} -> ${desiredPanels.showWorktreesPanel}`,
        );
      if (lastPanels.showGraphPanel !== desiredPanels.showGraphPanel)
        changes.push(
          `graph: ${lastPanels.showGraphPanel} -> ${desiredPanels.showGraphPanel}`,
        );
      if (
        lastPanels.showMergeConflictPanel !==
        desiredPanels.showMergeConflictPanel
      )
        changes.push(
          `mergeConflict: ${lastPanels.showMergeConflictPanel} -> ${desiredPanels.showMergeConflictPanel}`,
        );
      if (lastPanels.showReflogPanel !== desiredPanels.showReflogPanel)
        changes.push(
          `reflog: ${lastPanels.showReflogPanel} -> ${desiredPanels.showReflogPanel}`,
        );
      if (lastPanels.showMermaidChangesPanel !== desiredPanels.showMermaidChangesPanel)
        changes.push(
          `mermaidChanges: ${lastPanels.showMermaidChangesPanel} -> ${desiredPanels.showMermaidChangesPanel}`,
        );
      if (lastPanels.showCodeFlowPanel !== desiredPanels.showCodeFlowPanel)
        changes.push(
          `codeFlow: ${lastPanels.showCodeFlowPanel} -> ${desiredPanels.showCodeFlowPanel}`,
        );
      console.log("[perf] Panel changes:", changes.join(", ") || "(initial)");
    }

    effectCount++;
    if (isPerfTracingEnabled())
      console.log(`[perf] Reconcile Effect #${effectCount} running`);
    traceUntilPaint(`Reconcile Effect #${effectCount}`);
    lastReconcileRef.current = { ...desiredPanels };

    // Reconcile panels with desired state - no transaction wrapper here
    // since we're already checking isInLayoutTransaction above
    reconcilePanels(api, desiredPanels);
  }, [
    activeTabPath,
    showCommitsPanel,
    showBranchesPanel,
    showFilesPanel,
    showFileTreePanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    showWorktreesPanel,
    showGraphPanel,
    showMergeConflictPanel,
    showReflogPanel,
    showMermaidChangesPanel,
    showCodeFlowPanel,
  ]);

  return (
    <DockviewReact
      components={components}
      onReady={onReady}
      className={
        isLightTheme(theme)
          ? "dockview-theme-light"
          : "dockview-theme-dark"
      }
      rightHeaderActionsComponent={DockviewHeaderActions}
      defaultTabComponent={DockviewTab}
      // Only render panel content when the panel is visible (not just mounted)
      // This significantly improves performance for heavy panels like diff, graph, etc.
      defaultRenderer="onlyWhenVisible"
    />
  );
});
