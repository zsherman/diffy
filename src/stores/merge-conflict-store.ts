import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { produce } from 'immer';
import type { FileConflictInfo } from '../features/merge-conflict/types';

// Operation type - which git operation caused the conflicts
export type ConflictOperation = 'merge' | 'rebase';

interface MergeConflictContext {
  // Active state
  isActive: boolean;

  // Operation type (merge or rebase)
  operation: ConflictOperation;

  // Files with conflicts
  files: FileConflictInfo[];
  currentFileIndex: number;
  currentConflictIndex: number;

  // Resolved content by file path
  resolvedByFile: Record<string, string>;

  // User notes by file path (for AI context)
  notesByFile: Record<string, string>;

  // AI resolution state
  isAIResolving: boolean;
  aiError: string | null;

  // AI explanation by file path
  aiExplanationByFile: Record<string, string>;

  // Other ref label (for display)
  // For merge: "their branch name"
  // For rebase: "onto ref"
  otherRefLabel: string | null;
}

export const mergeConflictStore = createStore({
  context: {
    isActive: false,
    operation: 'merge',
    files: [],
    currentFileIndex: 0,
    currentConflictIndex: 0,
    resolvedByFile: {},
    notesByFile: {},
    isAIResolving: false,
    aiError: null,
    aiExplanationByFile: {},
    otherRefLabel: null,
  } as MergeConflictContext,
  on: {
    enterConflictMode: (
      ctx,
      event: { 
        files: FileConflictInfo[]; 
        otherRefLabel: string | null;
        operation: ConflictOperation;
      }
    ) =>
      produce(ctx, (draft) => {
        draft.isActive = true;
        draft.operation = event.operation;
        draft.files = event.files;
        draft.otherRefLabel = event.otherRefLabel;
        draft.currentFileIndex = 0;
        draft.currentConflictIndex = 0;
        // Initialize resolved content with the original content (with markers)
        draft.resolvedByFile = {};
        for (const file of event.files) {
          draft.resolvedByFile[file.filePath] = file.originalContent;
        }
        draft.notesByFile = {};
        draft.aiError = null;
        draft.aiExplanationByFile = {};
      }),

    // Legacy action for backward compatibility
    enterMergeMode: (
      ctx,
      event: { files: FileConflictInfo[]; theirBranch: string | null }
    ) =>
      produce(ctx, (draft) => {
        draft.isActive = true;
        draft.operation = 'merge';
        draft.files = event.files;
        draft.otherRefLabel = event.theirBranch;
        draft.currentFileIndex = 0;
        draft.currentConflictIndex = 0;
        // Initialize resolved content with the original content (with markers)
        draft.resolvedByFile = {};
        for (const file of event.files) {
          draft.resolvedByFile[file.filePath] = file.originalContent;
        }
        draft.notesByFile = {};
        draft.aiError = null;
        draft.aiExplanationByFile = {};
      }),

    exitConflictMode: (ctx) =>
      produce(ctx, (draft) => {
        draft.isActive = false;
        draft.operation = 'merge';
        draft.files = [];
        draft.currentFileIndex = 0;
        draft.currentConflictIndex = 0;
        draft.resolvedByFile = {};
        draft.notesByFile = {};
        draft.isAIResolving = false;
        draft.aiError = null;
        draft.aiExplanationByFile = {};
        draft.otherRefLabel = null;
      }),

    // Legacy action for backward compatibility
    exitMergeMode: (ctx) =>
      produce(ctx, (draft) => {
        draft.isActive = false;
        draft.operation = 'merge';
        draft.files = [];
        draft.currentFileIndex = 0;
        draft.currentConflictIndex = 0;
        draft.resolvedByFile = {};
        draft.notesByFile = {};
        draft.isAIResolving = false;
        draft.aiError = null;
        draft.aiExplanationByFile = {};
        draft.otherRefLabel = null;
      }),

    nextFile: (ctx) =>
      produce(ctx, (draft) => {
        if (draft.currentFileIndex < draft.files.length - 1) {
          draft.currentFileIndex++;
          draft.currentConflictIndex = 0;
        }
      }),

    prevFile: (ctx) =>
      produce(ctx, (draft) => {
        if (draft.currentFileIndex > 0) {
          draft.currentFileIndex--;
          draft.currentConflictIndex = 0;
        }
      }),

    setCurrentFile: (ctx, event: { index: number }) =>
      produce(ctx, (draft) => {
        if (event.index >= 0 && event.index < draft.files.length) {
          draft.currentFileIndex = event.index;
          draft.currentConflictIndex = 0;
        }
      }),

    nextConflict: (ctx) =>
      produce(ctx, (draft) => {
        const currentFile = draft.files[draft.currentFileIndex];
        if (currentFile && draft.currentConflictIndex < currentFile.conflicts.length - 1) {
          draft.currentConflictIndex++;
        }
      }),

    prevConflict: (ctx) =>
      produce(ctx, (draft) => {
        if (draft.currentConflictIndex > 0) {
          draft.currentConflictIndex--;
        }
      }),

    setCurrentConflict: (ctx, event: { index: number }) =>
      produce(ctx, (draft) => {
        const currentFile = draft.files[draft.currentFileIndex];
        if (currentFile && event.index >= 0 && event.index < currentFile.conflicts.length) {
          draft.currentConflictIndex = event.index;
        }
      }),

    chooseOurs: (ctx) =>
      produce(ctx, (draft) => {
        const currentFile = draft.files[draft.currentFileIndex];
        if (currentFile) {
          draft.resolvedByFile[currentFile.filePath] = currentFile.oursFull;
        }
      }),

    chooseTheirs: (ctx) =>
      produce(ctx, (draft) => {
        const currentFile = draft.files[draft.currentFileIndex];
        if (currentFile) {
          draft.resolvedByFile[currentFile.filePath] = currentFile.theirsFull;
        }
      }),

    resetToConflicted: (ctx) =>
      produce(ctx, (draft) => {
        const currentFile = draft.files[draft.currentFileIndex];
        if (currentFile) {
          draft.resolvedByFile[currentFile.filePath] = currentFile.originalContent;
        }
      }),

    setResolvedContent: (ctx, event: { filePath: string; content: string }) =>
      produce(ctx, (draft) => {
        draft.resolvedByFile[event.filePath] = event.content;
      }),

    setNotes: (ctx, event: { filePath: string; notes: string }) =>
      produce(ctx, (draft) => {
        draft.notesByFile[event.filePath] = event.notes;
      }),

    setAIResolving: (ctx, event: { resolving: boolean }) =>
      produce(ctx, (draft) => {
        draft.isAIResolving = event.resolving;
        if (event.resolving) {
          draft.aiError = null;
        }
      }),

    setAIError: (ctx, event: { error: string | null }) =>
      produce(ctx, (draft) => {
        draft.aiError = event.error;
      }),

    setAIExplanation: (ctx, event: { filePath: string; explanation: string }) =>
      produce(ctx, (draft) => {
        draft.aiExplanationByFile[event.filePath] = event.explanation;
      }),

    markFileResolved: (ctx, event: { filePath: string }) =>
      produce(ctx, (draft) => {
        // Remove the file from the list
        const index = draft.files.findIndex((f) => f.filePath === event.filePath);
        if (index !== -1) {
          draft.files.splice(index, 1);
          delete draft.resolvedByFile[event.filePath];
          delete draft.notesByFile[event.filePath];

          // Adjust current file index if needed
          if (draft.currentFileIndex >= draft.files.length) {
            draft.currentFileIndex = Math.max(0, draft.files.length - 1);
          }
          draft.currentConflictIndex = 0;
        }
      }),

    updateFileConflictInfo: (ctx, event: { file: FileConflictInfo }) =>
      produce(ctx, (draft) => {
        const index = draft.files.findIndex((f) => f.filePath === event.file.filePath);
        if (index !== -1) {
          draft.files[index] = event.file;
        }
      }),
  },
});

