import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { produce } from 'immer';
import type { DockviewApi } from 'dockview-react';
import type { PanelId, ViewMode, AIReviewData } from '../types/git';

// Dockview API reference (stored outside of xstate store for direct access)
let dockviewApiRef: DockviewApi | null = null;

export function setDockviewApi(api: DockviewApi | null) {
  dockviewApiRef = api;
}

export function getDockviewApi(): DockviewApi | null {
  return dockviewApiRef;
}

type Theme = 'pierre-dark' | 'pierre-light';

interface UIContext {
  // Theme
  theme: Theme;

  // Panel focus
  activePanel: PanelId;

  // View mode
  viewMode: ViewMode;

  // Selected items
  selectedBranch: string | null;
  selectedCommit: string | null;
  selectedFile: string | null;

  // UI state
  showHelpOverlay: boolean;
  showCommandPalette: boolean;
  showSettingsDialog: boolean;
  diffViewMode: 'split' | 'unified';
  diffFontSize: number;

  // Panel sizes (percentages)
  branchesPanelSize: number;
  commitsPanelSize: number;
  filesPanelSize: number;

  // Filters
  branchFilter: string;
  commitFilter: string;

  // Staging sidebar
  showStagingSidebar: boolean;
  commitMessage: string;
  commitDescription: string;
  amendPreviousCommit: boolean;

  // Collapsible panels
  showBranchesPanel: boolean;
  showFilesPanel: boolean;
  showDiffPanel: boolean;

  // AI Review panel
  showAIReviewPanel: boolean;
  aiReview: AIReviewData | null;
  aiReviewLoading: boolean;
  aiReviewError: string | null;

  // Worktrees panel
  showWorktreesPanel: boolean;
  selectedWorktree: string | null;
  worktreeFilter: string;

  // Graph panel
  showGraphPanel: boolean;
  graphColumnWidths: { branchTag: number; graph: number };

  // Skills
  selectedSkillIds: string[];
  showSkillsDialog: boolean;
}

// Get initial theme from localStorage
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('diffy-theme');
    if (saved === 'pierre-dark' || saved === 'pierre-light') {
      return saved;
    }
  }
  return 'pierre-dark';
}

