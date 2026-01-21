import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import type { PanelId, ViewMode } from '../types/git';

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
  diffViewMode: 'split' | 'unified';

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
  showFilesPanel: boolean;
  showDiffPanel: boolean;
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
    diffViewMode: 'split',
    branchesPanelSize: 15,
    commitsPanelSize: 35,
    filesPanelSize: 50,
    branchFilter: '',
    commitFilter: '',
    showStagingSidebar: false,
    commitMessage: '',
    commitDescription: '',
    amendPreviousCommit: false,
    showFilesPanel: true,
    showDiffPanel: true,
  } as UIContext,
  on: {
    setActivePanel: (ctx, event: { panel: PanelId }) => ({
      ...ctx,
      activePanel: event.panel,
    }),
    setViewMode: (ctx, event: { mode: ViewMode }) => ({
      ...ctx,
      viewMode: event.mode,
    }),
    setSelectedBranch: (ctx, event: { branch: string | null }) => ({
      ...ctx,
      selectedBranch: event.branch,
    }),
    setSelectedCommit: (ctx, event: { commit: string | null }) => ({
      ...ctx,
      selectedCommit: event.commit,
    }),
    setSelectedFile: (ctx, event: { file: string | null }) => ({
      ...ctx,
      selectedFile: event.file,
    }),
    setShowHelpOverlay: (ctx, event: { show: boolean }) => ({
      ...ctx,
      showHelpOverlay: event.show,
    }),
    setShowCommandPalette: (ctx, event: { show: boolean }) => ({
      ...ctx,
      showCommandPalette: event.show,
    }),
    setDiffViewMode: (ctx, event: { mode: 'split' | 'unified' }) => ({
      ...ctx,
      diffViewMode: event.mode,
    }),
    setPanelSizes: (
      ctx,
      event: { branches: number; commits: number; files: number }
    ) => ({
      ...ctx,
      branchesPanelSize: event.branches,
      commitsPanelSize: event.commits,
      filesPanelSize: event.files,
    }),
    setBranchFilter: (ctx, event: { filter: string }) => ({
      ...ctx,
      branchFilter: event.filter,
    }),
    setCommitFilter: (ctx, event: { filter: string }) => ({
      ...ctx,
      commitFilter: event.filter,
    }),
    setShowStagingSidebar: (ctx, event: { show: boolean }) => ({
      ...ctx,
      showStagingSidebar: event.show,
    }),
    toggleStagingSidebar: (ctx) => ({
      ...ctx,
      showStagingSidebar: !ctx.showStagingSidebar,
    }),
    setCommitMessage: (ctx, event: { message: string }) => ({
      ...ctx,
      commitMessage: event.message,
    }),
    setCommitDescription: (ctx, event: { description: string }) => ({
      ...ctx,
      commitDescription: event.description,
    }),
    setAmendPreviousCommit: (ctx, event: { amend: boolean }) => ({
      ...ctx,
      amendPreviousCommit: event.amend,
    }),
    clearCommitForm: (ctx) => ({
      ...ctx,
      commitMessage: '',
      commitDescription: '',
      amendPreviousCommit: false,
    }),
    setShowFilesPanel: (ctx, event: { show: boolean }) => ({
      ...ctx,
      showFilesPanel: event.show,
    }),
    setShowDiffPanel: (ctx, event: { show: boolean }) => ({
      ...ctx,
      showDiffPanel: event.show,
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
  const diffViewMode = useSelector(uiStore, (s) => s.context.diffViewMode);
  const branchesPanelSize = useSelector(uiStore, (s) => s.context.branchesPanelSize);
  const commitsPanelSize = useSelector(uiStore, (s) => s.context.commitsPanelSize);
  const filesPanelSize = useSelector(uiStore, (s) => s.context.filesPanelSize);
  const branchFilter = useSelector(uiStore, (s) => s.context.branchFilter);
  const commitFilter = useSelector(uiStore, (s) => s.context.commitFilter);
  const showStagingSidebar = useSelector(uiStore, (s) => s.context.showStagingSidebar);
  const commitMessage = useSelector(uiStore, (s) => s.context.commitMessage);
  const commitDescription = useSelector(uiStore, (s) => s.context.commitDescription);
  const amendPreviousCommit = useSelector(uiStore, (s) => s.context.amendPreviousCommit);
  const showFilesPanel = useSelector(uiStore, (s) => s.context.showFilesPanel);
  const showDiffPanel = useSelector(uiStore, (s) => s.context.showDiffPanel);

  return {
    // State
    activePanel,
    viewMode,
    selectedBranch,
    selectedCommit,
    selectedFile,
    showHelpOverlay,
    showCommandPalette,
    diffViewMode,
    branchesPanelSize,
    commitsPanelSize,
    filesPanelSize,
    branchFilter,
    commitFilter,
    showStagingSidebar,
    commitMessage,
    commitDescription,
    amendPreviousCommit,
    showFilesPanel,
    showDiffPanel,

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
    setDiffViewMode: (mode: 'split' | 'unified') =>
      uiStore.send({ type: 'setDiffViewMode', mode }),
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
    setShowFilesPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowFilesPanel', show }),
    setShowDiffPanel: (show: boolean) =>
      uiStore.send({ type: 'setShowDiffPanel', show }),
  };
}
