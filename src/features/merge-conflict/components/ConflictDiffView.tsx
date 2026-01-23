import { useMemo } from 'react';
import { createTwoFilesPatch } from 'diff';
import { parsePatchFiles } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useUIStore } from '../../../stores/ui-store';

interface ConflictDiffViewProps {
  filePath: string;
  oursContent: string;
  theirsContent: string;
}

export function ConflictDiffView({
  filePath,
  oursContent,
  theirsContent,
}: ConflictDiffViewProps) {
  const { theme, diffViewMode, diffFontSize } = useUIStore();
  const themeType = theme === 'pierre-light' ? 'light' : 'dark';

  // Generate a unified diff patch between ours and theirs
  const parsedDiff = useMemo(() => {
    try {
      // Create a unified diff patch
      const patch = createTwoFilesPatch(
        `a/${filePath}`, // old file name (ours)
        `b/${filePath}`, // new file name (theirs)
        oursContent,
        theirsContent,
        'Ours (Current Branch)', // old header
        'Theirs (Incoming)', // new header
        { context: 3 }
      );

      // Parse the patch for @pierre/diffs
      const parsed = parsePatchFiles(patch);
      return parsed[0]?.files[0] || null;
    } catch (e) {
      console.error('Failed to generate diff:', e);
      return null;
    }
  }, [filePath, oursContent, theirsContent]);

  if (!parsedDiff) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Unable to generate diff
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto bg-bg-primary"
      style={{ '--diffs-font-size': `${diffFontSize}px` } as React.CSSProperties}
    >
      <FileDiff
        fileDiff={parsedDiff}
        options={{
          diffStyle: diffViewMode === 'split' ? 'split' : 'unified',
          themeType,
          disableFileHeader: true,
        }}
      />
    </div>
  );
}
