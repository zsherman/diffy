import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUndoStore, usePendingUndo } from "../../stores/undo-store";
import { useToast } from "./Toast";

/**
 * UndoToast component that watches for pending undo operations
 * and shows a toast with an "Undo" action button.
 *
 * This component should be rendered once at the app root level.
 */
export function UndoToast() {
  const pendingUndo = usePendingUndo();
  const { performUndo, clearUndo } = useUndoStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Track the last shown undo to avoid duplicate toasts
  const lastShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingUndo) {
      lastShownRef.current = null;
      return;
    }

    // Create a unique key for this undo operation
    const undoKey = `${pendingUndo.type}-${pendingUndo.previousHeadId}-${pendingUndo.timestamp}`;

    // Don't show duplicate toasts for the same operation
    if (lastShownRef.current === undoKey) {
      return;
    }

    lastShownRef.current = undoKey;

    // Show toast with undo action
    toast.withAction(
      pendingUndo.description,
      "Click Undo to revert this change",
      "info",
      {
        label: "Undo",
        onClick: async () => {
          const result = await performUndo();
          if (result.success) {
            toast.success("Undo successful", "Changes have been reverted");
            // Invalidate relevant queries
            queryClient.invalidateQueries({
              queryKey: ["commits", pendingUndo.repoPath],
            });
            queryClient.invalidateQueries({
              queryKey: ["status", pendingUndo.repoPath],
            });
          } else {
            toast.error("Undo failed", result.error);
          }
        },
      },
      10000, // 10 second timeout for undo toast
    );

    // Auto-clear undo after timeout (matching toast timeout)
    const timeoutId = setTimeout(() => {
      clearUndo();
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [pendingUndo, performUndo, clearUndo, toast, queryClient]);

  // This component doesn't render anything - it just manages the toast
  return null;
}
