const STORAGE_KEY = 'diffy-recent-repositories';
const MAX_RECENT = 10;

export interface RecentRepository {
  path: string;
  name: string;
  lastOpened: number;
}

export function getRecentRepositories(): RecentRepository[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as RecentRepository[];
    }
  } catch (e) {
    console.warn('Failed to load recent repositories:', e);
  }
  return [];
}

export function addRecentRepository(path: string, name: string): void {
  try {
    const recent = getRecentRepositories();

    // Remove if already exists (will re-add at top)
    const filtered = recent.filter((r) => r.path !== path);

    // Add to beginning
    filtered.unshift({
      path,
      name,
      lastOpened: Date.now(),
    });

    // Keep only MAX_RECENT
    const trimmed = filtered.slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save recent repository:', e);
  }
}

export function removeRecentRepository(path: string): void {
  try {
    const recent = getRecentRepositories();
    const filtered = recent.filter((r) => r.path !== path);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to remove recent repository:', e);
  }
}

export function clearRecentRepositories(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear recent repositories:', e);
  }
}
