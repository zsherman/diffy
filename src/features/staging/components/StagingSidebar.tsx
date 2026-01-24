import React, { useState, useCallback, memo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import {
  Trash,
  CaretDown,
  CaretRight,
  Sparkle,
  CircleNotch,
  Stack,
  ArrowLineDown,
  ArrowLineUp,
  X,
} from "@phosphor-icons/react";
import {
  getStatus,
  stageFiles,
  unstageFiles,
  discardChanges,
  createCommit,
  generateCommitMessage,
  listStashes,
  createStash,
  applyStash,
  popStash,
  dropStash,
  normalizeError,
  getErrorMessage,
} from "../../../lib/tauri";
import { FileContextMenu, StatusIcon, Input } from "../../../components/ui";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useUIStore } from "../../../stores/ui-store";
import { usePanelFontSize } from "../../../stores/ui-store";
import type { FileStatus, StashEntry } from "../../../types/git";

// Memoized file row with hover actions
const StagingFileRow = memo(function StagingFileRow({
  file,
  isStaged,
  isSelected,
  onSelect,
  onStage,
  onUnstage,
  onDiscard,
  repoPath,
  fontSize,
}: {
  file: FileStatus;
  isStaged: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  repoPath: string;
  fontSize: number;
}) {
  return (
    <FileContextMenu
      relativePath={file.path}
      repoPath={repoPath}
      stagingActions={{
        isStaged,
        onStage,
        onUnstage,
        onDiscard,
      }}
    >
      <div
        className={`flex items-center px-2 py-1 hover:bg-bg-hover group cursor-pointer ${
          isSelected ? "bg-accent-blue/20" : ""
        }`}
        style={{ fontSize: `${fontSize}px` }}
        onClick={onSelect}
      >
        <span className="w-5 flex items-center justify-center shrink-0">
          <StatusIcon status={file.status} />
        </span>
        <span className="truncate text-text-primary ml-1 flex-1 min-w-0">
          {file.path}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isStaged) {
                onUnstage();
              } else {
                onStage();
              }
            }}
            className="px-1.5 py-0.5 text-xs rounded-sm bg-bg-tertiary hover:bg-bg-hover border border-border-primary cursor-pointer"
          >
            {isStaged ? "Unstage" : "Stage"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            className="px-1.5 py-0.5 text-xs rounded-sm bg-accent-red/20 hover:bg-accent-red/30 border border-accent-red/30 cursor-pointer"
            title="Discard changes"
          >
            <Trash size={12} weight="bold" className="text-accent-red" />
          </button>
        </div>
      </div>
    </FileContextMenu>
  );
});

// Memoized stash row with actions
const StashRow = memo(function StashRow({
  stash,
  onApply,
  onPop,
  onDrop,
  fontSize,
  isLoading,
}: {
  stash: StashEntry;
  onApply: () => void;
  onPop: () => void;
  onDrop: () => void;
  fontSize: number;
  isLoading: boolean;
}) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="flex items-center px-2 py-1.5 hover:bg-bg-hover group"
      style={{ fontSize: `${fontSize}px` }}
    >
      <span className="w-5 flex items-center justify-center shrink-0">
        <Stack size={14} className="text-accent-purple" weight="bold" />
      </span>
      <div className="flex-1 min-w-0 ml-1">
        <div className="truncate text-text-primary">
          stash@{"{" + stash.stashIndex + "}"}
        </div>
        <div className="truncate text-text-muted text-xs">{stash.message}</div>
        <div className="text-text-muted text-xs opacity-70">
          {formatTime(stash.time)}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApply();
          }}
          disabled={isLoading}
          className="px-1.5 py-0.5 text-xs rounded-sm bg-bg-tertiary hover:bg-bg-hover border border-border-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Apply stash (keep in list)"
        >
          <ArrowLineDown size={12} weight="bold" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPop();
          }}
          disabled={isLoading}
          className="px-1.5 py-0.5 text-xs rounded-sm bg-accent-green/20 hover:bg-accent-green/30 border border-accent-green/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Pop stash (apply & remove)"
        >
          <ArrowLineUp size={12} weight="bold" className="text-accent-green" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (
              confirm(
                `Delete stash@{${stash.stashIndex}}? This cannot be undone.`,
              )
            ) {
              onDrop();
            }
          }}
          disabled={isLoading}
          className="px-1.5 py-0.5 text-xs rounded-sm bg-accent-red/20 hover:bg-accent-red/30 border border-accent-red/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Drop stash (delete)"
        >
          <X size={12} weight="bold" className="text-accent-red" />
        </button>
      </div>
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
  disableActionOnEmpty = true,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  disableActionOnEmpty?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-bg-tertiary border-y border-border-primary">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-primary cursor-pointer"
      >
        {isExpanded ? (
          <CaretDown size={12} weight="bold" />
        ) : (
          <CaretRight size={12} weight="bold" />
        )}
        <span>
          {title} ({count})
        </span>
      </button>
      <button
        onClick={onAction}
        disabled={actionDisabled || (disableActionOnEmpty && count === 0)}
        className="text-xs text-accent-blue hover:text-accent-blue/80 cursor-pointer disabled:text-text-muted disabled:cursor-not-allowed"
      >
        {actionLabel}
      </button>
    </div>
  );
});

