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
} from './panels';

const LAYOUT_STORAGE_KEY = 'git-gui-dockview-layout';

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
};

function createDefaultLayout(api: DockviewApi) {
  // Create left group with branches panel (15% width)
  const branchesPanel = api.addPanel({
    id: 'branches',
    component: 'branches',
    title: 'Branches',
  });

  // Create center group with commits panel (35% width)
  const commitsPanel = api.addPanel({
    id: 'commits',
    component: 'commits',
    title: 'Commits',
    position: { referencePanel: branchesPanel, direction: 'right' },
  });

  // Create right group with files panel at top (50% width, 35% height)
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

  // Set initial sizes: [branches 15%] | [commits 35%] | [files/diff 50%]
  // Dockview handles proportional sizing, we can adjust group widths via the grid
  const groups = api.groups;
  if (groups.length >= 3) {
    // Groups are ordered left to right, set proportions 15:35:50
    groups[0].api.setSize({ width: 200 }); // branches ~15%
    groups[1].api.setSize({ width: 450 }); // commits ~35%
    groups[2].api.setSize({ width: 650 }); // files/diff ~50%
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

export function DockviewLayout() {
  const { showFilesPanel, showDiffPanel, showStagingSidebar, setShowFilesPanel, setShowDiffPanel, setShowStagingSidebar } = useUIStore();
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

    // Listen for panel close events
    const removeDisposable = api.onDidRemovePanel((event) => {
      const panelId = event.id;
      if (panelId === 'files') {
        setShowFilesPanel(false);
      } else if (panelId === 'diff') {
        setShowDiffPanel(false);
      } else if (panelId === 'staging') {
        setShowStagingSidebar(false);
      }
    });

    isInitializedRef.current = true;

    return () => {
      layoutDisposable.dispose();
      removeDisposable.dispose();
    };
  }, [setShowFilesPanel, setShowDiffPanel, setShowStagingSidebar]);

  // Sync panel visibility with dockview
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

  return (
    <DockviewReact
      components={components}
      onReady={onReady}
      className="dockview-theme-dark"
    />
  );
}