// Get initial selected skills from localStorage
function getInitialSelectedSkills(): string[] {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('diffy-selected-skills');
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

export const uiStore = createStore({
  context: {
    theme: getInitialTheme(),
    activePanel: 'branches',
    viewMode: 'working',
    selectedBranch: null,
    selectedCommit: null,
    selectedFile: null,
    showHelpOverlay: false,
    showCommandPalette: false,
    showSettingsDialog: false,
    diffViewMode: 'unified',
    diffFontSize: 13,
    branchesPanelSize: 15,
    commitsPanelSize: 35,
    filesPanelSize: 50,
    branchFilter: '',
    commitFilter: '',
    showStagingSidebar: false,
    commitMessage: '',
    commitDescription: '',
    amendPreviousCommit: false,
    showBranchesPanel: false,
    showFilesPanel: true,
    showDiffPanel: true,
    showAIReviewPanel: false,
    aiReview: null,
    aiReviewLoading: false,
    aiReviewError: null,
    showWorktreesPanel: false,
    selectedWorktree: null,
    worktreeFilter: '',
    showGraphPanel: false,
    graphColumnWidths: { branchTag: 180, graph: 120 },
    selectedSkillIds: getInitialSelectedSkills(),
    showSkillsDialog: false,
  } as UIContext,
  on: {
    setTheme: (ctx, event: { theme: Theme }) =>
      produce(ctx, (draft) => {
        draft.theme = event.theme;
        if (typeof window !== 'undefined') {
          localStorage.setItem('diffy-theme', event.theme);
        }
      }),
    setActivePanel: (ctx, event: { panel: PanelId }) =>
      produce(ctx, (draft) => {
        draft.activePanel = event.panel;
      }),
    setViewMode: (ctx, event: { mode: ViewMode }) =>
      produce(ctx, (draft) => {
        draft.viewMode = event.mode;
      }),
    setSelectedBranch: (ctx, event: { branch: string | null }) =>
      produce(ctx, (draft) => {
        draft.selectedBranch = event.branch;
      }),
    setSelectedCommit: (ctx, event: { commit: string | null }) =>
      produce(ctx, (draft) => {
        draft.selectedCommit = event.commit;
      }),
    setSelectedFile: (ctx, event: { file: string | null }) =>
      produce(ctx, (draft) => {
        draft.selectedFile = event.file;
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
    setDiffViewMode: (ctx, event: { mode: 'split' | 'unified' }) =>
      produce(ctx, (draft) => {
        draft.diffViewMode = event.mode;
      }),
    setDiffFontSize: (ctx, event: { size: number }) =>
      produce(ctx, (draft) => {
        draft.diffFontSize = event.size;
      }),
    setPanelSizes: (
      ctx,
      event: { branches: number; commits: number; files: number }
    ) =>
      produce(ctx, (draft) => {
        draft.branchesPanelSize = event.branches;
        draft.commitsPanelSize = event.commits;
        draft.filesPanelSize = event.files;
      }),
    setBranchFilter: (ctx, event: { filter: string }) =>
      produce(ctx, (draft) => {
        draft.branchFilter = event.filter;
      }),
    setCommitFilter: (ctx, event: { filter: string }) =>
      produce(ctx, (draft) => {
        draft.commitFilter = event.filter;
      }),
    setShowStagingSidebar: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showStagingSidebar = event.show;
      }),
    toggleStagingSidebar: (ctx) =>
      produce(ctx, (draft) => {
        draft.showStagingSidebar = !draft.showStagingSidebar;
      }),
    setCommitMessage: (ctx, event: { message: string }) =>
      produce(ctx, (draft) => {
        draft.commitMessage = event.message;
      }),
    setCommitDescription: (ctx, event: { description: string }) =>
      produce(ctx, (draft) => {
        draft.commitDescription = event.description;
      }),
    setAmendPreviousCommit: (ctx, event: { amend: boolean }) =>
      produce(ctx, (draft) => {
        draft.amendPreviousCommit = event.amend;
      }),
    clearCommitForm: (ctx) =>
      produce(ctx, (draft) => {
        draft.commitMessage = '';
        draft.commitDescription = '';
        draft.amendPreviousCommit = false;
      }),
    setShowBranchesPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showBranchesPanel = event.show;
      }),
    toggleBranchesPanel: (ctx) =>
      produce(ctx, (draft) => {
        draft.showBranchesPanel = !draft.showBranchesPanel;
      }),
    setShowFilesPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showFilesPanel = event.show;
      }),
    setShowDiffPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showDiffPanel = event.show;
      }),
    setShowAIReviewPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showAIReviewPanel = event.show;
      }),
    setAIReview: (ctx, event: { review: AIReviewData | null }) =>
      produce(ctx, (draft) => {
        draft.aiReview = event.review;
      }),
    setAIReviewLoading: (ctx, event: { loading: boolean }) =>
      produce(ctx, (draft) => {
        draft.aiReviewLoading = event.loading;
      }),
    setAIReviewError: (ctx, event: { error: string | null }) =>
      produce(ctx, (draft) => {
        draft.aiReviewError = event.error;
      }),
    clearAIReview: (ctx) =>
      produce(ctx, (draft) => {
        draft.aiReview = null;
        draft.aiReviewError = null;
      }),
    setShowWorktreesPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showWorktreesPanel = event.show;
      }),
    toggleWorktreesPanel: (ctx) =>
      produce(ctx, (draft) => {
        draft.showWorktreesPanel = !draft.showWorktreesPanel;
      }),
    setSelectedWorktree: (ctx, event: { worktree: string | null }) =>
      produce(ctx, (draft) => {
        draft.selectedWorktree = event.worktree;
      }),
    setWorktreeFilter: (ctx, event: { filter: string }) =>
      produce(ctx, (draft) => {
        draft.worktreeFilter = event.filter;
      }),
    setShowGraphPanel: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showGraphPanel = event.show;
      }),
    toggleGraphPanel: (ctx) =>
      produce(ctx, (draft) => {
        draft.showGraphPanel = !draft.showGraphPanel;
      }),
    setGraphColumnWidths: (ctx, event: { widths: { branchTag: number; graph: number } }) =>
      produce(ctx, (draft) => {
        draft.graphColumnWidths = event.widths;
      }),
    setSelectedSkillIds: (ctx, event: { skillIds: string[] }) =>
      produce(ctx, (draft) => {
        draft.selectedSkillIds = event.skillIds;
        if (typeof window !== 'undefined') {
          localStorage.setItem('diffy-selected-skills', JSON.stringify(event.skillIds));
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
        if (typeof window !== 'undefined') {
          localStorage.setItem('diffy-selected-skills', JSON.stringify(draft.selectedSkillIds));
        }
      }),
    setShowSkillsDialog: (ctx, event: { show: boolean }) =>
      produce(ctx, (draft) => {
        draft.showSkillsDialog = event.show;
      }),
    clearSelectedSkills: (ctx) =>
      produce(ctx, (draft) => {
        draft.selectedSkillIds = [];
        if (typeof window !== 'undefined') {
          localStorage.setItem('diffy-selected-skills', JSON.stringify([]));
        }
      }),
  },
});

