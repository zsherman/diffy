import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sidebar, FolderOpen, TreeStructure, Warning } from '@phosphor-icons/react';
import { openRepository, discoverRepository, getStatus, getMergeStatus, parseFileConflicts } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore, getDockviewApi } from '../../../stores/ui-store';
import { useMergeConflictStore } from '../../../stores/merge-conflict-store';
import { useToast } from '../../../components/ui/Toast';
import { applyLayout } from '../../../lib/layouts';

export function RepoSelector() {
  const { repository, setRepository, setError, isLoading, setIsLoading } = useGitStore();
  const { showBranchesPanel, toggleBranchesPanel, showStagingSidebar, toggleStagingSidebar, showMergeConflictPanel, setShowMergeConflictPanel } = useUIStore();
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

  return (
    <div
      data-tauri-drag-region
      className="relative flex items-center justify-between pl-[78px] pr-3 h-[38px] bg-bg-tertiary border-b border-border-primary select-none"
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Branches panel toggle */}
        {repository && (
          <button
            onClick={toggleBranchesPanel}
            className={`p-1.5 rounded-md transition-colors ${showBranchesPanel
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'
              }`}
            title="Toggle Branches Panel"
          >
            <TreeStructure size={18} weight={showBranchesPanel ? 'fill' : 'regular'} />
          </button>
        )}

        {/* Merge conflict indicator */}
        {hasConflicts && (
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
                // Switch to merge conflict layout
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
        )}
      </div>

      {/* Center - absolutely positioned for true centering */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        <button
          onClick={handleSelectRepo}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-bg-hover transition-colors text-xs"
        >
          <FolderOpen size={14} weight="duotone" className="text-accent-blue/70" />
          {isLoading ? (
            <span className="text-text-muted">Loading...</span>
          ) : repository ? (
            <span className="text-accent-blue/70 font-medium">{repository.name}</span>
          ) : (
            <span className="text-text-muted">Open Repository</span>
          )}
        </button>

        {/* Path display */}
        {repository && (
          <span
            className="text-xs text-text-muted truncate max-w-[350px] hidden sm:block"
            title={repository.path}
          >
            {repository.path}
          </span>
        )}
      </div>

      {/* Right side */}
      {repository && (
        <div className="relative">
          <button
            onClick={toggleStagingSidebar}
            className={`p-1.5 rounded-md transition-colors ${showStagingSidebar
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'
              }`}
            title="Toggle Staging Sidebar (Cmd+Shift+S)"
          >
            <Sidebar size={18} weight={showStagingSidebar ? 'fill' : 'regular'} />
          </button>
          {uncommittedCount > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold text-[#00d4ff] pointer-events-none">
              {uncommittedCount > 99 ? '99+' : uncommittedCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
