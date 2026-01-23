import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { FolderOpen, Warning, ClockCounterClockwise, GitDiff, ChartBar } from '@phosphor-icons/react';
import { openRepository, discoverRepository, getStatus, getMergeStatus, parseFileConflicts } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore, getDockviewApi } from '../../../stores/ui-store';
import { useMergeConflictStore } from '../../../stores/merge-conflict-store';
import { useToast } from '../../../components/ui/Toast';
import { applyLayout } from '../../../lib/layouts';

type ViewMode = 'history' | 'changes' | 'statistics';

export function RepoSelector() {
  const { repository, setRepository, setError, isLoading, setIsLoading } = useGitStore();
  const { showMergeConflictPanel, setShowMergeConflictPanel, mainView, setMainView, setSelectedCommit } = useUIStore();
  const { enterMergeMode, isActive: isMergeActive } = useMergeConflictStore();
  const toast = useToast();
  const hasShownMergeToast = useRef(false);

  // Fetch working directory status for badge count
  const { data: status } = useQuery({
    queryKey: ['status', repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Fetch merge status
  const { data: mergeStatus } = useQuery({
    queryKey: ['merge-status', repository?.path],
    queryFn: () => getMergeStatus(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Show toast when merge conflicts are detected
  useEffect(() => {
    if (
      mergeStatus?.inMerge &&
      mergeStatus.conflictingFiles.length > 0 &&
      !showMergeConflictPanel &&
      !isMergeActive &&
      !hasShownMergeToast.current
    ) {
      hasShownMergeToast.current = true;
      const conflictCount = mergeStatus.conflictingFiles.length;
      toast.withAction(
        'Merge Conflicts Detected',
        `${conflictCount} file${conflictCount > 1 ? 's have' : ' has'} conflicts that need to be resolved`,
        'warning',
        {
          label: 'Resolve Conflicts',
          onClick: async () => {
            if (!repository) return;
            try {
              // Load conflict info for all files
              const fileInfos = await Promise.all(
                mergeStatus.conflictingFiles.map((filePath) =>
                  parseFileConflicts(repository.path, filePath)
                )
              );
              enterMergeMode(fileInfos, mergeStatus.theirBranch);
              setShowMergeConflictPanel(true);
              // Switch to merge conflict layout
              const api = getDockviewApi();
              if (api) {
                applyLayout(api, 'merge-conflict');
              }
            } catch (error) {
              console.error('Failed to load conflict info:', error);
            }
          },
        }
      );
    }

    // Reset toast flag when merge is resolved
    if (!mergeStatus?.inMerge || mergeStatus.conflictingFiles.length === 0) {
      hasShownMergeToast.current = false;
    }
  }, [mergeStatus, showMergeConflictPanel, isMergeActive, repository, enterMergeMode, setShowMergeConflictPanel, toast]);

  // Count total uncommitted files
  const uncommittedCount = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

  // Show merge indicator when in merge state
  const hasConflicts = mergeStatus?.inMerge && mergeStatus.conflictingFiles.length > 0;

  // Update window title when repository changes
  useEffect(() => {
    const updateTitle = async () => {
      const window = getCurrentWindow();
      if (repository) {
        await window.setTitle(repository.name);
      } else {
        await window.setTitle('Diffy');
      }
    };
    updateTitle();
  }, [repository]);

  const handleSelectRepo = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Git Repository',
      });

      if (selected && typeof selected === 'string') {
        setIsLoading(true);
        setError(null);

        try {
          const repo = await openRepository(selected);
          setRepository(repo);
        } catch {
          try {
            const repo = await discoverRepository(selected);
            setRepository(repo);
          } catch (e) {
            setError(`Not a git repository: ${selected}`);
          }
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, [setRepository, setError, setIsLoading]);

  const handleViewChange = (newValue: string[]) => {
    if (newValue.length > 0) {
      const view = newValue[0] as ViewMode;
      setMainView(view);

      const api = getDockviewApi();
      if (api) {
        if (view === 'history') {
          applyLayout(api, 'standard');
        } else if (view === 'changes') {
          setSelectedCommit(null);
          applyLayout(api, 'changes');
        }
      }
    }
  };

  const toggleButtonClass =
    'flex items-center gap-1.5 px-3 py-1 text-text-muted transition-colors data-[pressed]:bg-bg-hover data-[pressed]:text-text-primary hover:text-text-primary text-xs';

  return (
    <div
      data-tauri-drag-region
      className="relative flex items-center justify-center pl-[78px] pr-3 h-[38px] bg-bg-tertiary border-b border-border-primary select-none"
    >
      {/* Merge conflict indicator - positioned left */}
      {hasConflicts && (
        <div className="absolute left-[78px] flex items-center">
          <button
            onClick={async () => {
              if (!repository || !mergeStatus) return;
              try {
                const fileInfos = await Promise.all(
                  mergeStatus.conflictingFiles.map((filePath) =>
                    parseFileConflicts(repository.path, filePath)
                  )
                );
                enterMergeMode(fileInfos, mergeStatus.theirBranch);
                setShowMergeConflictPanel(true);
                const api = getDockviewApi();
                if (api) {
                  applyLayout(api, 'merge-conflict');
                }
              } catch (error) {
                console.error('Failed to load conflict info:', error);
              }
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-yellow/20 text-xs hover:bg-accent-yellow/30 transition-colors"
            title="Click to resolve merge conflicts"
          >
            <Warning size={14} weight="fill" className="text-accent-yellow" />
            <span className="text-accent-yellow font-medium">
              {mergeStatus.conflictingFiles.length} conflict{mergeStatus.conflictingFiles.length > 1 ? 's' : ''}
            </span>
          </button>
        </div>
      )}

      {/* Center - Toggle group with project selector and view modes */}
      <div className="flex items-center border border-border-primary rounded bg-bg-secondary">
        {/* Project selector button - styled like toggle but separate */}
        <button
          onClick={handleSelectRepo}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1 text-text-muted hover:text-text-primary transition-colors text-xs rounded-l border-r border-border-primary"
        >
          <FolderOpen size={14} weight="bold" />
          {isLoading ? (
            <span>Loading...</span>
          ) : repository ? (
            <span className="font-medium">{repository.name}</span>
          ) : (
            <span>Open Repository</span>
          )}
        </button>

        {/* View mode toggle group */}
        {repository && (
          <ToggleGroup
            value={[mainView]}
            onValueChange={handleViewChange}
            className="flex items-center"
          >
            <Toggle
              value="history"
              aria-label="History view"
              className={toggleButtonClass}
            >
              <ClockCounterClockwise size={14} weight="bold" />
              <span className="hidden sm:inline">History</span>
            </Toggle>
            <Toggle
              value="changes"
              aria-label="Changes view"
              className={toggleButtonClass}
            >
              <GitDiff size={14} weight="bold" />
              <span className="hidden sm:inline">Changes</span>
              {uncommittedCount > 0 && (
                <span className="px-1.5 py-0.5 bg-accent-blue text-white text-[10px] rounded-full leading-none">
                  {uncommittedCount}
                </span>
              )}
            </Toggle>
            <Toggle
              value="statistics"
              aria-label="Statistics view"
              className={`${toggleButtonClass} rounded-r`}
            >
              <ChartBar size={14} weight="bold" />
              <span className="hidden sm:inline">Statistics</span>
            </Toggle>
          </ToggleGroup>
        )}
      </div>
    </div>
  );
}