// Hook for using the merge conflict store
export function useMergeConflictStore() {
  const isActive = useSelector(mergeConflictStore, (s) => s.context.isActive);
  const operation = useSelector(mergeConflictStore, (s) => s.context.operation);
  const files = useSelector(mergeConflictStore, (s) => s.context.files);
  const currentFileIndex = useSelector(mergeConflictStore, (s) => s.context.currentFileIndex);
  const currentConflictIndex = useSelector(mergeConflictStore, (s) => s.context.currentConflictIndex);
  const resolvedByFile = useSelector(mergeConflictStore, (s) => s.context.resolvedByFile);
  const notesByFile = useSelector(mergeConflictStore, (s) => s.context.notesByFile);
  const isAIResolving = useSelector(mergeConflictStore, (s) => s.context.isAIResolving);
  const aiError = useSelector(mergeConflictStore, (s) => s.context.aiError);
  const aiExplanationByFile = useSelector(mergeConflictStore, (s) => s.context.aiExplanationByFile);
  const otherRefLabel = useSelector(mergeConflictStore, (s) => s.context.otherRefLabel);

  // Derived values
  const currentFile = files[currentFileIndex] ?? null;
  const currentConflict = currentFile?.conflicts[currentConflictIndex] ?? null;
  const resolvedContent = currentFile ? resolvedByFile[currentFile.filePath] ?? '' : '';
  const notes = currentFile ? notesByFile[currentFile.filePath] ?? '' : '';
  const aiExplanation = currentFile ? aiExplanationByFile[currentFile.filePath] ?? '' : '';

  // Legacy alias for backward compatibility
  const theirBranch = otherRefLabel;

  return {
    // State
    isActive,
    operation,
    files,
    currentFileIndex,
    currentConflictIndex,
    resolvedByFile,
    notesByFile,
    isAIResolving,
    aiError,
    aiExplanationByFile,
    otherRefLabel,
    theirBranch, // Legacy alias

    // Derived
    currentFile,
    currentConflict,
    resolvedContent,
    notes,
    aiExplanation,

    // Actions
    enterConflictMode: (files: FileConflictInfo[], otherRefLabel: string | null, operation: ConflictOperation) =>
      mergeConflictStore.send({ type: 'enterConflictMode', files, otherRefLabel, operation }),
    exitConflictMode: () => mergeConflictStore.send({ type: 'exitConflictMode' }),
    // Legacy actions for backward compatibility
    enterMergeMode: (files: FileConflictInfo[], theirBranch: string | null) =>
      mergeConflictStore.send({ type: 'enterMergeMode', files, theirBranch }),
    exitMergeMode: () => mergeConflictStore.send({ type: 'exitMergeMode' }),
    nextFile: () => mergeConflictStore.send({ type: 'nextFile' }),
    prevFile: () => mergeConflictStore.send({ type: 'prevFile' }),
    setCurrentFile: (index: number) =>
      mergeConflictStore.send({ type: 'setCurrentFile', index }),
    nextConflict: () => mergeConflictStore.send({ type: 'nextConflict' }),
    prevConflict: () => mergeConflictStore.send({ type: 'prevConflict' }),
    setCurrentConflict: (index: number) =>
      mergeConflictStore.send({ type: 'setCurrentConflict', index }),
    chooseOurs: () => mergeConflictStore.send({ type: 'chooseOurs' }),
    chooseTheirs: () => mergeConflictStore.send({ type: 'chooseTheirs' }),
    resetToConflicted: () => mergeConflictStore.send({ type: 'resetToConflicted' }),
    setResolvedContent: (filePath: string, content: string) =>
      mergeConflictStore.send({ type: 'setResolvedContent', filePath, content }),
    setNotes: (filePath: string, notes: string) =>
      mergeConflictStore.send({ type: 'setNotes', filePath, notes }),
    setAIResolving: (resolving: boolean) =>
      mergeConflictStore.send({ type: 'setAIResolving', resolving }),
    setAIError: (error: string | null) =>
      mergeConflictStore.send({ type: 'setAIError', error }),
    setAIExplanation: (filePath: string, explanation: string) =>
      mergeConflictStore.send({ type: 'setAIExplanation', filePath, explanation }),
    markFileResolved: (filePath: string) =>
      mergeConflictStore.send({ type: 'markFileResolved', filePath }),
    updateFileConflictInfo: (file: FileConflictInfo) =>
      mergeConflictStore.send({ type: 'updateFileConflictInfo', file }),
  };
}
