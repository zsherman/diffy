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

    // Set up watcher completely in background - don't block render at all
    (async () => {
      try {
        const unlisten = await listen<RepoChangedEvent>('repo_changed', (_event) => {
          if (!mounted) return;
          setTimeout(() => {
            if (!mounted) return;
            queryClient.invalidateQueries({ queryKey: ['status'] });
            queryClient.invalidateQueries({ queryKey: ['working-diff'] });
          }, 50);
        });

        unlistenRef.current = unlisten;

        await startWatching(repoPath);
      } catch (error) {
        console.error('Failed to set up file watcher:', error);
      }
    })();

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
