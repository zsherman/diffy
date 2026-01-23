import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Check, FloppyDisk, GitBranch, ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { ConflictNavigator } from './ConflictNavigator';
import { ConflictPanel } from './ConflictPanel';
import { SideDiffView } from './SideDiffView';
import { AIResolveButton } from './AIResolveButton';
import { useMergeConflictStore } from '../../../stores/merge-conflict-store';
import { useTabsStore } from '../../../stores/tabs-store';
import { useUIStore, getDockviewApi } from '../../../stores/ui-store';
import { useToast } from '../../../components/ui/Toast';
import { Button } from '../../../components/ui/Button';
import { applyLayout } from '../../../lib/layouts';
import {
  saveResolvedFile,
  markFileResolved,
  abortMerge,
  continueMerge,
} from '../../../lib/tauri';
import { getErrorMessage } from '../../../lib/errors';

export function MergeConflictView() {
  const [isCompletingMerge, setIsCompletingMerge] = useState(false);
  const [mergeCompleted, setMergeCompleted] = useState(false);

  const {
    isActive,
    files,
    currentFile,
    resolvedContent,
    notes,
    aiExplanation,
    chooseOurs,
    chooseTheirs,
    setResolvedContent,
    setNotes,
    markFileResolved: markFileResolvedInStore,
    exitMergeMode,
    nextFile,
    prevFile,
  } = useMergeConflictStore();

  const { repository } = useTabsStore();
  const { activePanel, setShowMergeConflictPanel } = useUIStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Keyboard shortcuts
  useEffect(() => {
    if (activePanel !== 'merge-conflict') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+ArrowUp/Down for file navigation
      if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        prevFile();
      } else if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        nextFile();
      }
      // Ctrl+1 for choose ours
      else if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        chooseOurs();
      }
      // Ctrl+2 for choose theirs
      else if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        chooseTheirs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, prevFile, nextFile, chooseOurs, chooseTheirs]);

  // Save and mark file as resolved
  const handleSaveAndResolve = useCallback(async () => {
    if (!repository || !currentFile) return;

    try {
      // Save the resolved content
      await saveResolvedFile(repository.path, currentFile.filePath, resolvedContent);

      // Stage the file to mark it as resolved
      await markFileResolved(repository.path, currentFile.filePath);

      // Remove from store
      markFileResolvedInStore(currentFile.filePath);

      toast.success('File resolved', `${currentFile.filePath} has been saved and staged`);

      // Refresh status
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['merge-status'] });
    } catch (error) {
      toast.error('Failed to save', getErrorMessage(error));
    }
  }, [repository, currentFile, resolvedContent, markFileResolvedInStore, toast, queryClient]);

  // Abort merge
  const handleAbortMerge = useCallback(async () => {
    if (!repository) return;

    if (!confirm('Are you sure you want to abort the merge? All conflict resolutions will be lost.')) {
      return;
    }

    try {
      await abortMerge(repository.path);
      exitMergeMode();
      setShowMergeConflictPanel(false);
      toast.success('Merge aborted', 'The merge has been aborted');
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['merge-status'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (error) {
      toast.error('Failed to abort', getErrorMessage(error));
    }
  }, [repository, exitMergeMode, setShowMergeConflictPanel, toast, queryClient]);

  // Continue/complete merge
  const handleContinueMerge = useCallback(async () => {
    if (!repository || isCompletingMerge) return;

    setIsCompletingMerge(true);
    try {
      console.log('Attempting to complete merge...');
      const result = await continueMerge(repository.path);
      console.log('Merge completed:', result);
      setMergeCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['merge-status'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (error) {
      console.error('Merge failed:', error);
      const errorMsg = getErrorMessage(error);
      toast.error('Failed to complete merge', errorMsg);
      setIsCompletingMerge(false);
    }
  }, [repository, isCompletingMerge, toast, queryClient]);

  // Handle closing after merge is complete
  const handleCloseAfterMerge = useCallback(() => {
    exitMergeMode();
    setShowMergeConflictPanel(false);
    setMergeCompleted(false);
    setIsCompletingMerge(false);
    // Switch back to standard layout
    const api = getDockviewApi();
    if (api) {
      applyLayout(api, 'standard');
    }
  }, [exitMergeMode, setShowMergeConflictPanel]);

  // Close panel
  const handleClose = useCallback(() => {
    exitMergeMode();
    setShowMergeConflictPanel(false);
  }, [exitMergeMode, setShowMergeConflictPanel]);

  // Show success state after merge is completed
  if (mergeCompleted) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="text-center">
          <CheckCircle size={64} weight="fill" className="text-accent-green mx-auto mb-4" />
          <p className="text-text-primary font-medium text-xl">Merge Complete!</p>
          <p className="text-text-muted text-sm mt-2">The merge has been committed successfully</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleCloseAfterMerge}
          className="mt-2"
        >
          Close and Return to Editor
        </Button>
      </div>
    );
  }

  // Show "all resolved" state when files are empty but we might still need to complete merge
  if (!isActive || !currentFile) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="text-center">
          <Check size={48} weight="bold" className="text-accent-green mx-auto mb-3" />
          <p className="text-text-primary font-medium text-lg">All conflicts resolved!</p>
          <p className="text-text-muted text-sm mt-1">Click below to complete the merge</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={handleClose}
          >
            Close Panel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleContinueMerge}
            loading={isCompletingMerge}
            leftIcon={!isCompletingMerge ? <Check size={14} weight="bold" /> : undefined}
            className="bg-accent-green hover:bg-accent-green/90"
          >
            {isCompletingMerge ? 'Completing...' : 'Complete Merge'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Navigator header */}
      <ConflictNavigator />

      {/* Main content - Ours/Theirs + Output on left, AI panel on right */}
      <div className="flex-1 min-h-0 p-3 flex gap-3">
        {/* Left: Ours|Theirs on top, Output on bottom */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {/* Top row: Ours | Theirs side by side */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
            {/* Ours panel */}
            <div className="flex flex-col border border-border-primary rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-accent-blue/10 border-b border-accent-blue/30">
                <div className="flex items-center gap-2">
                  <GitBranch size={14} weight="bold" className="text-accent-blue" />
                  <span className="text-sm font-medium text-accent-blue">Ours</span>
                  <span className="text-xs text-text-muted">Current Branch</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={chooseOurs}
                  className="text-accent-blue hover:bg-accent-blue/20"
                >
                  Use This
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-bg-primary">
                <SideDiffView
                  content={currentFile.oursFull}
                  otherContent={currentFile.theirsFull}
                  side="ours"
                />
              </div>
            </div>

            {/* Theirs panel */}
            <div className="flex flex-col border border-border-primary rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-accent-purple/10 border-b border-accent-purple/30">
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} weight="bold" className="text-accent-purple" />
                  <span className="text-sm font-medium text-accent-purple">Theirs</span>
                  <span className="text-xs text-text-muted">Incoming</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={chooseTheirs}
                  className="text-accent-purple hover:bg-accent-purple/20"
                >
                  Use This
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-bg-primary">
                <SideDiffView
                  content={currentFile.theirsFull}
                  otherContent={currentFile.oursFull}
                  side="theirs"
                />
              </div>
            </div>
          </div>

          {/* Bottom: Output/Resolved editor */}
          <div className="flex-1 min-h-0">
            <ConflictPanel
              type="resolved"
              title="Output"
              subtitle="Edit here"
              content={resolvedContent}
              filePath={currentFile.filePath}
              onChange={(value) => setResolvedContent(currentFile.filePath, value)}
            />
          </div>
        </div>

        {/* Right: AI Resolve panel */}
        <div className="w-80 flex flex-col gap-3 border border-border-primary rounded-md bg-bg-tertiary p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <span>AI Resolve</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-text-muted">Instructions (optional)</label>
              <textarea
                placeholder="e.g., 'Keep both implementations' or 'Prefer the new API'"
                value={notes}
                onChange={(e) => setNotes(currentFile.filePath, e.target.value)}
                className="w-full h-20 px-2.5 py-2 text-sm bg-bg-secondary border border-border-primary rounded-md text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none resize-none"
              />
            </div>

            <AIResolveButton />
          </div>

          {/* AI Explanation */}
          {aiExplanation && (
            <div className="flex flex-col gap-2 border-t border-border-primary pt-3">
              <label className="text-xs font-medium text-accent-purple">AI Reasoning</label>
              <div className="px-2.5 py-2 text-sm bg-bg-secondary border border-accent-purple/30 rounded-md text-text-secondary leading-relaxed max-h-48 overflow-y-auto">
                {aiExplanation}
              </div>
            </div>
          )}

          <div className="text-xs text-text-muted border-t border-border-primary pt-3 mt-auto">
            <p className="mb-2">Keyboard shortcuts:</p>
            <ul className="space-y-1">
              <li><kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px]">Ctrl+1</kbd> Use Ours</li>
              <li><kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px]">Ctrl+2</kbd> Use Theirs</li>
              <li><kbd className="px-1.5 py-0.5 bg-bg-secondary rounded text-[10px]">Ctrl+↑↓</kbd> Navigate files</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-end px-3 py-2.5 bg-bg-tertiary border-t border-border-primary gap-2">
        <Button
          variant="ghost"
          size="md"
          onClick={handleAbortMerge}
          leftIcon={<X size={14} weight="bold" />}
          className="text-accent-red hover:bg-accent-red/10"
        >
          Abort Merge
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={handleSaveAndResolve}
          leftIcon={<FloppyDisk size={14} weight="bold" />}
        >
          Save & Resolve File
        </Button>

        {files.length === 1 && (
          <Button
            variant="primary"
            size="md"
            onClick={handleContinueMerge}
            leftIcon={<Check size={14} weight="bold" />}
            className="bg-accent-green hover:bg-accent-green/90"
          >
            Complete Merge
          </Button>
        )}

        {files.length > 1 && (
          <span className="text-xs text-text-muted ml-2">
            {files.length - 1} more file{files.length > 2 ? 's' : ''} to resolve
          </span>
        )}
      </div>
    </div>
  );
}
