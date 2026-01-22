import type { DockviewApi } from 'dockview-react';
import { setApplyingLayoutPreset } from '../components/layout/DockviewLayout';
import { uiStore } from '../stores/ui-store';

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
    id: 'standard',
    name: 'Standard',
    description: 'Commits on left, Files and Diff stacked on right',
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: 'commits',
        component: 'commits',
        title: 'Commits',
      });

      const filesPanel = api.addPanel({
        id: 'files',
        component: 'files',
        title: 'Files',
        position: { referencePanel: commitsPanel, direction: 'right' },
      });

      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: filesPanel, direction: 'below' },
      });

      // Set sizes: 35% commits, 65% files/diff
      const groups = api.groups;
      if (groups.length >= 2) {
        groups[0].api.setSize({ width: 380 });
        groups[1].api.setSize({ width: 720 });
      }
    },
  },
  {
    id: 'wide-diff',
    name: 'Wide Diff',
    description: 'Maximize diff viewing area',
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: 'commits',
        component: 'commits',
        title: 'Commits',
      });

      const filesPanel = api.addPanel({
        id: 'files',
        component: 'files',
        title: 'Files',
        position: { referencePanel: commitsPanel, direction: 'right' },
      });

      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: filesPanel, direction: 'right' },
      });

      // Set sizes: 20% commits, 15% files, 65% diff
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 220 });
        groups[1].api.setSize({ width: 180 });
        groups[2].api.setSize({ width: 700 });
      }
    },
  },
  {
    id: 'three-column',
    name: 'Three Column',
    description: 'Equal columns for commits, files, and diff',
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: 'commits',
        component: 'commits',
        title: 'Commits',
      });

      const filesPanel = api.addPanel({
        id: 'files',
        component: 'files',
        title: 'Files',
        position: { referencePanel: commitsPanel, direction: 'right' },
      });

      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: filesPanel, direction: 'right' },
      });

      // Equal widths
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 366 });
        groups[1].api.setSize({ width: 366 });
        groups[2].api.setSize({ width: 366 });
      }
    },
  },
  {
    id: 'horizontal',
    name: 'Stacked',
    description: 'All panels stacked vertically',
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: 'commits',
        component: 'commits',
        title: 'Commits',
      });

      const filesPanel = api.addPanel({
        id: 'files',
        component: 'files',
        title: 'Files',
        position: { referencePanel: commitsPanel, direction: 'below' },
      });

      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: filesPanel, direction: 'below' },
      });

      // Set heights
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ height: 200 });
        groups[1].api.setSize({ height: 150 });
        groups[2].api.setSize({ height: 350 });
      }
    },
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Just commits and diff, minimal UI',
    apply: (api) => {
      clearLayout(api);

      const commitsPanel = api.addPanel({
        id: 'commits',
        component: 'commits',
        title: 'Commits',
      });

      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: commitsPanel, direction: 'right' },
      });

      // Set sizes: 30% commits, 70% diff
      const groups = api.groups;
      if (groups.length >= 2) {
        groups[0].api.setSize({ width: 330 });
        groups[1].api.setSize({ width: 770 });
      }
    },
  },
  {
    id: 'review',
    name: 'Review',
    description: 'Files on left, large diff on right for code review',
    apply: (api) => {
      clearLayout(api);

      const filesPanel = api.addPanel({
        id: 'files',
        component: 'files',
        title: 'Files',
      });

      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: filesPanel, direction: 'right' },
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
    id: 'ai-review',
    name: 'AI Review',
    description: 'Files on left, diff in center, AI Review on right',
    apply: (api) => {
      clearLayout(api);

      const filesPanel = api.addPanel({
        id: 'files',
        component: 'files',
        title: 'Files',
      });

      const diffPanel = api.addPanel({
        id: 'diff',
        component: 'diff',
        title: 'Diff',
        position: { referencePanel: filesPanel, direction: 'right' },
      });

      api.addPanel({
        id: 'ai-review',
        component: 'ai-review',
        title: 'AI Review',
        position: { referencePanel: diffPanel, direction: 'right' },
      });

      // Set sizes: 20% files, 45% diff, 35% review
      const groups = api.groups;
      if (groups.length >= 3) {
        groups[0].api.setSize({ width: 220 });
        groups[1].api.setSize({ width: 495 });
        groups[2].api.setSize({ width: 385 });
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

      // Sync store state based on which panels are in the layout
      const hasAIReview = api.getPanel('ai-review') !== undefined;
      uiStore.send({ type: 'setShowAIReviewPanel', show: hasAIReview });
    } finally {
      // Use setTimeout to ensure flag is cleared after React effects run
      setTimeout(() => setApplyingLayoutPreset(false), 100);
    }
  }
}
