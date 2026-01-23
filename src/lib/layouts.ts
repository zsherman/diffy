import type { DockviewApi } from "dockview-react";
import { setApplyingLayoutPreset } from "../components/layout/DockviewLayout";
import { tabsStore } from "../stores/tabs-store";

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

export function applyLayout(api: DockviewApi, layoutId: string) {
  const preset = layoutPresets.find((p) => p.id === layoutId);
  if (preset) {
    // Set flag to prevent removal handlers from interfering
    setApplyingLayoutPreset(true);
    try {
      preset.apply(api);

      // Sync store state based on which panels are in the layout - batched in one action
      tabsStore.send({
        type: "syncPanels",
        panels: {
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
