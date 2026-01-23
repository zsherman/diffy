import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import {
  startWatching,
  stopWatching,
  type RepoChangedEvent,
} from "../lib/tauri";

// Debounce delay for coalescing rapid file system events (ms)
const WATCHER_DEBOUNCE_MS = 300;

// Delay before starting watcher after tab switch (allows rapid switching without watcher churn)
const WATCHER_START_DELAY_MS = 200;

/**
 * Hook to watch a repository for file changes and invalidate relevant queries.
 *
 * Uses a debounced approach to coalesce rapid file system events (e.g., during
 * a git operation or editor save-on-format) into a single invalidation cycle.
 *
 * The watcher start is delayed to avoid expensive watcher setup during rapid tab switches.
 *
 * @param repoPath - The path to the repository to watch, or null to disable watching
 */
export function useRepoWatcher(repoPath: string | null) {
  const queryClient = useQueryClient();
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending watcher start from previous effect
    if (startDelayTimerRef.current) {
      clearTimeout(startDelayTimerRef.current);
      startDelayTimerRef.current = null;
    }

    if (!repoPath) {
      // Stop watching if no repo path
      stopWatching().catch(console.error);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    let mounted = true;

    // Set up event listener immediately (cheap)
    listen<RepoChangedEvent>("repo_changed", (event) => {
      if (!mounted) return;
      // Only handle events for this repo
      if (event.payload.repoPath !== repoPath) return;

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce invalidations to coalesce rapid FS events
      debounceTimerRef.current = setTimeout(() => {
        if (!mounted) return;

        // Scope invalidations to the specific repository path
        queryClient.invalidateQueries({ queryKey: ["status", repoPath] });
        queryClient.invalidateQueries({ queryKey: ["working-diff", repoPath] });
      }, WATCHER_DEBOUNCE_MS);
    })
      .then((unlisten) => {
        if (mounted) {
          unlistenRef.current = unlisten;
        } else {
          unlisten();
        }
      })
      .catch(console.error);

    // Delay watcher start to avoid churn during rapid tab switches
    // The Rust side's start_watching() already stops any existing watcher,
    // so we don't need to call stopWatching() here
    startDelayTimerRef.current = setTimeout(() => {
      if (!mounted) return;
      // Fire and forget - don't await, let it set up in background
      startWatching(repoPath).catch(console.error);
    }, WATCHER_START_DELAY_MS);

    return () => {
      mounted = false;
      // Don't call stopWatching() here - the next startWatching() handles it,
      // and calling it here adds latency to tab switches
      if (startDelayTimerRef.current) {
        clearTimeout(startDelayTimerRef.current);
        startDelayTimerRef.current = null;
      }
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [repoPath, queryClient]);
}
