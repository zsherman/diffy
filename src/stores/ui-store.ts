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

interface UIContext {
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
}

export const uiStore = createStore({
  context: {
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
  } as UIContext,
  on: {
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
  },
});

// Wrapper hook maintains same API - no component changes needed
export function useUIStore() {
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

  return {
    // State
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

    // Actions
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
  };
}
