import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parsePatchFiles } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { getFileDiff, getWorkingDiff } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner, SkeletonDiff } from '../../../components/ui';

// Single file diff component that loads its own data
function SingleFileDiff({
  repoPath,
  commitId,
  filePath,
  diffViewMode,
}: {
  repoPath: string;
  commitId: string;
  filePath: string;
  diffViewMode: 'split' | 'unified';
}) {
  const { data: fileDiff, isLoading } = useQuery({
    queryKey: ['file-diff', repoPath, commitId, filePath],
    queryFn: () => getFileDiff(repoPath, commitId, filePath),
    staleTime: 60000,
  });

  const parsedFile = useMemo(() => {
    if (!fileDiff?.patch) return null;
    try {
      const parsed = parsePatchFiles(fileDiff.patch);
      return parsed[0]?.files[0] || null;
    } catch (e) {
      console.error('Failed to parse file diff:', e);
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
    <FileDiff
      fileDiff={parsedFile}
      options={{
        diffStyle: diffViewMode === 'split' ? 'split' : 'unified',
        themeType: 'dark',
      }}
    />
  );
}

export function DiffViewer() {
  const { repository } = useGitStore();
  const { selectedCommit, selectedFile, diffViewMode } = useUIStore();

  // Only fetch working diff when no commit is selected
  const { data: stagedDiff, isLoading: stagedLoading } = useQuery({
    queryKey: ['working-diff-staged', repository?.path],
    queryFn: () => getWorkingDiff(repository!.path, true),
    enabled: !!repository?.path && !selectedCommit,
  });

  const { data: unstagedDiff, isLoading: unstagedLoading } = useQuery({
    queryKey: ['working-diff-unstaged', repository?.path],
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
      const parsed = parsePatchFiles(patches.join('\n'));
      return parsed.flatMap(p => p.files);
    } catch (e) {
      console.error('Failed to parse working diff:', e);
      return [];
    }
  }, [selectedCommit, stagedDiff, unstagedDiff]);

  // Filter working files to selected file
  const workingFilesToShow = useMemo(() => {
    if (!selectedFile) return workingParsedFiles.slice(0, 5);

    return workingParsedFiles.filter((f: any) => {
      const name = f.name || '';
      const prevName = f.prevName || '';
      const cleanName = name.replace(/^[ab]\//, '');
      const cleanPrev = prevName.replace(/^[ab]\//, '');
      return name === selectedFile || prevName === selectedFile ||
             cleanName === selectedFile || cleanPrev === selectedFile;
    });
  }, [workingParsedFiles, selectedFile]);

  // Commit mode: render individual file diff loaders
  if (selectedCommit && repository) {
    if (!selectedFile) {
      return (
        <div className="flex items-center justify-center h-full text-text-muted">
          Select a file to view diff
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto bg-bg-tertiary">
        <SingleFileDiff
          repoPath={repository.path}
          commitId={selectedCommit}
          filePath={selectedFile}
          diffViewMode={diffViewMode}
        />
      </div>
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
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        {selectedFile ? `No changes in selected file` : 'No working changes'}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-bg-tertiary">
      {workingFilesToShow.map((fileDiff, index) => (
        <FileDiff
          key={fileDiff.newPath || fileDiff.oldPath || index}
          fileDiff={fileDiff}
          options={{
            diffStyle: diffViewMode === 'split' ? 'split' : 'unified',
            themeType: 'dark',
          }}
        />
      ))}
    </div>
  );
}
