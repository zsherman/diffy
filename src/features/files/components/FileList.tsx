import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  memo,
  useRef,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VList } from "virtua";
import type { VListHandle } from "virtua";
import {
  getStatus,
  getCommitDiff,
  stageFiles,
  unstageFiles,
  discardChanges,
} from "../../../lib/tauri";
import {
  FileContextMenu,
  StatusLabel,
} from "../../../components/ui";
import { createMountLogger } from "../../../lib/perf";
import {
  useTabsStore,
  useActiveTabState,
  useActiveTabPanels,
} from "../../../stores/tabs-store";
import { useActivePanel, usePanelFontSize } from "../../../stores/ui-store";
import type { FileStatus, DiffFile, CommitInfo } from "../../../types/git";

interface FileItem {
  type: "header" | "file";
  data: string | (FileStatus | DiffFile);
  section?: "staged" | "unstaged" | "untracked" | "commit";
}

// Memoized header row
const HeaderRow = memo(function HeaderRow({ text }: { text: string }) {
  return (
    <div className="px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary uppercase tracking-wider">
      {text}
    </div>
  );
});

// Memoized file row
const FileRow = memo(function FileRow({
  file,
  isSelected,
  isFocused,
  onClick,
  fontSize,
  repoPath,
  section,
  onStage,
  onUnstage,
  onDiscard,
}: {
  file: FileStatus | DiffFile;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (e: React.MouseEvent) => void;
  fontSize: number;
  repoPath: string;
  section?: "staged" | "unstaged" | "untracked" | "commit";
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
}) {
  // Only show staging actions for working directory files (not commit files)
  const stagingActions =
    section && section !== "commit" && onStage && onUnstage && onDiscard
      ? {
          isStaged: section === "staged",
          onStage,
          onUnstage,
          onDiscard,
        }
      : undefined;

  return (
    <FileContextMenu
      relativePath={file.path}
      repoPath={repoPath}
      stagingActions={stagingActions}
    >
      <div
        className={`flex items-center px-2 py-1 cursor-pointer ${
          isFocused
            ? "bg-bg-selected"
            : isSelected
              ? "bg-bg-hover"
              : "hover:bg-bg-hover"
        }`}
        style={{ fontSize: `${fontSize}px` }}
        onClick={onClick}
      >
        <StatusLabel status={file.status} className="shrink-0" />
        <span className="truncate text-text-primary ml-1">{file.path}</span>
        {"additions" in file && file.additions > 0 && (
          <span className="ml-auto text-xs text-accent-green">
            +{file.additions}
          </span>
        )}
        {"deletions" in file && file.deletions > 0 && (
          <span className="ml-1 text-xs text-accent-red">-{file.deletions}</span>
        )}
      </div>
    </FileContextMenu>
  );
});

