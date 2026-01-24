import { useMemo, memo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { VList } from "virtua";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { CaretRight, CaretDown, File, Warning, FolderOpen, GitDiff } from "@phosphor-icons/react";
import { getFileDiff, getWorkingDiff, getCommitDiff } from "../../../lib/tauri";
import { useTabsStore, useActiveTabState } from "../../../stores/tabs-store";
import { useDiffSettings } from "../../../stores/ui-store";
import { LoadingSpinner, SkeletonDiff, FileContextMenu } from "../../../components/ui";
import { createMountLogger } from "../../../lib/perf";
import { getTheme, isLightTheme } from "../../../lib/themes";

// Threshold for auto-collapsing large diffs
const LARGE_DIFF_THRESHOLD = 500;

// Calculate total lines in a diff
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDiffLineCount(fileDiff: any): number {
  if (!fileDiff?.hunks) return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fileDiff.hunks.reduce((total: number, hunk: any) => {
    return total + (hunk.unifiedLineCount || 0);
  }, 0);
}

// Calculate additions and deletions from hunks
function getDiffStats(fileDiff: any): { additions: number; deletions: number } {
  if (!fileDiff?.hunks) return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  for (const hunk of fileDiff.hunks) {
    additions += hunk.additionCount || 0;
    deletions += hunk.deletionCount || 0;
  }
  return { additions, deletions };
}

// Collapsible file diff wrapper
const CollapsibleFileDiff = memo(function CollapsibleFileDiff({
  fileDiff,
  diffStyle,
  defaultCollapsed,
  fontSize,
  diffsTheme,
  themeType,
  repoPath,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fileDiff: any;
  diffStyle: "split" | "unified";
  defaultCollapsed?: boolean;
  fontSize: number;
  diffsTheme: string;
  themeType: "light" | "dark";
  repoPath: string;
}) {
  const lineCount = getDiffLineCount(fileDiff);
  const isLargeDiff = lineCount > LARGE_DIFF_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(
    defaultCollapsed ?? isLargeDiff,
  );
  const { additions, deletions } = getDiffStats(fileDiff);

  // FileDiffMetadata uses 'name' and 'prevName', not 'newPath'/'oldPath'
  const currentName = (fileDiff.name || "").replace(/^[ab]\//, "");
  const previousName = (fileDiff.prevName || "").replace(/^[ab]\//, "");
  const isRenamed = previousName && previousName !== currentName;
  const displayName = currentName || previousName || "Unknown file";

  return (
    <div className="border-b border-border-primary">
      <FileContextMenu
        relativePath={displayName}
        repoPath={repoPath}
        previousPath={isRenamed ? previousName : undefined}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
        >
          {isCollapsed ? (
            <CaretRight
              size={14}
              weight="bold"
              className="text-text-muted shrink-0"
            />
          ) : (
            <CaretDown
              size={14}
              weight="bold"
              className="text-text-muted shrink-0"
            />
          )}
          <File size={14} weight="bold" className="text-accent-blue shrink-0" />
          {isRenamed ? (
            <span className="text-text-primary text-sm truncate">
              {previousName} <span className="text-text-muted">→</span>{" "}
              {currentName}
            </span>
          ) : (
            <span className="text-text-primary text-sm truncate">
              {displayName}
            </span>
          )}
          <div className="flex-1" />
          {isLargeDiff && isCollapsed && (
            <span className="flex items-center gap-1 text-xs text-accent-yellow mr-2">
              <Warning size={12} weight="bold" />
              Large diff
            </span>
          )}
          <span className="flex items-center gap-2 text-xs shrink-0">
            {deletions > 0 && (
              <span className="text-accent-red">-{deletions}</span>
            )}
            {additions > 0 && (
              <span className="text-accent-green">+{additions}</span>
            )}
          </span>
        </button>
      </FileContextMenu>
      {!isCollapsed && (
        <div
          style={
            { "--diffs-font-size": `${fontSize}px` } as React.CSSProperties
          }
        >
          <FileDiff
            fileDiff={fileDiff}
            options={{
              diffStyle,
              theme: diffsTheme,
              themeType,
              disableFileHeader: true,
            }}
          />
        </div>
      )}
    </div>
  );
});

// Single file diff component that loads its own data
function SingleFileDiff({
  repoPath,
  commitId,
  filePath,
  diffViewMode,
  fontSize,
  diffsTheme,
  themeType,
}: {
  repoPath: string;
  commitId: string;
  filePath: string;
  diffViewMode: "split" | "unified";
  fontSize: number;
  diffsTheme: string;
  themeType: "light" | "dark";
}) {
  const { data: fileDiff, isLoading } = useQuery({
    queryKey: ["file-diff", repoPath, commitId, filePath],
    queryFn: () => getFileDiff(repoPath, commitId, filePath),
    staleTime: 60000,
  });

  const parsedFile = useMemo(() => {
    if (!fileDiff?.patch) return null;
    try {
      const parsed = parsePatchFiles(fileDiff.patch);
      return parsed[0]?.files[0] || null;
    } catch (e) {
      console.error("Failed to parse file diff:", e);
      return null;
    }
  }, [fileDiff]);

  if (isLoading) {
    return (
      <div className="p-4">
        <SkeletonDiff lines={8} />
      </div>
    );
  }

  if (!parsedFile) {
    return (
      <div className="p-4 text-text-muted text-sm">
        No diff available for {filePath}
      </div>
    );
  }

  return (
    <div
      style={{ "--diffs-font-size": `${fontSize}px` } as React.CSSProperties}
    >
      <FileDiff
        fileDiff={parsedFile}
        options={{
          diffStyle: diffViewMode === "split" ? "split" : "unified",
          theme: diffsTheme,
          themeType,
        }}
      />
    </div>
  );
}

export function DiffViewer() {
  const { repository } = useTabsStore();
  const { selectedCommit, selectedFile } = useActiveTabState();
  // Use focused hook - avoids re-render when unrelated UI state changes
  const { theme, diffViewMode, diffFontSize } = useDiffSettings();
  // Get the Shiki theme name for @pierre/diffs and the light/dark mode
  const diffsTheme = getTheme(theme)?.diffsTheme ?? "pierre-dark";
  const themeType = isLightTheme(theme) ? "light" : "dark";

  // Track mount/unmount for performance debugging
  useEffect(() => createMountLogger("DiffViewer"), []);

  // Only fetch working diff when no commit is selected
  const { data: stagedDiff, isLoading: stagedLoading } = useQuery({
    queryKey: ["working-diff-staged", repository?.path],
    queryFn: () => getWorkingDiff(repository!.path, true),
    enabled: !!repository?.path && !selectedCommit,
  });

  const { data: unstagedDiff, isLoading: unstagedLoading } = useQuery({
    queryKey: ["working-diff-unstaged", repository?.path],
    queryFn: () => getWorkingDiff(repository!.path, false),
    enabled: !!repository?.path && !selectedCommit,
  });

  const isWorkingLoading = stagedLoading || unstagedLoading;

  // Parse working diff (only when in working mode)
  const workingParsedFiles = useMemo(() => {
    if (selectedCommit) return [];

    const patches: string[] = [];
    if (stagedDiff?.patch) patches.push(stagedDiff.patch);
    if (unstagedDiff?.patch) patches.push(unstagedDiff.patch);

    if (patches.length === 0) return [];

    try {
      const parsed = parsePatchFiles(patches.join("\n"));
      return parsed.flatMap((p) => p.files);
    } catch (e) {
      console.error("Failed to parse working diff:", e);
      return [];
    }
  }, [selectedCommit, stagedDiff, unstagedDiff]);

  // Filter working files to selected file
  const workingFilesToShow = useMemo(() => {
    if (!selectedFile) return workingParsedFiles.slice(0, 5);

    return workingParsedFiles.filter((f: any) => {
      const name = f.name || "";
      const prevName = f.prevName || "";
      const cleanName = name.replace(/^[ab]\//, "");
      const cleanPrev = prevName.replace(/^[ab]\//, "");
      return (
        name === selectedFile ||
        prevName === selectedFile ||
        cleanName === selectedFile ||
        cleanPrev === selectedFile
      );
    });
  }, [workingParsedFiles, selectedFile]);

  // Fetch full commit diff when a commit is selected (for showing all files)
  const { data: commitDiff, isLoading: commitDiffLoading } = useQuery({
    queryKey: ["commit-diff-full", repository?.path, selectedCommit],
    queryFn: () => getCommitDiff(repository!.path, selectedCommit!),
    enabled: !!repository?.path && !!selectedCommit && !selectedFile,
    staleTime: 60000,
  });

  // Parse commit diff for showing all files
  const commitParsedFiles = useMemo(() => {
    if (!commitDiff?.patch) return [];
    try {
      const parsed = parsePatchFiles(commitDiff.patch);
      return parsed.flatMap((p) => p.files);
    } catch (e) {
      console.error("Failed to parse commit diff:", e);
      return [];
    }
  }, [commitDiff]);

  // Commit mode: render diffs
  if (selectedCommit && repository) {
    // Single file selected - show just that file's diff
    if (selectedFile) {
      return (
        <div className="h-full overflow-auto bg-bg-primary">
          <SingleFileDiff
            repoPath={repository.path}
            commitId={selectedCommit}
            filePath={selectedFile}
            diffViewMode={diffViewMode}
            fontSize={diffFontSize}
            diffsTheme={diffsTheme}
            themeType={themeType}
          />
        </div>
      );
    }

    // No file selected - show all diffs stacked
    if (commitDiffLoading) {
      return (
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center py-3">
            <LoadingSpinner size="sm" message="Loading diffs..." />
          </div>
          <div className="flex-1 overflow-hidden">
            <SkeletonDiff lines={12} />
          </div>
        </div>
      );
    }

    if (commitParsedFiles.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-text-muted">
          No changes in this commit
        </div>
      );
    }

    return (
      <VList className="h-full bg-bg-primary">
        {commitParsedFiles.map((fileDiff: any, index) => (
          <CollapsibleFileDiff
            key={fileDiff.name || fileDiff.prevName || index}
            fileDiff={fileDiff}
            diffStyle={diffViewMode === "split" ? "split" : "unified"}
            fontSize={diffFontSize}
            diffsTheme={diffsTheme}
            themeType={themeType}
            repoPath={repository.path}
          />
        ))}
      </VList>
    );
  }

  // Working mode
  if (isWorkingLoading) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center py-3">
          <LoadingSpinner size="sm" message="Loading diff..." />
        </div>
        <div className="flex-1 overflow-hidden">
          <SkeletonDiff lines={12} />
        </div>
      </div>
    );
  }

  if (workingFilesToShow.length === 0) {
    // Determine the appropriate empty state message
    const isFolder = selectedFile?.endsWith("/");
    
    let icon = <GitDiff size={48} weight="duotone" className="text-text-muted mb-3" />;
    let title = "No working changes";
    let subtitle = "Make changes to files to see them here";
    
    if (selectedFile) {
      if (isFolder) {
        icon = <FolderOpen size={48} weight="duotone" className="text-text-muted mb-3" />;
        title = "Folder selected";
        subtitle = "Select a file to view its changes";
      } else {
        icon = <File size={48} weight="duotone" className="text-text-muted mb-3" />;
        title = "No changes in this file";
        subtitle = "This file has no uncommitted changes";
      }
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        {icon}
        <p className="text-text-primary font-medium mb-1">{title}</p>
        <p className="text-text-muted text-sm">{subtitle}</p>
      </div>
    );
  }

  return (
    <VList className="h-full bg-bg-primary">
      {workingFilesToShow.map((fileDiff: any, index) => (
        <CollapsibleFileDiff
          key={fileDiff.name || fileDiff.prevName || index}
          fileDiff={fileDiff}
          diffStyle={diffViewMode === "split" ? "split" : "unified"}
          fontSize={diffFontSize}
          diffsTheme={diffsTheme}
          themeType={themeType}
          repoPath={repository?.path ?? ""}
        />
      ))}
    </VList>
  );
}
