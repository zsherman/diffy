import { CaretLeft, CaretRight, File, Warning } from '@phosphor-icons/react';
import { useMergeConflictStore } from '../../../stores/merge-conflict-store';

export function ConflictNavigator() {
  const {
    files,
    currentFileIndex,
    currentConflictIndex,
    currentFile,
    prevFile,
    nextFile,
    prevConflict,
    nextConflict,
    theirBranch,
  } = useMergeConflictStore();

  const totalFiles = files.length;
  const totalConflicts = currentFile?.conflicts.length ?? 0;

  // Calculate overall progress
  const resolvedFiles = 0; // Will be calculated from actual resolved state
  const progressPercent = totalFiles > 0 ? Math.round((resolvedFiles / totalFiles) * 100) : 0;

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-b border-border-primary">
      {/* Left: File path and merge info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 text-accent-yellow">
          <Warning size={16} weight="fill" />
          <span className="text-xs font-medium">MERGE CONFLICT</span>
        </div>

        {currentFile && (
          <div className="flex items-center gap-2 min-w-0">
            <File size={14} className="text-text-muted shrink-0" />
            <span className="text-sm text-text-primary truncate" title={currentFile.filePath}>
              {currentFile.filePath}
            </span>
          </div>
        )}

        {theirBranch && (
          <span className="text-xs text-text-muted">
            merging <span className="text-accent-blue">{theirBranch}</span>
          </span>
        )}
      </div>

      {/* Center: Conflict navigation */}
      <div className="flex items-center gap-4">
        {/* File navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevFile}
            disabled={currentFileIndex === 0}
            className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous file (Ctrl+Shift+ArrowUp)"
          >
            <CaretLeft size={14} className="text-text-muted" />
          </button>
          <span className="text-xs text-text-muted min-w-[60px] text-center">
            File {currentFileIndex + 1} / {totalFiles}
          </span>
          <button
            onClick={nextFile}
            disabled={currentFileIndex >= totalFiles - 1}
            className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next file (Ctrl+Shift+ArrowDown)"
          >
            <CaretRight size={14} className="text-text-muted" />
          </button>
        </div>

        {/* Conflict navigation within file */}
        {totalConflicts > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={prevConflict}
              disabled={currentConflictIndex === 0}
              className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous conflict (Ctrl+ArrowUp)"
            >
              <CaretLeft size={14} className="text-text-muted" />
            </button>
            <span className="text-xs text-text-muted min-w-[80px] text-center">
              Conflict {currentConflictIndex + 1} / {totalConflicts}
            </span>
            <button
              onClick={nextConflict}
              disabled={currentConflictIndex >= totalConflicts - 1}
              className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next conflict (Ctrl+ArrowDown)"
            >
              <CaretRight size={14} className="text-text-muted" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Progress bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">{progressPercent}% resolved</span>
        <div className="w-24 h-1.5 bg-bg-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-green transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