export function StagingSidebar() {
  const { repository } = useTabsStore();
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
  } = useActiveTabState();
  const { cliStatus } = useUIStore();
  const panelFontSize = usePanelFontSize();

  // Check if Claude CLI is available for commit message generation
  const claudeAvailable = cliStatus?.claude.available ?? true; // Assume available until checked
  const queryClient = useQueryClient();

  const [unstagedExpanded, setUnstagedExpanded] = useState(true);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [stashesExpanded, setStashesExpanded] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStashing, setIsStashing] = useState(false);
  const [showStashInput, setShowStashInput] = useState(false);
  const [stashMessage, setStashMessage] = useState("");

  // Fetch status
  // Long staleTime since file watcher handles invalidation - prevents duplicate fetches on tab switch
  const { data: status, refetch } = useQuery({
    queryKey: ["status", repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path,
    staleTime: 30000, // 30s - watcher invalidates on changes
    refetchOnMount: false, // Don't refetch if data exists - watcher handles updates
    refetchOnWindowFocus: false, // Watcher handles this
  });

  // Force refetch when panel mounts to ensure fresh data
  useEffect(() => {
    if (repository?.path) {
      refetch();
    }
  }, [repository?.path, refetch]);

  // Fetch stashes - safety refetch at longer interval
  const { data: stashes } = useQuery({
    queryKey: ["stashes", repository?.path],
    queryFn: () => listStashes(repository!.path),
    enabled: !!repository?.path,
    refetchInterval: 30000, // Reduced: stash list changes rarely
    staleTime: 10000,
  });

  // Mutations - scope invalidations to this repo only
  const repoPath = repository?.path;

  const stageMutation = useMutation({
    mutationFn: (paths: string[]) => stageFiles(repository!.path, paths),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["status", repoPath] }),
  });

  const unstageMutation = useMutation({
    mutationFn: (paths: string[]) => unstageFiles(repository!.path, paths),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["status", repoPath] }),
  });

  const discardMutation = useMutation({
    mutationFn: (paths: string[]) => discardChanges(repository!.path, paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status", repoPath] });
      queryClient.invalidateQueries({
        queryKey: ["working-diff-staged", repoPath],
      });
      queryClient.invalidateQueries({
        queryKey: ["working-diff-unstaged", repoPath],
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: (message: string) => createCommit(repository!.path, message),
    onSuccess: () => {
      // Scope invalidations to this repo only
      queryClient.invalidateQueries({
        queryKey: ["status", repoPath],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["commits", repoPath],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["graph", repoPath],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["working-diff-staged", repoPath],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["working-diff-unstaged", repoPath],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["branches", repoPath],
        refetchType: "all",
      });
      clearCommitForm();
      setIsCommitting(false);
    },
    onError: () => {
      setIsCommitting(false);
    },
  });

  // Stash invalidation helper - scoped to this repo
  const invalidateAfterStash = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["status", repoPath],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["stashes", repoPath],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["working-diff-staged", repoPath],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["working-diff-unstaged", repoPath],
      refetchType: "all",
    });
  }, [queryClient, repoPath]);

  const createStashMutation = useMutation({
    mutationFn: (message?: string) => createStash(repository!.path, message),
    onSuccess: () => {
      invalidateAfterStash();
      setShowStashInput(false);
      setStashMessage("");
      setIsStashing(false);
    },
    onError: (error) => {
      setIsStashing(false);
      alert(getErrorMessage(normalizeError(error)));
    },
  });

  const applyStashMutation = useMutation({
    mutationFn: (stashIndex: number) =>
      applyStash(repository!.path, stashIndex),
    onSuccess: invalidateAfterStash,
    onError: (error) => {
      alert(getErrorMessage(normalizeError(error)));
    },
  });

  const popStashMutation = useMutation({
    mutationFn: (stashIndex: number) => popStash(repository!.path, stashIndex),
    onSuccess: invalidateAfterStash,
    onError: (error) => {
      alert(getErrorMessage(normalizeError(error)));
    },
  });

  const dropStashMutation = useMutation({
    mutationFn: (stashIndex: number) => dropStash(repository!.path, stashIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["stashes", repoPath],
        refetchType: "all",
      });
    },
    onError: (error) => {
      alert(getErrorMessage(normalizeError(error)));
    },
  });

  // Combine unstaged and untracked files
  const unstagedFiles = status ? [...status.unstaged, ...status.untracked] : [];
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
    [stageMutation],
  );

  const handleUnstageFile = useCallback(
    (path: string) => {
      unstageMutation.mutate([path]);
    },
    [unstageMutation],
  );

  const handleDiscardFile = useCallback(
    (path: string) => {
      if (confirm(`Discard changes to ${path}? This cannot be undone.`)) {
        discardMutation.mutate([path]);
      }
    },
    [discardMutation],
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
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit],
  );

  const handleGenerateMessage = useCallback(async () => {
    if (!repository || stagedFiles.length === 0 || isGenerating) return;

    setIsGenerating(true);
    try {
      const message = await generateCommitMessage(repository.path);
      // Split on first newline to separate title from body
      const lines = message.split("\n");
      const title = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      setCommitMessage(title);
      if (body) {
        setCommitDescription(body);
      }
    } catch (error) {
      console.error("Failed to generate commit message:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [
    repository,
    stagedFiles.length,
    isGenerating,
    setCommitMessage,
    setCommitDescription,
  ]);

  const handleCreateStash = useCallback(() => {
    if (totalChanges === 0 || isStashing) return;
    setIsStashing(true);
    createStashMutation.mutate(stashMessage || undefined);
  }, [totalChanges, isStashing, stashMessage, createStashMutation]);

  const handleStashKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreateStash();
      } else if (e.key === "Escape") {
        setShowStashInput(false);
        setStashMessage("");
      }
    },
    [handleCreateStash],
  );

  const isStashMutating =
    applyStashMutation.isPending ||
    popStashMutation.isPending ||
    dropStashMutation.isPending;

  const branchName = repository?.headBranch ?? "main";

  return (
    <div className="w-full flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary">
        <div
          className="font-medium text-text-primary"
          style={{ fontSize: `${panelFontSize}px` }}
        >
          {totalChanges} file change{totalChanges !== 1 ? "s" : ""} on{" "}
          <span className="text-accent-green">{branchName}</span>
        </div>
      </div>

      <PanelGroup orientation="vertical" id="staging-sidebar-layout">
        <Panel defaultSize={70} minSize={20}>
          {/* File lists */}
          <div className="h-full overflow-hidden flex flex-col">
            {/* Stashes section */}
            <SectionHeader
              title="Stashes"
              count={stashes?.length ?? 0}
              isExpanded={stashesExpanded}
              onToggle={() => setStashesExpanded(!stashesExpanded)}
              actionLabel="Stash..."
              onAction={() => setShowStashInput(true)}
              actionDisabled={totalChanges === 0 || isStashing}
              disableActionOnEmpty={false}
            />
            {stashesExpanded && (
              <div className="min-h-0 shrink-0">
                {/* Stash input */}
                {showStashInput && (
                  <div className="px-2 py-2 border-b border-border-primary bg-bg-tertiary">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Stash message (optional)"
                        value={stashMessage}
                        onChange={(e) => setStashMessage(e.target.value)}
                        onKeyDown={handleStashKeyDown}
                        autoFocus
                        size="sm"
                        className="flex-1"
                        style={{ fontSize: `${panelFontSize}px` }}
                      />
                      <button
                        onClick={handleCreateStash}
                        disabled={isStashing}
                        className="px-3 py-1 bg-accent-purple text-white rounded-sm text-xs hover:bg-accent-purple/90 cursor-pointer disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed"
                      >
                        {isStashing ? (
                          <CircleNotch size={14} className="animate-spin" />
                        ) : (
                          "Stash"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowStashInput(false);
                          setStashMessage("");
                        }}
                        className="px-2 py-1 bg-bg-secondary border border-border-primary rounded-sm text-text-muted hover:text-text-primary cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                {/* Stash list */}
                {stashes && stashes.length > 0 ? (
                  <div className="max-h-40 overflow-auto">
                    {stashes.map((stash) => (
                      <StashRow
                        key={stash.oid}
                        stash={stash}
                        onApply={() =>
                          applyStashMutation.mutate(stash.stashIndex)
                        }
                        onPop={() => popStashMutation.mutate(stash.stashIndex)}
                        onDrop={() =>
                          dropStashMutation.mutate(stash.stashIndex)
                        }
                        fontSize={panelFontSize}
                        isLoading={isStashMutating}
                      />
                    ))}
                  </div>
                ) : (
                  !showStashInput && (
                    <div
                      className="px-2 py-2 text-text-muted text-center"
                      style={{ fontSize: `${panelFontSize}px` }}
                    >
                      No stashes
                    </div>
                  )
                )}
              </div>
            )}

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
                    key={`unstaged-${file.path}`}
                    file={file}
                    isStaged={false}
                    isSelected={selectedFile === file.path}
                    onSelect={() => {
                      setSelectedCommit(null);
                      setSelectedFile(file.path);
                    }}
                    onStage={() => handleStageFile(file.path)}
                    onUnstage={() => {}}
                    onDiscard={() => handleDiscardFile(file.path)}
                    repoPath={repository?.path ?? ""}
                    fontSize={panelFontSize}
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
                    key={`staged-${file.path}`}
                    file={file}
                    isStaged={true}
                    isSelected={selectedFile === file.path}
                    onSelect={() => {
                      setSelectedCommit(null);
                      setSelectedFile(file.path);
                    }}
                    onStage={() => {}}
                    onUnstage={() => handleUnstageFile(file.path)}
                    onDiscard={() => handleDiscardFile(file.path)}
                    repoPath={repository?.path ?? ""}
                    fontSize={panelFontSize}
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-border-primary hover:bg-accent-blue transition-colors cursor-row-resize" />

        <Panel defaultSize={30} minSize={15}>
          {/* Commit form */}
          <div className="h-full flex flex-col p-3 gap-2">
            {/* Amend checkbox */}
            <label
              className="flex items-center gap-2 text-text-muted cursor-pointer shrink-0"
              style={{ fontSize: `${panelFontSize}px` }}
            >
              <input
                type="checkbox"
                checked={amendPreviousCommit}
                onChange={(e) => setAmendPreviousCommit(e.target.checked)}
                className="rounded-sm border-border-primary bg-bg-tertiary"
              />
              Amend previous commit
            </label>

            {/* Commit message with AI generate button */}
            <div className="flex gap-2 shrink-0">
              <Input
                placeholder="Commit message (title)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                size="sm"
                className="flex-1"
                style={{ fontSize: `${panelFontSize}px` }}
              />
              <button
                onClick={handleGenerateMessage}
                disabled={
                  stagedFiles.length === 0 || isGenerating || !claudeAvailable
                }
                className="px-2 py-1.5 bg-accent-purple text-white rounded-sm text-xs hover:bg-accent-purple/90 cursor-pointer disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                title={
                  !claudeAvailable
                    ? `Claude CLI not installed: ${cliStatus?.claude.installInstructions}`
                    : "Generate commit message with AI"
                }
              >
                {isGenerating ? (
                  <CircleNotch
                    size={16}
                    weight="bold"
                    className="animate-spin"
                  />
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
              className="flex-1 min-h-0 w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-hidden resize-none"
              style={{ fontSize: `${panelFontSize}px` }}
            />

            {/* Commit button */}
            <button
              onClick={handleCommit}
              disabled={
                !commitMessage.trim() ||
                stagedFiles.length === 0 ||
                isCommitting
              }
              className="w-full py-2 px-4 bg-accent-blue text-white rounded-sm font-medium hover:bg-accent-blue/90 cursor-pointer disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors shrink-0"
              style={{ fontSize: `${panelFontSize}px` }}
            >
              {isCommitting
                ? "Committing..."
                : `Commit Changes to ${stagedFiles.length} File${stagedFiles.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
