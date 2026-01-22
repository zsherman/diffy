import { useMemo } from 'react';
import type { BranchInfo, RefInfo } from '../../../types/git';

export function buildCommitRefsMap(branches: BranchInfo[]): Map<string, RefInfo[]> {
  const map = new Map<string, RefInfo[]>();

  for (const branch of branches) {
    const refInfo: RefInfo = {
      name: branch.name,
      type: branch.is_remote ? 'remote' : 'branch',
      is_head: branch.is_head,
    };

    const existing = map.get(branch.commit_id);
    if (existing) {
      existing.push(refInfo);
    } else {
      map.set(branch.commit_id, [refInfo]);
    }
  }

  // Sort refs within each commit: HEAD first, then local branches, then remotes
  for (const refs of map.values()) {
    refs.sort((a, b) => {
      if (a.is_head !== b.is_head) return a.is_head ? -1 : 1;
      if (a.type !== b.type) {
        if (a.type === 'branch') return -1;
        if (b.type === 'branch') return 1;
        if (a.type === 'remote') return 1;
        if (b.type === 'remote') return -1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  return map;
}

export function useCommitRefs(branches: BranchInfo[]): Map<string, RefInfo[]> {
  return useMemo(() => buildCommitRefsMap(branches), [branches]);
}
