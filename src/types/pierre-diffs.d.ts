declare module '@pierre/diffs' {
  export interface ParsedPatch {
    patchMetadata?: string;
    files: FileDiffMetadata[];
  }

  export interface FileDiffMetadata {
    oldPath: string | null;
    newPath: string | null;
    changeType: string;
    hunks: Hunk[];
  }

  export interface Hunk {
    collapsedBefore: number;
    splitLineStart: number;
    splitLineCount: number;
    unifiedLineStart: number;
    unifiedLineCount: number;
    additionCount: number;
    deletionCount: number;
    hunkContent: Array<ContextContent | ChangeContent>;
    hunkContext?: string;
    hunkSpecs?: string;
  }

  export interface ContextContent {
    type: 'context';
    lines: string[];
    noEOFCR: boolean;
  }

  export interface ChangeContent {
    type: 'change';
    deletions: string[];
    additions: string[];
    noEOFCRDeletions: boolean;
    noEOFCRAdditions: boolean;
  }

  export function parsePatchFiles(data: string, cacheKeyPrefix?: string): ParsedPatch[];
}

declare module '@pierre/diffs/react' {
  import { CSSProperties, ReactNode } from 'react';
  import { FileDiffMetadata } from '@pierre/diffs';

  export type ThemeTypes = 'system' | 'light' | 'dark';
  export type DiffStyle = 'unified' | 'split';

  export interface FileDiffOptions {
    diffStyle?: DiffStyle;
    /** Theme for syntax highlighting - can be a theme name or object with dark/light variants */
    theme?: string | { dark: string; light: string };
    /** Controls which theme variant to use when theme is an object: 'system' follows OS, 'light'/'dark' forces specific */
    themeType?: ThemeTypes;
    disableLineNumbers?: boolean;
    disableFileHeader?: boolean;
    expandUnchanged?: boolean;
  }

  export interface FileDiffProps {
    fileDiff: FileDiffMetadata;
    options?: FileDiffOptions;
    className?: string;
    style?: CSSProperties;
  }

  export function FileDiff(props: FileDiffProps): JSX.Element;

  export interface PatchDiffProps {
    patch: string;
    options?: FileDiffOptions;
    className?: string;
    style?: CSSProperties;
  }

  export function PatchDiff(props: PatchDiffProps): JSX.Element;
}
