import React, { useState, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FilePlus,
  PencilSimple,
  Trash,
  ArrowRight,
  Question,
  CaretDown,
  CaretRight,
  Sparkle,
  CircleNotch,
} from '@phosphor-icons/react';
import { getStatus, stageFiles, unstageFiles, createCommit, generateCommitMessage } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';
import type { FileStatus } from '../../../types/git';

const STATUS_COLORS: Record<string, string> = {
  A: 'text-accent-green',
  M: 'text-accent-yellow',
  D: 'text-accent-red',
  R: 'text-accent-purple',
  '?': 'text-accent-green',
};

const StatusIcon = ({ status }: { status: string }) => {
  const color = STATUS_COLORS[status] || 'text-text-muted';
  const iconProps = { size: 14, className: color, weight: 'bold' as const };

  switch (status) {
    case 'A':
      return <FilePlus {...iconProps} />;
    case 'M':
      return <PencilSimple {...iconProps} />;
    case 'D':
      return <Trash {...iconProps} />;
    case 'R':
      return <ArrowRight {...iconProps} />;
    case '?':
      return <FilePlus {...iconProps} />;
    default:
      return <Question {...iconProps} />;
  }
};

// Memoized file row with hover actions
const StagingFileRow = memo(function StagingFileRow({
  file,
  isStaged,
  isSelected,
  onSelect,
  onStage,
  onUnstage,
}: {
  file: FileStatus;
  isStaged: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onStage: () => void;
  onUnstage: () => void;
}) {
  return (
    <div
      className={`flex items-center px-2 py-1 text-sm hover:bg-bg-hover group cursor-pointer ${
        isSelected ? 'bg-accent-blue/20' : ''
      }`}
      onClick={onSelect}
    >
      <span className="w-5 flex items-center justify-center shrink-0">
        <StatusIcon status={file.status} />
      </span>
      <span className="truncate text-text-primary ml-1 flex-1 min-w-0">{file.path}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          isStaged ? onUnstage() : onStage();
        }}
        className="px-1.5 py-0.5 text-xs rounded bg-bg-tertiary hover:bg-bg-hover border border-border-primary opacity-0 group-hover:opacity-100 shrink-0 ml-1"
      >
        {isStaged ? 'Unstage' : 'Stage'}
      </button>
    </div>
  );
});

