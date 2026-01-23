import { memo } from 'react';
import {
  CheckCircle,
  GitBranch,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import type { RefInfo, BranchInfo } from '../../../types/git';

interface BranchTagCellProps {
  refs: RefInfo[];
  branches: BranchInfo[];
  width: number;
}

function getBranchInfo(refName: string, branches: BranchInfo[]): BranchInfo | undefined {
  return branches.find((b) => b.name === refName);
}

function getRefColor(ref: RefInfo): string {
  if (ref.isHead) return 'bg-accent-green/20 text-accent-green border-accent-green/40';
  if (ref.type === 'remote') return 'bg-accent-purple/20 text-accent-purple border-accent-purple/40';
  if (ref.type === 'tag') return 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40';
  return 'bg-accent-blue/20 text-accent-blue border-accent-blue/40';
}

function getRefIcon(ref: RefInfo, branch: BranchInfo | undefined) {
  if (ref.isHead) {
    return <CheckCircle size={12} weight="fill" className="shrink-0" />;
  }
  if (ref.type === 'branch' && branch?.upstream) {
    return <ArrowsClockwise size={12} weight="bold" className="shrink-0" />;
  }
  if (ref.type === 'branch') {
    return <GitBranch size={12} weight="bold" className="shrink-0" />;
  }
  return null;
}

function getDisplayName(ref: RefInfo): string {
  if (ref.type === 'remote') {
    // Remove "origin/" prefix for display
    return ref.name.replace(/^[^/]+\//, '');
  }
  return ref.name;
}

const RefBadge = memo(function RefBadge({
  ref,
  branch,
  maxWidth,
}: {
  ref: RefInfo;
  branch: BranchInfo | undefined;
  maxWidth: number;
}) {
  const colorClass = getRefColor(ref);
  const icon = getRefIcon(ref, branch);
  const displayName = getDisplayName(ref);

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${colorClass}`}
      style={{ maxWidth }}
      title={ref.name}
    >
      {icon}
      <span className="truncate">{displayName}</span>
    </div>
  );
});

export const BranchTagCell = memo(function BranchTagCell({
  refs,
  branches,
  width,
}: BranchTagCellProps) {
  if (refs.length === 0) {
    return <div style={{ width }} className="shrink-0" />;
  }

  // Show at most 2 refs, then "+N" for overflow
  const visibleRefs = refs.slice(0, 2);
  const overflowCount = refs.length - 2;

  // Calculate max width for each badge (accounting for overflow indicator)
  const badgeMaxWidth = overflowCount > 0
    ? (width - 32) / visibleRefs.length
    : (width - 8) / Math.min(refs.length, 2);

  return (
    <div
      style={{ width }}
      className="shrink-0 flex items-center gap-1 px-1 overflow-hidden"
    >
      {visibleRefs.map((ref) => (
        <RefBadge
          key={ref.name}
          ref={ref}
          branch={getBranchInfo(ref.name, branches)}
          maxWidth={badgeMaxWidth}
        />
      ))}
      {overflowCount > 0 && (
        <span
          className="text-xs text-text-muted shrink-0"
          title={refs.slice(2).map((r) => r.name).join(', ')}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
});
