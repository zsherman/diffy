import { create } from 'zustand';
import type { RepositoryInfo } from '../types/git';

interface GitState {
  // Repository
  repository: RepositoryInfo | null;
  setRepository: (repo: RepositoryInfo | null) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;
}

export const useGitStore = create<GitState>((set) => ({
  repository: null,
  setRepository: (repo) => set({ repository: repo }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  error: null,
  setError: (error) => set({ error: error }),
}));