// Commit header component
const CommitHeader = memo(function CommitHeader({
  commit,
  fontSize,
}: {
  commit: CommitInfo;
  fontSize: number;
}) {
  const date = new Date(commit.time * 1000);
  const formattedDate = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary">
      <div
        className="text-text-primary font-medium mb-1"
        style={{ fontSize: `${fontSize}px` }}
      >
        {commit.summary}
      </div>
      {commit.message !== commit.summary && (
        <div className="text-xs text-text-muted whitespace-pre-wrap mb-2">
          {commit.message.slice(commit.summary.length).trim()}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="font-mono text-accent-blue">{commit.shortId}</span>
        <span>{commit.authorName}</span>
        <span>{formattedDate}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
        <span className="text-accent-green">+{commit.additions}</span>
        <span className="text-accent-red">-{commit.deletions}</span>
        <span>
          {commit.filesChanged} file{commit.filesChanged !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
});

export function FileList() {
  const { repository } = useTabsStore();
  const {
    selectedCommit,
    selectedFile,
    setSelectedFile,
    setViewMode,
    selectedBranch,
  } = useActiveTabState();
  // Use focused hooks - avoids re-render when unrelated state changes
  const { activePanel } = useActivePanel();
  const { setShowDiffPanel } = useActiveTabPanels();
  const panelFontSize = usePanelFontSize();
  const queryClient = useQueryClient();
  const listRef = useRef<VListHandle>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Track mount/unmount for performance debugging
  useEffect(() => createMountLogger("FileList"), []);

  // Get commit info from cache
  const commitInfo = useMemo(() => {
    if (!selectedCommit || !repository?.path) return null;
    const commits = queryClient.getQueryData<CommitInfo[]>([
      "commits",
      repository.path,
      selectedBranch,
    ]);
    return commits?.find((c) => c.id === selectedCommit) ?? null;
  }, [selectedCommit, repository?.path, selectedBranch, queryClient]);

  // Fetch working directory status
  // Long staleTime since file watcher handles invalidation - prevents duplicate fetches on tab switch
  // placeholderData keeps showing previous data during tab switch (smooth transitions)
  const { data: status, isLoading: statusLoading, isFetching: statusFetching } = useQuery({
    queryKey: ["status", repository?.path],
    queryFn: () => getStatus(repository!.path),
    enabled: !!repository?.path && !selectedCommit,
    staleTime: 30000, // 30s - watcher invalidates on changes
    refetchOnMount: false, // Don't refetch if data exists - watcher handles updates
    placeholderData: (previousData) => previousData, // Keep showing previous data during switch
  });

  // Fetch commit files when a commit is selected (only keep file list, discard patch)
  const { data: commitFiles, isLoading: diffLoading } = useQuery({
    queryKey: ["commit-files", repository?.path, selectedCommit],
    queryFn: async () => {
      const diff = await getCommitDiff(repository!.path, selectedCommit!);
      return diff.files; // Only return files, let patch be garbage collected
    },
    enabled: !!repository?.path && !!selectedCommit,
    staleTime: 60000,
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

  // Handlers for context menu actions
  const handleStageFile = useCallback(
    (path: string) => stageMutation.mutate([path]),
    [stageMutation],
  );

  const handleUnstageFile = useCallback(
    (path: string) => unstageMutation.mutate([path]),
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

  // Update view mode based on selection
  useEffect(() => {
    if (selectedCommit) {
      setViewMode("commit");
    } else {
      setViewMode("working");
    }
  }, [selectedCommit, setViewMode]);

  // Build flat list
  const flatList = useMemo<FileItem[]>(() => {
    if (selectedCommit && commitFiles) {
      // Commit view
      const items: FileItem[] = [];
      if (commitFiles.length > 0) {
        items.push({
          type: "header",
          data: `Changed Files (${commitFiles.length})`,
        });
        commitFiles.forEach((f) =>
          items.push({ type: "file", data: f, section: "commit" }),
        );
      }
      return items;
    }

    // Working directory view
    if (!status) return [];

    const items: FileItem[] = [];

    if (status.staged.length > 0) {
      items.push({ type: "header", data: `Staged (${status.staged.length})` });
      status.staged.forEach((f) =>
        items.push({ type: "file", data: f, section: "staged" }),
      );
    }

    if (status.unstaged.length > 0) {
      items.push({
        type: "header",
        data: `Unstaged (${status.unstaged.length})`,
      });
      status.unstaged.forEach((f) =>
        items.push({ type: "file", data: f, section: "unstaged" }),
      );
    }

    if (status.untracked.length > 0) {
      items.push({
        type: "header",
        data: `Untracked (${status.untracked.length})`,
      });
      status.untracked.forEach((f) =>
        items.push({ type: "file", data: f, section: "untracked" }),
      );
    }

    return items;
  }, [status, commitFiles, selectedCommit]);

  // Keyboard navigation
  useEffect(() => {
    if (activePanel !== "files") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < flatList.length && flatList[next].type === "header") {
            next++;
          }
          return Math.min(next, flatList.length - 1);
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && flatList[next].type === "header") {
            next--;
          }
          return Math.max(next, 0);
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === "file") {
          const file = item.data as FileStatus | DiffFile;
          setSelectedFile(file.path);
          setShowDiffPanel(true);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === "file" && item.section) {
          const file = item.data as FileStatus;
          if (item.section === "staged") {
            unstageMutation.mutate([file.path]);
          } else {
            stageMutation.mutate([file.path]);
          }
        }
      } else if (e.key === "u") {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === "file" && item.section === "staged") {
          const file = item.data as FileStatus;
          unstageMutation.mutate([file.path]);
        }
      } else if (e.key === "d") {
        e.preventDefault();
        const item = flatList[focusedIndex];
        if (item && item.type === "file" && item.section === "unstaged") {
          const file = item.data as FileStatus;
          if (confirm(`Discard changes to ${file.path}?`)) {
            discardMutation.mutate([file.path]);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePanel,
    flatList,
    focusedIndex,
    setSelectedFile,
    setShowDiffPanel,
    stageMutation,
    unstageMutation,
    discardMutation,
  ]);

  // Scroll focused item into view
  useEffect(() => {
    listRef.current?.scrollToIndex(focusedIndex, { align: "center" });
  }, [focusedIndex]);

  const handleFileClick = useCallback(
    (e: React.MouseEvent, file: FileStatus | DiffFile, index: number) => {
      e.stopPropagation();
      setFocusedIndex(index);
      setSelectedFile(file.path);
      setShowDiffPanel(true);
    },
    [setSelectedFile, setShowDiffPanel],
  );

  // Show loading state when fetching for the first time (no cached data yet)
  if ((statusLoading || statusFetching) && !status && !selectedCommit) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Loading files...
      </div>
    );
  }

  if (flatList.length === 0 && !statusLoading && !diffLoading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        No changes
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {commitInfo && (
        <CommitHeader commit={commitInfo} fontSize={panelFontSize} />
      )}
      <VList ref={listRef} className="flex-1">
        {flatList.map((item, index) => {
          if (item.type === "header") {
            return (
              <HeaderRow
                key={`header-${item.data}`}
                text={item.data as string}
              />
            );
          }

          const file = item.data as FileStatus | DiffFile;
          return (
            <FileRow
              key={`${item.section ?? 'file'}-${file.path}`}
              file={file}
              isSelected={selectedFile === file.path}
              isFocused={index === focusedIndex}
              onClick={(e) => handleFileClick(e, file, index)}
              fontSize={panelFontSize}
              repoPath={repository?.path ?? ""}
              section={item.section}
              onStage={() => handleStageFile(file.path)}
              onUnstage={() => handleUnstageFile(file.path)}
              onDiscard={() => handleDiscardFile(file.path)}
            />
          );
        })}
      </VList>
    </div>
  );
}
