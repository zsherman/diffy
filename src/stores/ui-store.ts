import { create } from 'zustand';
import type { PanelId, ViewMode } from '../types/git';

interface UIState {
  // Panel focus
  activePanel: PanelId;
  setActivePanel: (panel: PanelId) => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Selected items
  selectedBranch: string | null;
  setSelectedBranch: (branch: string | null) => void;

  selectedCommit: string | null;
  setSelectedCommit: (commit: string | null) => void;

  selectedFile: string | null;
  setSelectedFile: (file: string | null) => void;

  // UI state
  showHelpOverlay: boolean;
  setShowHelpOverlay: (show: boolean) => void;

  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;

  diffViewMode: 'split' | 'unified';
  setDiffViewMode: (mode: 'split' | 'unified') => void;

  // Panel sizes (percentages)
  branchesPanelSize: number;
  commitsPanelSize: number;
  filesPanelSize: number;
  setPanelSizes: (branches: number, commits: number, files: number) => void;

  // Branch filter
  branchFilter: string;
  setBranchFilter: (filter: string) => void;

  // Commit filter
  commitFilter: string;
  setCommitFilter: (filter: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Panel focus
  activePanel: 'branches',
  setActivePanel: (panel) => set({ activePanel: panel }),

  // View mode
  viewMode: 'working',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Selected items
  selectedBranch: null,
  setSelectedBranch: (branch) => set({ selectedBranch: branch }),

  selectedCommit: null,
  setSelectedCommit: (commit) => set({ selectedCommit: commit }),

  selectedFile: null,
  setSelectedFile: (file) => set({ selectedFile: file }),

  // UI state
  showHelpOverlay: false,
  setShowHelpOverlay: (show) => set({ showHelpOverlay: show }),

  showCommandPalette: false,
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),

  diffViewMode: 'split',
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),

  // Panel sizes
  branchesPanelSize: 15,
  commitsPanelSize: 35,
  filesPanelSize: 50,
  setPanelSizes: (branches, commits, files) => set({
    branchesPanelSize: branches,
    commitsPanelSize: commits,
    filesPanelSize: files,
  }),

  // Filters
  branchFilter: '',
  setBranchFilter: (filter) => set({ branchFilter: filter }),

  commitFilter: '',
  setCommitFilter: (filter) => set({ commitFilter: filter }),
}));
