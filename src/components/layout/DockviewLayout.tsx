import { useCallback, useEffect, useRef } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type SerializedDockview,
} from 'dockview-react';
import { useUIStore, setDockviewApi } from '../../stores/ui-store';
import {
  BranchesPanel,
  CommitsPanel,
  FilesPanel,
  DiffPanel,
  StagingPanel,
  AIReviewPanel,
} from './panels';
import { DockviewHeaderActions } from './DockviewHeaderActions';

const LAYOUT_STORAGE_KEY = 'diffy-dockview-layout';

// Press Ctrl+Shift+L to reset layout to default
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
      window.location.reload();
    }
  });
}

const components = {
  branches: BranchesPanel,
  commits: CommitsPanel,
  files: FilesPanel,
  diff: DiffPanel,
  staging: StagingPanel,
  'ai-review': AIReviewPanel,
};

function createDefaultLayout(api: DockviewApi) {
  // Create left group with commits panel (40% width)
  const commitsPanel = api.addPanel({
    id: 'commits',
    component: 'commits',
    title: 'Commits',
  });

  // Create right group with files panel at top (60% width, 35% height)
  const filesPanel = api.addPanel({
    id: 'files',
    component: 'files',
    title: 'Files',
    position: { referencePanel: commitsPanel, direction: 'right' },
  });

  // Add diff panel below files (65% height)
  api.addPanel({
    id: 'diff',
    component: 'diff',
    title: 'Diff',
    position: { referencePanel: filesPanel, direction: 'below' },
  });

  // Set initial sizes: [commits 40%] | [files/diff 60%]
  const groups = api.groups;
  if (groups.length >= 2) {
    groups[0].api.setSize({ width: 450 }); // commits ~40%
    groups[1].api.setSize({ width: 650 }); // files/diff ~60%
  }
}

function saveLayout(api: DockviewApi) {
  try {
    const layout = api.toJSON();
    // Ensure locked is false for all groups when saving
    if (layout.grid?.root) {
      const unlockGroups = (node: unknown) => {
        if (node && typeof node === 'object') {
          const n = node as Record<string, unknown>;
          if (n.type === 'branch' && Array.isArray(n.data)) {
            n.data.forEach(unlockGroups);
          } else if (n.type === 'leaf' && n.data && typeof n.data === 'object') {
            (n.data as Record<string, unknown>).locked = false;
          }
        }
      };
      unlockGroups(layout.grid.root);
    }
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.warn('Failed to save layout:', e);
  }
}

function loadLayout(): SerializedDockview | null {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as SerializedDockview;
    }
  } catch (e) {
    console.warn('Failed to load layout:', e);
  }
  return null;
}

// Flag to skip removal handlers during layout preset application
let isApplyingLayoutPreset = false;

export function setApplyingLayoutPreset(value: boolean) {
  isApplyingLayoutPreset = value;
}

