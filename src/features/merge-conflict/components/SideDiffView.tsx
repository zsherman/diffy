import { useMemo } from 'react';
import { createTwoFilesPatch } from 'diff';
import { parsePatchFiles } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { useUIStore } from '../../../stores/ui-store';
import { getTheme, isLightTheme } from '../../../lib/themes';

interface SideDiffViewProps {
  content: string;
  otherContent: string;
  side: 'ours' | 'theirs';
}

export function SideDiffView({
  content,
  otherContent,
  side,
}: SideDiffViewProps) {
  const { theme, diffFontSize } = useUIStore();
  const diffsTheme = getTheme(theme)?.diffsTheme ?? 'pierre-dark';
  const themeType = isLightTheme(theme) ? 'light' : 'dark';

  // Generate a unified diff patch
  // For "ours" side: we want to show ours as the "old" (left) side
  // For "theirs" side: we want to show theirs as the "new" (right) side
  const parsedDiff = useMemo(() => {
    try {
      // Always generate diff from ours → theirs
      // In split view: left = ours (old), right = theirs (new)
      const [oldContent, newContent] = side === 'ours'
        ? [content, otherContent]  // ours is old
        : [otherContent, content]; // theirs is new

      const patch = createTwoFilesPatch(
        'a/file',
        'b/file',
        oldContent,
        newContent,
        '',
        '',
        { context: 1000 } // Large context to show full file
      );

      const parsed = parsePatchFiles(patch);
      return parsed[0]?.files[0] || null;
    } catch (e) {
      console.error('Failed to generate diff:', e);
      return null;
    }
  }, [content, otherContent, side]);

  if (!parsedDiff) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Unable to generate diff
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto"
      style={{
        '--diffs-font-size': `${diffFontSize}px`,
      } as React.CSSProperties}
    >
      <FileDiff
        fileDiff={parsedDiff}
        options={{
          diffStyle: 'unified',
          theme: diffsTheme,
          themeType,
          disableFileHeader: true,
        }}
      />
    </div>
  );
}
