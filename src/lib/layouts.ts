import type { DockviewApi } from "dockview-react";
import { setApplyingLayoutPreset } from "../components/layout/DockviewLayout";
import { tabsStore } from "../stores/tabs-store";
import { isPerfTracingEnabled } from "../stores/ui-store";

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  apply: (api: DockviewApi) => void;
}

function clearLayout(api: DockviewApi) {
  // Remove all panels
  const panels = [...api.panels];
  panels.forEach((panel) => {
    api.removePanel(panel);
  });
}

/**
 * Apply the "standard" (History) layout incrementally.
 * Keeps the diff panel if it exists, only adds/removes what's needed.
 * Target layout: [commits] | [files] | [diff]
 */
function applyStandardLayoutIncremental(api: DockviewApi) {
  const start = isPerfTracingEnabled() ? performance.now() : 0;

  // Check what panels exist
  const hasCommits = api.getPanel("commits") !== undefined;
  const hasFiles = api.getPanel("files") !== undefined;
  const hasDiff = api.getPanel("diff") !== undefined;
  const hasStaging = api.getPanel("staging") !== undefined;

  // Remove panels that shouldn't be in standard layout
  if (hasStaging) {
    const stagingPanel = api.getPanel("staging");
    if (stagingPanel) api.removePanel(stagingPanel);
  }

  // If we already have the standard layout, just resize
  if (hasCommits && hasFiles && hasDiff) {
    const groups = api.groups;
    if (groups.length >= 3) {
      groups[0].api.setSize({ width: 300 });
      groups[1].api.setSize({ width: 300 });
      groups[2].api.setSize({ width: 600 });
    }
    if (isPerfTracingEnabled()) {
      console.log(`[perf] applyStandardLayoutIncremental (resize only): ${(performance.now() - start).toFixed(2)}ms`);
    }
    return;
  }

  // Build up the layout, preserving diff if it exists
  if (!hasDiff) {
    // No diff - need to create everything from scratch
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
  } else {
    // Diff exists - add commits and files to the left of it
    const diffPanel = api.getPanel("diff")!;

    if (!hasFiles) {
      api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
        position: { referencePanel: diffPanel, direction: "left" },
        minimumWidth: 300,
      });
    }

    const filesPanel = api.getPanel("files")!;
    if (!hasCommits) {
      api.addPanel({
        id: "commits",
        component: "commits",
        title: "Commits",
        position: { referencePanel: filesPanel, direction: "left" },
        minimumWidth: 300,
      });
    }
  }

  // Set sizes: 25% commits, 25% files, 50% diff
  const groups = api.groups;
  if (groups.length >= 3) {
    groups[0].api.setSize({ width: 300 });
    groups[1].api.setSize({ width: 300 });
    groups[2].api.setSize({ width: 600 });
  }

  if (isPerfTracingEnabled()) {
    console.log(`[perf] applyStandardLayoutIncremental: ${(performance.now() - start).toFixed(2)}ms`);
  }
}

/**
 * Apply the "changes" layout incrementally.
 * Keeps the diff panel if it exists, only adds/removes what's needed.
 * Target layout: [staging] | [diff]
 */
function applyChangesLayoutIncremental(api: DockviewApi) {
  const start = isPerfTracingEnabled() ? performance.now() : 0;

  // Check what panels exist
  const hasCommits = api.getPanel("commits") !== undefined;
  const hasFiles = api.getPanel("files") !== undefined;
  const hasDiff = api.getPanel("diff") !== undefined;
  const hasStaging = api.getPanel("staging") !== undefined;

  // Remove panels that shouldn't be in changes layout
  if (hasCommits) {
    const commitsPanel = api.getPanel("commits");
    if (commitsPanel) api.removePanel(commitsPanel);
  }
  if (hasFiles) {
    const filesPanel = api.getPanel("files");
    if (filesPanel) api.removePanel(filesPanel);
  }

  // If we already have the changes layout, just resize
  if (hasStaging && hasDiff && !hasCommits && !hasFiles) {
    const groups = api.groups;
    if (groups.length >= 2) {
      groups[0].api.setSize({ width: 330 });
      groups[1].api.setSize({ width: 770 });
    }
    if (isPerfTracingEnabled()) {
      console.log(`[perf] applyChangesLayoutIncremental (resize only): ${(performance.now() - start).toFixed(2)}ms`);
    }
    return;
  }

  // Build up the layout, preserving diff if it exists
  if (!hasDiff) {
    // No diff - need to create everything from scratch
    const stagingPanel = api.addPanel({
      id: "staging",
      component: "staging",
      title: "Local Changes",
      minimumWidth: 250,
    });

    api.addPanel({
      id: "diff",
      component: "diff",
      title: "Diff",
      position: { referencePanel: stagingPanel, direction: "right" },
      minimumWidth: 300,
    });
  } else {
    // Diff exists - add staging to the left of it
    const diffPanel = api.getPanel("diff")!;

    if (!hasStaging) {
      api.addPanel({
        id: "staging",
        component: "staging",
        title: "Local Changes",
        position: { referencePanel: diffPanel, direction: "left" },
        minimumWidth: 250,
      });
    }
  }

  // Set sizes: 30% staging, 70% diff
  const groups = api.groups;
  if (groups.length >= 2) {
    groups[0].api.setSize({ width: 330 });
    groups[1].api.setSize({ width: 770 });
  }

  if (isPerfTracingEnabled()) {
    console.log(`[perf] applyChangesLayoutIncremental: ${(performance.now() - start).toFixed(2)}ms`);
  }
}

