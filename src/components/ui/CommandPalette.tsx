import { Command } from 'cmdk';
import { useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  Files,
  Code,
  Stack,
  Robot,
  CloudArrowDown,
  ArrowDown,
  ArrowUp,
  Rows,
  SplitVertical,
  TextAa,
  Layout,
  GearSix,
  Keyboard,
  GitCommit,
} from '@phosphor-icons/react';
import { useUIStore, getDockviewApi } from '../../stores/ui-store';
import { useGitStore } from '../../stores/git-store';
import { useToast } from './Toast';
import { gitFetch, gitPull, gitPush } from '../../lib/tauri';
import { applyLayout, layoutPresets } from '../../lib/layouts';

export function CommandPalette() {
  const {
    showCommandPalette,
    setShowCommandPalette,
    showBranchesPanel,
    showFilesPanel,
    showDiffPanel,
    showStagingSidebar,
    showAIReviewPanel,
    diffViewMode,
    diffFontSize,
    toggleBranchesPanel,
    setShowFilesPanel,
    setShowDiffPanel,
    toggleStagingSidebar,
    setShowAIReviewPanel,
    setDiffViewMode,
    setDiffFontSize,
    setShowSettingsDialog,
    setShowHelpOverlay,
    setActivePanel,
  } = useUIStore();

  const { repository } = useGitStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const runCommand = (fn: () => void | Promise<void>) => {
    setShowCommandPalette(false);
    fn();
  };

  const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return JSON.stringify(error);
  };

  const handleFetch = async () => {
    if (!repository) return;
    try {
      await gitFetch(repository.path);
      toast.success('Fetch complete', 'Successfully fetched from remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    } catch (error) {
      toast.error('Fetch failed', getErrorMessage(error));
    }
  };

  const handlePull = async () => {
    if (!repository) return;
    try {
      const result = await gitPull(repository.path);
      toast.success('Pull complete', result || 'Successfully pulled from remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    } catch (error) {
      toast.error('Pull failed', getErrorMessage(error));
    }
  };

  const handlePush = async () => {
    if (!repository) return;
    try {
      await gitPush(repository.path);
      toast.success('Push complete', 'Successfully pushed to remote');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    } catch (error) {
      toast.error('Push failed', getErrorMessage(error));
    }
  };

  const focusPanel = (panelId: string) => {
    const api = getDockviewApi();
    if (api) {
      const panel = api.getPanel(panelId);
      if (panel) {
        panel.api.setActive();
      }
    }
  };

  return (
    <Command.Dialog
      open={showCommandPalette}
      onOpenChange={setShowCommandPalette}
      label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setShowCommandPalette(false)}
      />

      {/* Dialog content */}
      <div className="relative w-full max-w-lg bg-bg-secondary rounded-lg shadow-xl border border-border-primary overflow-hidden">
        <Command.Input
          placeholder="Type a command..."
          className="w-full px-4 py-3 bg-transparent border-b border-border-primary text-text-primary placeholder-text-muted outline-none text-sm"
        />

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-text-muted text-sm">
            No results found.
          </Command.Empty>

          {/* Panels Group */}
          <Command.Group
            heading="Panels"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:font-medium"
          >
            <Command.Item
              onSelect={() => runCommand(toggleBranchesPanel)}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <GitBranch size={16} className="text-text-muted" />
              <span className="flex-1">Toggle Branches Panel</span>
              <span className="text-xs text-text-muted">
                {showBranchesPanel ? 'Hide' : 'Show'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                1
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() => runCommand(() => setShowFilesPanel(!showFilesPanel))}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Files size={16} className="text-text-muted" />
              <span className="flex-1">Toggle Files Panel</span>
              <span className="text-xs text-text-muted">
                {showFilesPanel ? 'Hide' : 'Show'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                3
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() => runCommand(() => setShowDiffPanel(!showDiffPanel))}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Code size={16} className="text-text-muted" />
              <span className="flex-1">Toggle Diff Panel</span>
              <span className="text-xs text-text-muted">
                {showDiffPanel ? 'Hide' : 'Show'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                4
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() => runCommand(toggleStagingSidebar)}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Stack size={16} className="text-text-muted" />
              <span className="flex-1">Toggle Staging Sidebar</span>
              <span className="text-xs text-text-muted">
                {showStagingSidebar ? 'Hide' : 'Show'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                Cmd+Shift+S
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() => runCommand(() => setShowAIReviewPanel(!showAIReviewPanel))}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Robot size={16} className="text-text-muted" />
              <span className="flex-1">Toggle AI Review Panel</span>
              <span className="text-xs text-text-muted">
                {showAIReviewPanel ? 'Hide' : 'Show'}
              </span>
            </Command.Item>
          </Command.Group>

          {/* Navigation Group */}
          <Command.Group
            heading="Navigation"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:font-medium"
          >
            <Command.Item
              onSelect={() =>
                runCommand(() => {
                  setActivePanel('branches');
                  focusPanel('branches');
                })
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <GitBranch size={16} className="text-text-muted" />
              <span className="flex-1">Go to Branches</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                1
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() =>
                runCommand(() => {
                  setActivePanel('commits');
                  focusPanel('commits');
                })
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <GitCommit size={16} className="text-text-muted" />
              <span className="flex-1">Go to Commits</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                2
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() =>
                runCommand(() => {
                  setActivePanel('files');
                  focusPanel('files');
                })
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Files size={16} className="text-text-muted" />
              <span className="flex-1">Go to Files</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                3
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() =>
                runCommand(() => {
                  setActivePanel('diff');
                  focusPanel('diff');
                })
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Code size={16} className="text-text-muted" />
              <span className="flex-1">Go to Diff</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                4
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() =>
                runCommand(() => {
                  setActivePanel('staging');
                  focusPanel('staging');
                })
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Stack size={16} className="text-text-muted" />
              <span className="flex-1">Go to Staging</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                5
              </kbd>
            </Command.Item>
          </Command.Group>

          {/* Git Group - only show when repo is open */}
          {repository && (
            <Command.Group
              heading="Git"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:font-medium"
            >
              <Command.Item
                onSelect={() => runCommand(handleFetch)}
                className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
              >
                <CloudArrowDown size={16} className="text-text-muted" />
                <span className="flex-1">Fetch from Remote</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(handlePull)}
                className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
              >
                <ArrowDown size={16} className="text-text-muted" />
                <span className="flex-1">Pull from Remote</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(handlePush)}
                className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
              >
                <ArrowUp size={16} className="text-text-muted" />
                <span className="flex-1">Push to Remote</span>
              </Command.Item>
            </Command.Group>
          )}

          {/* View Group */}
          <Command.Group
            heading="View"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:font-medium"
          >
            <Command.Item
              onSelect={() =>
                runCommand(() =>
                  setDiffViewMode(diffViewMode === 'split' ? 'unified' : 'split')
                )
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              {diffViewMode === 'split' ? (
                <Rows size={16} className="text-text-muted" />
              ) : (
                <SplitVertical size={16} className="text-text-muted" />
              )}
              <span className="flex-1">Toggle Diff View Mode</span>
              <span className="text-xs text-text-muted">
                {diffViewMode === 'split' ? 'Switch to Unified' : 'Switch to Split'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                V
              </kbd>
            </Command.Item>

            <Command.Item
              onSelect={() =>
                runCommand(() => setDiffFontSize(Math.min(diffFontSize + 1, 24)))
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <TextAa size={16} className="text-text-muted" />
              <span className="flex-1">Increase Font Size</span>
              <span className="text-xs text-text-muted">{diffFontSize}px</span>
            </Command.Item>

            <Command.Item
              onSelect={() =>
                runCommand(() => setDiffFontSize(Math.max(diffFontSize - 1, 10)))
              }
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <TextAa size={16} className="text-text-muted" />
              <span className="flex-1">Decrease Font Size</span>
              <span className="text-xs text-text-muted">{diffFontSize}px</span>
            </Command.Item>
          </Command.Group>

          {/* Layout Group */}
          <Command.Group
            heading="Layout"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:font-medium"
          >
            {layoutPresets.map((preset) => (
              <Command.Item
                key={preset.id}
                onSelect={() =>
                  runCommand(() => {
                    const api = getDockviewApi();
                    if (api) {
                      applyLayout(api, preset.id);
                    }
                  })
                }
                className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
              >
                <Layout size={16} className="text-text-muted" />
                <span className="flex-1">Layout: {preset.name}</span>
                <span className="text-xs text-text-muted">{preset.description}</span>
              </Command.Item>
            ))}
          </Command.Group>

          {/* General Group */}
          <Command.Group
            heading="General"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:font-medium"
          >
            <Command.Item
              onSelect={() => runCommand(() => setShowSettingsDialog(true))}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <GearSix size={16} className="text-text-muted" />
              <span className="flex-1">Open Settings</span>
            </Command.Item>

            <Command.Item
              onSelect={() => runCommand(() => setShowHelpOverlay(true))}
              className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer text-text-primary data-[selected=true]:bg-bg-hover text-sm"
            >
              <Keyboard size={16} className="text-text-muted" />
              <span className="flex-1">Show Keyboard Shortcuts</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted font-mono text-xs">
                ?
              </kbd>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
