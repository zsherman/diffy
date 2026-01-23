import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { startWatching, stopWatching, type RepoChangedEvent } from '../lib/tauri';

/**
 * Hook to watch a repository for file changes and invalidate relevant queries.
 * 
 * @param repoPath - The path to the repository to watch, or null to disable watching
 */
export function useRepoWatcher(repoPath: string | null) {
  const queryClient = useQueryClient();
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    if (!repoPath) {
      // Stop watching if no repo path
      stopWatching().catch(console.error);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      return;
    }

    let mounted = true;

    // Start watching the repository
    const setup = async () => {
      try {
        // Set up event listener
        const unlisten = await listen<RepoChangedEvent>('repo_changed', (_event) => {
          if (!mounted) return;

          // Invalidate queries that depend on the file system state
          // Use a small delay to batch rapid changes
          setTimeout(() => {
            if (!mounted) return;
            
            queryClient.invalidateQueries({ queryKey: ['status'] });
            queryClient.invalidateQueries({ queryKey: ['working-diff'] });
            // Don't invalidate commits/branches on every file change
            // as those are less likely to change from file edits
          }, 50);
        });

        unlistenRef.current = unlisten;

        // Start the watcher
        await startWatching(repoPath);
      } catch (error) {
        console.error('Failed to start file watcher:', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      stopWatching().catch(console.error);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [repoPath, queryClient]);
}