export const layoutPresets: LayoutPreset[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Commits, files, and diff in three columns",
    apply: (api) => {
      clearLayout(api);

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

      // Set sizes: 25% commits, 25% files, 50% diff
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 300 });
        groups[1].api.setSize({ width: 300 });
        groups[2].api.setSize({ width: 600 });
      }
    },
  },
  {
    id: "wide-diff",
    name: "Wide Diff",
    description: "Maximize diff viewing area",
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: "commits",
        component: "commits",
        title: "Commits",
      });

      const filesPanel = api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
        position: { referencePanel: commitsPanel, direction: "right" },
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: filesPanel, direction: "right" },
      });

      // Set sizes: 10% commits, 15% files, 75% diff
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 110 });
        groups[1].api.setSize({ width: 165 });
        groups[2].api.setSize({ width: 825 });
      }
    },
  },
  {
    id: "three-column",
    name: "Three Column",
    description: "Commits and files on left, wide diff on right",
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: "commits",
        component: "commits",
        title: "Commits",
      });

      const filesPanel = api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
        position: { referencePanel: commitsPanel, direction: "right" },
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: filesPanel, direction: "right" },
      });

      // Set sizes: 10% commits, 15% files, 75% diff
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 110 });
        groups[1].api.setSize({ width: 165 });
        groups[2].api.setSize({ width: 825 });
      }
    },
  },
  {
    id: "horizontal",
    name: "Stacked",
    description: "All panels stacked vertically",
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: "commits",
        component: "commits",
        title: "Commits",
      });

      const filesPanel = api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
        position: { referencePanel: commitsPanel, direction: "below" },
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: filesPanel, direction: "below" },
      });

      // Set heights: ~21% commits, ~14% files, ~65% diff
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ height: 150 });
        groups[1].api.setSize({ height: 100 });
        groups[2].api.setSize({ height: 450 });
      }
    },
  },
  {
    id: "focus",
    name: "Focus",
    description: "Just commits and diff, minimal UI",
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: "commits",
        component: "commits",
        title: "Commits",
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: commitsPanel, direction: "right" },
      });

      // Set sizes: 25% commits, 75% diff
      const groups = api.groups;
      if (groups.length >= 2) {
        groups[0].api.setSize({ width: 275 });
        groups[1].api.setSize({ width: 825 });
      }
    },
  },
  {
    id: "review",
    name: "Review",
    description: "Files on left, large diff on right for code review",
    apply: (api) => {
      clearLayout(api);

      const filesPanel = api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: filesPanel, direction: "right" },
      });

      // Set sizes: 25% files, 75% diff
      const groups = api.groups;
      if (groups.length >= 2) {
        groups[0].api.setSize({ width: 275 });
        groups[1].api.setSize({ width: 825 });
      }
    },
  },
  {
    id: "ai-review",
    name: "AI Review",
    description: "Files on left, diff in center, AI Review on right",
    apply: (api) => {
      clearLayout(api);

      const filesPanel = api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
      });

      const diffPanel = api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: filesPanel, direction: "right" },
      });

      api.addPanel({
        id: "ai-review",
        component: "ai-review",
        title: "AI Review",
        position: { referencePanel: diffPanel, direction: "right" },
      });

      // Set sizes: 15% files, 50% diff, 35% review
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 165 });
        groups[1].api.setSize({ width: 550 });
        groups[2].api.setSize({ width: 385 });
      }
    },
  },
  {
    id: "graph-view",
    name: "Graph View",
    description: "Commit graph on left, files and diff on right",
    apply: (api) => {
      clearLayout(api);

      const graphPanel = api.addPanel({
        id: "graph",
        component: "graph",
        title: "Graph",
      });

      const filesPanel = api.addPanel({
        id: "files",
        component: "files",
        title: "Files",
        position: { referencePanel: graphPanel, direction: "right" },
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: filesPanel, direction: "below" },
      });

      // Set sizes: 40% graph, 60% files/diff
      const groups = api.groups;
      if (groups.length >= 2) {
        groups[0].api.setSize({ width: 440 });
        groups[1].api.setSize({ width: 660 });
      }
    },
  },
  {
    id: "merge-conflict",
    name: "Merge Conflicts",
    description: "Full-screen merge conflict resolution",
    apply: (api) => {
      clearLayout(api);

      api.addPanel({
        id: "merge-conflict",
        component: "merge-conflict",
        title: "Merge Conflicts",
      });

      // Single panel takes full width - no need to set sizes
    },
  },
  {
    id: "changes",
    name: "Changes",
    description: "View and stage changes",
    apply: (api) => {
      clearLayout(api);

      const stagingPanel = api.addPanel({
        id: "staging",
        component: "staging",
        title: "Changes",
        minimumWidth: 250,
      });

      api.addPanel({
        id: "diff",
        component: "diff",
        title: "Diff",
        position: { referencePanel: stagingPanel, direction: "right" },
        minimumWidth: 300,
      });

      // Set sizes: 30% staging, 70% diff
      const groups = api.groups;
      if (groups.length >= 2) {
        groups[0].api.setSize({ width: 330 });
        groups[1].api.setSize({ width: 770 });
      }
    },
  },
];

