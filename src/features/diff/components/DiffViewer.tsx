import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parsePatchFiles } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { getCommitDiff, getWorkingDiff } from '../../../lib/tauri';
import { useGitStore } from '../../../stores/git-store';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner, SkeletonDiff } from '../../../components/ui';

export function DiffViewer() {
  const { repository } = useGitStore();
  const { selectedCommit, selectedFile, diffViewMode } = useUIStore();

  // Fetch commit diff
  const { data: commitDiff, isLoading: commitLoading } = useQuery({
    queryKey: ['commit-diff', repository?.path, selectedCommit],
    queryFn: () => getCommitDiff(repository!.path, selectedCommit!),
    enabled: !!repository?.path && !!selectedCommit,
  });

  // Fetch working diff (staged)
  const { data: stagedDiff, isLoading: stagedLoading } = useQuery({
    queryKey: ['working-diff-staged', repository?.path],
    queryFn: () => getWorkingDiff(repository!.path, true),
    enabled: !!repository?.path && !selectedCommit,
  });

  // Fetch working diff (unstaged)
  const { data: unstagedDiff, isLoading: unstagedLoading } = useQuery({
    queryKey: ['working-diff-unstaged', repository?.path],
    queryFn: () => getWorkingDiff(repository!.path, false),
    enabled: !!repository?.path && !selectedCommit,
  });

  const isLoading = commitLoading || stagedLoading || unstagedLoading;

  // Get the appropriate patch
  const patch = useMemo(() => {
    if (selectedCommit && commitDiff) {
      return commitDiff.patch;
    }

    // Combine staged and unstaged diffs for working directory
    const patches: string[] = [];
    if (stagedDiff?.patch) patches.push(stagedDiff.patch);
    if (unstagedDiff?.patch) patches.push(unstagedDiff.patch);
    return patches.join('\n');
  }, [selectedCommit, commitDiff, stagedDiff, unstagedDiff]);

  // Parse patch into file diffs
  const parsedFiles = useMemo(() => {
    if (!patch) return [];
    try {
      const parsed = parsePatchFiles(patch);
      // Flatten all files from all patches
      const files = parsed.flatMap(p => p.files);
      return files;
    } catch (e) {
      console.error('Failed to parse patch:', e);
      return [];
    }
  }, [patch]);

  // Debug logging
  useEffect(() => {
    console.log('DiffViewer state:', {
      selectedCommit,
      selectedFile,
      hasPatch: !!patch,
      patchLength: patch?.length || 0,
      parsedFilesCount: parsedFiles.length,
      // Log full structure of first parsed file
      firstParsedFile: parsedFiles[0],
      firstParsedFileKeys: parsedFiles[0] ? Object.keys(parsedFiles[0]) : []
    });
  }, [selectedCommit, selectedFile, patch, parsedFiles]);

  // Filter to selected file if any
  const filesToShow = useMemo(() => {
    if (!selectedFile) return parsedFiles;

    // The parsed files use `name` and `prevName` properties
    const matched = parsedFiles.filter((f: any) => {
      const name = f.name || '';
      const prevName = f.prevName || '';

      // Direct match
      if (name === selectedFile || prevName === selectedFile) return true;

      // Match without a/ or b/ prefix (git diff format)
      const cleanName = name.replace(/^[ab]\//, '');
      const cleanPrev = prevName.replace(/^[ab]\//, '');
      if (cleanName === selectedFile || cleanPrev === selectedFile) return true;

      return false;
    });

    console.log('Filter debug:', {
      selectedFile,
      allNames: parsedFiles.map((f: any) => ({ name: f.name, prevName: f.prevName })),
      matchedCount: matched.length
    });
    return matched;
  }, [parsedFiles, selectedFile]);

  if (isLoading) {
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

  if (filesToShow.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        {selectedFile ? `No changes in selected file: ${selectedFile}` : 'Select a file to view diff'}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-bg-tertiary">
      {filesToShow.map((fileDiff, index) => (
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
