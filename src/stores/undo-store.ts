import { useCallback } from "react";
import { createStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { produce } from "immer";
import { resetHard } from "../lib/tauri";

// Types of operations that can be undone
export type UndoableOperationType =
  | "squash"
  | "commit"
  | "merge"
  | "cherry-pick"
  | "reset";

// Information needed to undo an operation
export interface UndoableOperation {
  type: UndoableOperationType;
  repoPath: string;
  previousHeadId: string; // SHA to reset to for undo
  description: string; // Human-readable: "Squash 3 commits", "Commit abc123"
  timestamp: number;
  metadata?: Record<string, unknown>; // Operation-specific data
}

interface UndoContext {
  pendingUndo: UndoableOperation | null;
  isUndoing: boolean;
  undoError: string | null;
}

export const undoStore = createStore({
  context: {
    pendingUndo: null,
    isUndoing: false,
    undoError: null,
  } as UndoContext,
  on: {
    // Push a new undoable operation (replaces any existing pending undo)
    pushUndo: (ctx, event: { operation: UndoableOperation }) =>
      produce(ctx, (draft) => {
        draft.pendingUndo = event.operation;
        draft.undoError = null;
      }),

    // Clear the pending undo without performing it
    clearUndo: (ctx) =>
      produce(ctx, (draft) => {
        draft.pendingUndo = null;
        draft.undoError = null;
      }),

    // Mark undo as in progress
    startUndo: (ctx) =>
      produce(ctx, (draft) => {
        draft.isUndoing = true;
        draft.undoError = null;
      }),

    // Mark undo as completed
    undoSuccess: (ctx) =>
      produce(ctx, (draft) => {
        draft.pendingUndo = null;
        draft.isUndoing = false;
        draft.undoError = null;
      }),

    // Mark undo as failed
    undoError: (ctx, event: { error: string }) =>
      produce(ctx, (draft) => {
        draft.isUndoing = false;
        draft.undoError = event.error;
      }),
  },
});

// Hook for accessing the undo store
export function useUndoStore() {
  const pendingUndo = useSelector(undoStore, (s) => s.context.pendingUndo);
  const isUndoing = useSelector(undoStore, (s) => s.context.isUndoing);
  const undoError = useSelector(undoStore, (s) => s.context.undoError);

  const pushUndo = useCallback((operation: UndoableOperation) => {
    undoStore.send({ type: "pushUndo", operation });
  }, []);

  const clearUndo = useCallback(() => {
    undoStore.send({ type: "clearUndo" });
  }, []);

  const performUndo = useCallback(async () => {
    const state = undoStore.getSnapshot();
    const pending = state.context.pendingUndo;

    if (!pending) {
      return { success: false, error: "No pending undo operation" };
    }

    undoStore.send({ type: "startUndo" });

    try {
      // Perform the undo by resetting to the previous HEAD
      await resetHard(pending.repoPath, pending.previousHeadId);
      undoStore.send({ type: "undoSuccess" });
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      undoStore.send({ type: "undoError", error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    pendingUndo,
    isUndoing,
    undoError,
    pushUndo,
    clearUndo,
    performUndo,
  };
}

// Hook for just checking if there's a pending undo (for showing the toast)
export function usePendingUndo() {
  return useSelector(undoStore, (s) => s.context.pendingUndo);
}