/**
 * Check if current layout can be incrementally transitioned to target.
 * Returns true if we're switching between "standard" and "changes" layouts
 * (the most common view toggle in the UI).
 */
function canApplyIncrementally(api: DockviewApi, layoutId: string): boolean {
  if (layoutId !== "standard" && layoutId !== "changes") {
    return false;
  }

  // Check current layout shape - we can apply incrementally if:
  // - We have diff panel (the common panel between both layouts)
  // - We have either standard-like or changes-like layout
  const hasDiff = api.getPanel("diff") !== undefined;
  const hasStaging = api.getPanel("staging") !== undefined;
  const hasCommits = api.getPanel("commits") !== undefined;
  const hasFiles = api.getPanel("files") !== undefined;

  // Standard layout: commits, files, diff
  const isStandardLike = hasDiff && hasCommits && hasFiles && !hasStaging;
  // Changes layout: staging, diff
  const isChangesLike = hasDiff && hasStaging && !hasCommits && !hasFiles;

  return isStandardLike || isChangesLike;
}

export function applyLayout(api: DockviewApi, layoutId: string) {
  const preset = layoutPresets.find((p) => p.id === layoutId);
  if (preset) {
    // Set flag to prevent removal handlers from interfering
    setApplyingLayoutPreset(true);
    try {
      // Use incremental layout switching for standard <-> changes transitions
      if (canApplyIncrementally(api, layoutId)) {
        if (layoutId === "standard") {
          applyStandardLayoutIncremental(api);
        } else {
          applyChangesLayoutIncremental(api);
        }
      } else {
        // Fall back to full layout rebuild for other presets or non-incremental cases
        preset.apply(api);
      }

      // Sync store state based on which panels are in the layout - batched in one action
      tabsStore.send({
        type: "syncPanels",
        panels: {
          showCommitsPanel: api.getPanel("commits") !== undefined,
          showBranchesPanel: api.getPanel("branches") !== undefined,
          showFilesPanel: api.getPanel("files") !== undefined,
          showDiffPanel: api.getPanel("diff") !== undefined,
          showAIReviewPanel: api.getPanel("ai-review") !== undefined,
          showGraphPanel: api.getPanel("graph") !== undefined,
          showMergeConflictPanel: api.getPanel("merge-conflict") !== undefined,
          showStagingSidebar: api.getPanel("staging") !== undefined,
          showWorktreesPanel: api.getPanel("worktrees") !== undefined,
        },
      });
    } finally {
      // Use setTimeout to ensure flag is cleared after React effects run
      setTimeout(() => setApplyingLayoutPreset(false), 100);
    }
  }
}