// Wrapper hook maintains same API - no component changes needed
export function useUIStore() {
  const theme = useSelector(uiStore, (s) => s.context.theme);
  const activePanel = useSelector(uiStore, (s) => s.context.activePanel);
  const viewMode = useSelector(uiStore, (s) => s.context.viewMode);
  const selectedBranch = useSelector(uiStore, (s) => s.context.selectedBranch);
  const selectedCommit = useSelector(uiStore, (s) => s.context.selectedCommit);
  const selectedFile = useSelector(uiStore, (s) => s.context.selectedFile);
  const showHelpOverlay = useSelector(uiStore, (s) => s.context.showHelpOverlay);
  const showCommandPalette = useSelector(uiStore, (s) => s.context.showCommandPalette);
  const showSettingsDialog = useSelector(uiStore, (s) => s.context.showSettingsDialog);
  const diffViewMode = useSelector(uiStore, (s) => s.context.diffViewMode);
  const diffFontSize = useSelector(uiStore, (s) => s.context.diffFontSize);
  const branchesPanelSize = useSelector(uiStore, (s) => s.context.branchesPanelSize);
  const commitsPanelSize = useSelector(uiStore, (s) => s.context.commitsPanelSize);
  const filesPanelSize = useSelector(uiStore, (s) => s.context.filesPanelSize);
  const branchFilter = useSelector(uiStore, (s) => s.context.branchFilter);
  const commitFilter = useSelector(uiStore, (s) => s.context.commitFilter);
  const showStagingSidebar = useSelector(uiStore, (s) => s.context.showStagingSidebar);
  const commitMessage = useSelector(uiStore, (s) => s.context.commitMessage);
  const commitDescription = useSelector(uiStore, (s) => s.context.commitDescription);
  const amendPreviousCommit = useSelector(uiStore, (s) => s.context.amendPreviousCommit);
  const showBranchesPanel = useSelector(uiStore, (s) => s.context.showBranchesPanel);
  const showFilesPanel = useSelector(uiStore, (s) => s.context.showFilesPanel);
  const showDiffPanel = useSelector(uiStore, (s) => s.context.showDiffPanel);
  const showAIReviewPanel = useSelector(uiStore, (s) => s.context.showAIReviewPanel);
  const aiReview = useSelector(uiStore, (s) => s.context.aiReview);
  const aiReviewLoading = useSelector(uiStore, (s) => s.context.aiReviewLoading);
  const aiReviewError = useSelector(uiStore, (s) => s.context.aiReviewError);
  const showWorktreesPanel = useSelector(uiStore, (s) => s.context.showWorktreesPanel);
  const selectedWorktree = useSelector(uiStore, (s) => s.context.selectedWorktree);
  const worktreeFilter = useSelector(uiStore, (s) => s.context.worktreeFilter);
  const showGraphPanel = useSelector(uiStore, (s) => s.context.showGraphPanel);
  const graphColumnWidths = useSelector(uiStore, (s) => s.context.graphColumnWidths);
  const selectedSkillIds = useSelector(uiStore, (s) => s.context.selectedSkillIds);
  const showSkillsDialog = useSelector(uiStore, (s) => s.context.showSkillsDialog);

  return {
    // State
    theme,
    activePanel,
    viewMode,
    selectedBranch,
    selectedCommit,
    selectedFile,
    showHelpOverlay,
    showCommandPalette,
    showSettingsDialog,
    diffViewMode,
    diffFontSize,
    branchesPanelSize,
    commitsPanelSize,
    filesPanelSize,
    branchFilter,
    commitFilter,
    showStagingSidebar,
    commitMessage,
    commitDescription,
    amendPreviousCommit,
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showAIReviewPanel,
    aiReview,
    aiReviewLoading,
    aiReviewError,
    showWorktreesPanel,
    selectedWorktree,
    worktreeFilter,
    showGraphPanel,
    graphColumnWidths,
    selectedSkillIds,
    showSkillsDialog,

    // Actions
    setTheme: (theme: Theme) =>
      uiStore.send({ type: 'setTheme', theme }),
    setActivePanel: (panel: PanelId) =>
      uiStore.send({ type: 'setActivePanel', panel }),
    setViewMode: (mode: ViewMode) =>
      uiStore.send({ type: 'setViewMode', mode }),
    setSelectedBranch: (branch: string | null) =>
      uiStore.send({ type: 'setSelectedBranch', branch }),
    setSelectedCommit: (commit: string | null) =>
      uiStore.send({ type: 'setSelectedCommit', commit }),
    setSelectedFile: (file: string | null) =>
      uiStore.send({ type: 'setSelectedFile', file }),
    setShowHelpOverlay: (show: boolean) =>
      uiStore.send({ type: 'setShowHelpOverlay', show }),
    setShowCommandPalette: (show: boolean) =>
      uiStore.send({ type: 'setShowCommandPalette', show }),
    setShowSettingsDialog: (show: boolean) =>
      uiStore.send({ type: 'setShowSettingsDialog', show }),
    setDiffViewMode: (mode: 'split' | 'unified') =>
      uiStore.send({ type: 'setDiffViewMode', mode }),
    setDiffFontSize: (size: number) =>
      uiStore.send({ type: 'setDiffFontSize', size }),
    setPanelSizes: (branches: number, commits: number, files: number) =>
      uiStore.send({ type: 'setPanelSizes', branches, commits, files }),
    setBranchFilter: (filter: string) =>
      uiStore.send({ type: 'setBranchFilter', filter }),
    setCommitFilter: (filter: string) =>
      uiStore.send({ type: 'setCommitFilter', filter }),
    setShowStagingSidebar: (show: boolean) =>
      uiStore.send({ type: 'setShowStagingSidebar', show }),
    toggleStagingSidebar: () =>
      uiStore.send({ type: 'toggleStagingSidebar' }),
    setCommitMessage: (message: string) =>
      uiStore.send({ type: 'setCommitMessage', message }),
    setCommitDescription: (description: string) =>
      uiStore.send({ type: 'setCommitDescription', description }),
    setAmendPreviousCommit: (amend: boolean) =>
      uiStore.send({ type: 'setAmendPreviousCommit', amend }),
    clearCommitForm: () =>
      uiStore.send({ type: 'clearCommitForm' }),
    setShowBranchesPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowBranchesPanel', show }),
    toggleBranchesPanel: () =>
      uiStore.send({ type: 'toggleBranchesPanel' }),
    setShowFilesPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowFilesPanel', show }),
    setShowDiffPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowDiffPanel', show }),
    setShowAIReviewPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowAIReviewPanel', show }),
    setAIReview: (review: AIReviewData | null) =>
      uiStore.send({ type: 'setAIReview', review }),
    setAIReviewLoading: (loading: boolean) =>
      uiStore.send({ type: 'setAIReviewLoading', loading }),
    setAIReviewError: (error: string | null) =>
      uiStore.send({ type: 'setAIReviewError', error }),
    clearAIReview: () =>
      uiStore.send({ type: 'clearAIReview' }),
    setShowWorktreesPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowWorktreesPanel', show }),
    toggleWorktreesPanel: () =>
      uiStore.send({ type: 'toggleWorktreesPanel' }),
    setSelectedWorktree: (worktree: string | null) =>
      uiStore.send({ type: 'setSelectedWorktree', worktree }),
    setWorktreeFilter: (filter: string) =>
      uiStore.send({ type: 'setWorktreeFilter', filter }),
    setShowGraphPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowGraphPanel', show }),
    toggleGraphPanel: () =>
      uiStore.send({ type: 'toggleGraphPanel' }),
    setGraphColumnWidths: (widths: { branchTag: number; graph: number }) =>
      uiStore.send({ type: 'setGraphColumnWidths', widths }),
    setSelectedSkillIds: (skillIds: string[]) =>
      uiStore.send({ type: 'setSelectedSkillIds', skillIds }),
    toggleSkillSelection: (skillId: string) =>
      uiStore.send({ type: 'toggleSkillSelection', skillId }),
    setShowSkillsDialog: (show: boolean) =>
      uiStore.send({ type: 'setShowSkillsDialog', show }),
    clearSelectedSkills: () =>
      uiStore.send({ type: 'clearSelectedSkills' }),
  };
}
