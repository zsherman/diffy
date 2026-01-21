import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import type { RepositoryInfo } from '../types/git';

interface GitContext {
  repository: RepositoryInfo | null;
  isLoading: boolean;
  error: string | null;
}

export const gitStore = createStore({
  context: {
    repository: null,
    isLoading: false,
    error: null,
  } as GitContext,
  on: {
    setRepository: (ctx, event: { repository: RepositoryInfo | null }) => ({
      ...ctx,
      repository: event.repository,
    }),
    setIsLoading: (ctx, event: { isLoading: boolean }) => ({
      ...ctx,
      isLoading: event.isLoading,
    }),
    setError: (ctx, event: { error: string | null }) => ({
      ...ctx,
      error: event.error,
    }),
  },
});

// Wrapper hook maintains same API - no component changes needed
export function useGitStore() {
  const repository = useSelector(gitStore, (s) => s.context.repository);
  const isLoading = useSelector(gitStore, (s) => s.context.isLoading);
  const error = useSelector(gitStore, (s) => s.context.error);

  return {
    repository,
    isLoading,
    error,
    setRepository: (repo: RepositoryInfo | null) =>
      gitStore.send({ type: 'setRepository', repository: repo }),
    setIsLoading: (loading: boolean) =>
      gitStore.send({ type: 'setIsLoading', isLoading: loading }),
    setError: (error: string | null) =>
      gitStore.send({ type: 'setError', error }),
  };
}