// Collapsible section header
const SectionHeader = memo(function SectionHeader({
  title,
  count,
  isExpanded,
  onToggle,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-bg-tertiary border-y border-border-primary">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-primary"
      >
        {isExpanded ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
        <span>
          {title} ({count})
        </span>
      </button>
      <button
        onClick={onAction}
        disabled={actionDisabled || count === 0}
        className="text-xs text-accent-blue hover:text-accent-blue/80 disabled:text-text-muted disabled:cursor-not-allowed"
      >
        {actionLabel}
      </button>
    </div>
  );
});

export function StagingSidebar() {
  const { repository } = useGitStore();
  const {
    selectedFile,
    setSelectedFile,
    setSelectedCommit,
    commitMessage,
    setCommitMessage,
    commitDescription,
    setCommitDescription,
    amendPreviousCommit,
    setAmendPreviousCommit,
    clearCommitForm,
  } = useUIStore();
  const queryClient = useQueryClient();

  const [unstagedExpanded, setUnstagedExpanded] = useState(true);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch status
  const { data: status } = useQuery({
    queryKey: ['status', repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Mutations
  const stageMutation = useMutation({
    mutationFn: (paths: string[]) => stageFiles(repository!.path, paths),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['status'] }),
  });

  const unstageMutation = useMutation({
    mutationFn: (paths: string[]) => unstageFiles(repository!.path, paths),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['status'] }),
  });

  const commitMutation = useMutation({
    mutationFn: (message: string) => createCommit(repository!.path, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['working-diff-staged'] });
      queryClient.invalidateQueries({ queryKey: ['working-diff-unstaged'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      clearCommitForm();
      setIsCommitting(false);
    },
    onError: () => {
      setIsCommitting(false);
    },
  });

  // Combine unstaged and untracked files
  const unstagedFiles = status
    ? [...status.unstaged, ...status.untracked]
    : [];
  const stagedFiles = status?.staged ?? [];
  const totalChanges = unstagedFiles.length + stagedFiles.length;

  const handleStageAll = useCallback(() => {
    const paths = unstagedFiles.map((f) => f.path);
    if (paths.length > 0) {
      stageMutation.mutate(paths);
    }
  }, [unstagedFiles, stageMutation]);

  const handleUnstageAll = useCallback(() => {
    const paths = stagedFiles.map((f) => f.path);
    if (paths.length > 0) {
      unstageMutation.mutate(paths);
    }
  }, [stagedFiles, unstageMutation]);

  const handleStageFile = useCallback(
    (path: string) => {
      stageMutation.mutate([path]);
    },
    [stageMutation]
  );

  const handleUnstageFile = useCallback(
    (path: string) => {
      unstageMutation.mutate([path]);
    },
    [unstageMutation]
  );

  const handleCommit = useCallback(() => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;

    setIsCommitting(true);
    const fullMessage = commitDescription.trim()
      ? `${commitMessage.trim()}\n\n${commitDescription.trim()}`
      : commitMessage.trim();
    commitMutation.mutate(fullMessage);
  }, [commitMessage, commitDescription, stagedFiles.length, commitMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit]
  );

  const handleGenerateMessage = useCallback(async () => {
    if (!repository || stagedFiles.length === 0 || isGenerating) return;

    setIsGenerating(true);
    try {
      const message = await generateCommitMessage(repository.path);
      // Split on first newline to separate title from body
      const lines = message.split('\n');
      const title = lines[0] || '';
      const body = lines.slice(1).join('\n').trim();
      setCommitMessage(title);
      if (body) {
        setCommitDescription(body);
      }
    } catch (error) {
      console.error('Failed to generate commit message:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [repository, stagedFiles.length, isGenerating, setCommitMessage, setCommitDescription]);

  const branchName = repository?.head_branch ?? 'main';

  return (
    <div className="w-full flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary">
        <div className="text-sm font-medium text-text-primary">
          {totalChanges} file change{totalChanges !== 1 ? 's' : ''} on{' '}
          <span className="text-accent-green">{branchName}</span>
        </div>
      </div>

      {/* File lists */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Unstaged section */}
        <SectionHeader
          title="Unstaged Files"
          count={unstagedFiles.length}
          isExpanded={unstagedExpanded}
          onToggle={() => setUnstagedExpanded(!unstagedExpanded)}
          actionLabel="Stage All"
          onAction={handleStageAll}
          actionDisabled={stageMutation.isPending}
        />
        {unstagedExpanded && unstagedFiles.length > 0 && (
          <div className="min-h-0 flex-1 overflow-auto">
            {unstagedFiles.map((file) => (
              <StagingFileRow
                key={file.path}
                file={file}
                isStaged={false}
                isSelected={selectedFile === file.path}
                onSelect={() => {
                  setSelectedCommit(null);
                  setSelectedFile(file.path);
                }}
                onStage={() => handleStageFile(file.path)}
                onUnstage={() => {}}
              />
            ))}
          </div>
        )}

        {/* Staged section */}
        <SectionHeader
          title="Staged Files"
          count={stagedFiles.length}
          isExpanded={stagedExpanded}
          onToggle={() => setStagedExpanded(!stagedExpanded)}
          actionLabel="Unstage All"
          onAction={handleUnstageAll}
          actionDisabled={unstageMutation.isPending}
        />
        {stagedExpanded && stagedFiles.length > 0 && (
          <div className="min-h-0 flex-1 overflow-auto">
            {stagedFiles.map((file) => (
              <StagingFileRow
                key={file.path}
                file={file}
                isStaged={true}
                isSelected={selectedFile === file.path}
                onSelect={() => {
                  setSelectedCommit(null);
                  setSelectedFile(file.path);
                }}
                onStage={() => {}}
                onUnstage={() => handleUnstageFile(file.path)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Commit form */}
      <div className="border-t border-border-primary p-3 space-y-2">
        {/* Amend checkbox */}
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={amendPreviousCommit}
            onChange={(e) => setAmendPreviousCommit(e.target.checked)}
            className="rounded border-border-primary bg-bg-tertiary"
          />
          Amend previous commit
        </label>

        {/* Commit message with AI generate button */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Commit message (title)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
          />
          <button
            onClick={handleGenerateMessage}
            disabled={stagedFiles.length === 0 || isGenerating}
            className="px-2 py-1.5 bg-accent-purple text-white rounded text-sm hover:bg-accent-purple/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
            title="Generate commit message with AI"
          >
            {isGenerating ? (
              <CircleNotch size={16} weight="bold" className="animate-spin" />
            ) : (
              <Sparkle size={16} weight="bold" />
            )}
          </button>
        </div>

        {/* Description */}
        <textarea
          placeholder="Description (optional)"
          value={commitDescription}
          onChange={(e) => setCommitDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none resize-none"
        />

        {/* Commit button */}
        <button
          onClick={handleCommit}
          disabled={
            !commitMessage.trim() || stagedFiles.length === 0 || isCommitting
          }
          className="w-full py-2 px-4 bg-accent-green text-white rounded font-medium text-sm hover:bg-accent-green/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
        >
          {isCommitting
            ? 'Committing...'
            : `Commit Changes to ${stagedFiles.length} File${stagedFiles.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