export function DockviewLayout() {
  const { theme, showBranchesPanel, showFilesPanel, showDiffPanel, showStagingSidebar, showAIReviewPanel, setShowBranchesPanel, setShowFilesPanel, setShowDiffPanel, setShowStagingSidebar, setShowAIReviewPanel } = useUIStore();
  const apiRef = useRef<DockviewApi | null>(null);
  const isInitializedRef = useRef(false);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api;
    apiRef.current = api;
    setDockviewApi(api);

    // Try to load saved layout
    const savedLayout = loadLayout();
    if (savedLayout) {
      try {
        api.fromJSON(savedLayout);
        // Unlock all groups after loading (in case they were saved as locked)
        api.groups.forEach((g) => {
          g.locked = false;
        });
      } catch (e) {
        console.warn('Failed to restore layout, creating default:', e);
        createDefaultLayout(api);
      }
    } else {
      createDefaultLayout(api);
    }

    // Ensure all groups are unlocked for drag-and-drop
    api.groups.forEach((g) => {
      g.locked = false;
    });

    // Listen for layout changes to persist
    const layoutDisposable = api.onDidLayoutChange(() => {
      saveLayout(api);
    });

    // Listen for panel close events (skip during layout preset application)
    const removeDisposable = api.onDidRemovePanel((event) => {
      if (isApplyingLayoutPreset) return;

      const panelId = event.id;
      if (panelId === 'branches') {
        setShowBranchesPanel(false);
      } else if (panelId === 'files') {
        setShowFilesPanel(false);
      } else if (panelId === 'diff') {
        setShowDiffPanel(false);
      } else if (panelId === 'staging') {
        setShowStagingSidebar(false);
      } else if (panelId === 'ai-review') {
        setShowAIReviewPanel(false);
      }
    });

    isInitializedRef.current = true;

    return () => {
      layoutDisposable.dispose();
      removeDisposable.dispose();
    };
  }, [setShowBranchesPanel, setShowFilesPanel, setShowDiffPanel, setShowStagingSidebar, setShowAIReviewPanel]);

  // Sync branches panel visibility with dockview
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isInitializedRef.current) return;

    const branchesPanel = api.getPanel('branches');
    if (showBranchesPanel && !branchesPanel) {
      // Add branches panel on the left side
      const commitsPanel = api.getPanel('commits');
      if (commitsPanel) {
        api.addPanel({
          id: 'branches',
          component: 'branches',
          title: 'Branches',
          position: { referencePanel: commitsPanel, direction: 'left' },
        });
      }
    } else if (!showBranchesPanel && branchesPanel) {
      api.removePanel(branchesPanel);
    }
  }, [showBranchesPanel]);

  // Sync files panel visibility with dockview
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isInitializedRef.current) return;

    const filesPanel = api.getPanel('files');
    if (showFilesPanel && !filesPanel) {
      // Add files panel back
      const commitsPanel = api.getPanel('commits');
      const diffPanel = api.getPanel('diff');
      if (diffPanel) {
        api.addPanel({
          id: 'files',
          component: 'files',
          title: 'Files',
          position: { referencePanel: diffPanel, direction: 'above' },
        });
      } else if (commitsPanel) {
        api.addPanel({
          id: 'files',
          component: 'files',
          title: 'Files',
          position: { referencePanel: commitsPanel, direction: 'right' },
        });
      }
    } else if (!showFilesPanel && filesPanel) {
      api.removePanel(filesPanel);
    }
  }, [showFilesPanel]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isInitializedRef.current) return;

    const diffPanel = api.getPanel('diff');
    if (showDiffPanel && !diffPanel) {
      // Add diff panel back
      const filesPanel = api.getPanel('files');
      const commitsPanel = api.getPanel('commits');
      if (filesPanel) {
        api.addPanel({
          id: 'diff',
          component: 'diff',
          title: 'Diff',
          position: { referencePanel: filesPanel, direction: 'below' },
        });
      } else if (commitsPanel) {
        api.addPanel({
          id: 'diff',
          component: 'diff',
          title: 'Diff',
          position: { referencePanel: commitsPanel, direction: 'right' },
        });
      }
    } else if (!showDiffPanel && diffPanel) {
      api.removePanel(diffPanel);
    }
  }, [showDiffPanel]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isInitializedRef.current) return;

    const stagingPanel = api.getPanel('staging');
    if (showStagingSidebar && !stagingPanel) {
      // Add staging panel as full-height column on the far right
      // Using absolute position 'right' places it at the edge of the entire grid
      api.addPanel({
        id: 'staging',
        component: 'staging',
        title: 'Staging',
        position: { direction: 'right' },
      });
    } else if (!showStagingSidebar && stagingPanel) {
      api.removePanel(stagingPanel);
    }
  }, [showStagingSidebar]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !isInitializedRef.current) return;

    const aiReviewPanel = api.getPanel('ai-review');
    if (showAIReviewPanel && !aiReviewPanel) {
      // Add AI Review panel to the right of the diff panel
      const diffPanel = api.getPanel('diff');
      if (diffPanel) {
        api.addPanel({
          id: 'ai-review',
          component: 'ai-review',
          title: 'AI Review',
          position: { referencePanel: diffPanel, direction: 'right' },
        });
      } else {
        // Fallback: add to far right
        api.addPanel({
          id: 'ai-review',
          component: 'ai-review',
          title: 'AI Review',
          position: { direction: 'right' },
        });
      }
    } else if (!showAIReviewPanel && aiReviewPanel) {
      api.removePanel(aiReviewPanel);
    }
  }, [showAIReviewPanel]);

  return (
    <DockviewReact
      components={components}
      onReady={onReady}
      className={theme === 'pierre-light' ? 'dockview-theme-light' : 'dockview-theme-dark'}
      rightHeaderActionsComponent={DockviewHeaderActions}
    />
  );
}
