/**
 * Theme registry - single source of truth for all app themes.
 * 
 * Each theme defines:
 * - id: unique identifier used in localStorage and as data-theme attribute
 * - label: display name for UI
 * - kind: 'dark' or 'light' for Dockview and general light/dark mode detection
 * - diffsTheme: the Shiki/Diffs theme name to use for syntax highlighting
 * - cssVars: CSS custom properties for app chrome styling
 */

export type ThemeId =
  | 'pierre-dark'
  | 'pierre-light'
  | 'github-dark'
  | 'github-light'
  | 'dracula'
  | 'one-dark-pro';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  kind: 'dark' | 'light';
  /** Shiki theme name for @pierre/diffs syntax highlighting */
  diffsTheme: string;
  /** CSS custom properties for app chrome */
  cssVars: {
    '--bg-primary': string;
    '--bg-secondary': string;
    '--bg-tertiary': string;
    '--bg-hover': string;
    '--bg-selected': string;
    '--text-primary': string;
    '--text-secondary': string;
    '--text-muted': string;
    '--border-primary': string;
    '--accent-blue': string;
    '--accent-green': string;
    '--accent-red': string;
    '--accent-yellow': string;
    '--accent-purple': string;
  };
}

export const THEMES: ThemeDefinition[] = [
  // Pierre themes (bundled with @pierre/diffs)
  {
    id: 'pierre-dark',
    label: 'Pierre Dark',
    kind: 'dark',
    diffsTheme: 'pierre-dark',
    cssVars: {
      '--bg-primary': '#070707',
      '--bg-secondary': '#141415',
      '--bg-tertiary': '#1F1F21',
      '--bg-hover': '#19283c',
      '--bg-selected': '#19283c99',
      '--text-primary': '#fbfbfb',
      '--text-secondary': '#adadb1',
      '--text-muted': '#84848A',
      '--border-primary': '#424245',
      '--accent-blue': '#009fff',
      '--accent-green': '#00cab1',
      '--accent-red': '#ff2e3f',
      '--accent-yellow': '#ffca00',
      '--accent-purple': '#c635e4',
    },
  },
  {
    id: 'pierre-light',
    label: 'Pierre Light',
    kind: 'light',
    diffsTheme: 'pierre-light',
    cssVars: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f8f8f8',
      '--bg-tertiary': '#f2f2f3',
      '--bg-hover': '#dfebff',
      '--bg-selected': '#dfebffcc',
      '--text-primary': '#070707',
      '--text-secondary': '#6C6C71',
      '--text-muted': '#84848A',
      '--border-primary': '#eeeeef',
      '--accent-blue': '#009fff',
      '--accent-green': '#00cab1',
      '--accent-red': '#ff2e3f',
      '--accent-yellow': '#ffca00',
      '--accent-purple': '#c635e4',
    },
  },
  // GitHub themes (Shiki bundled)
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    kind: 'dark',
    diffsTheme: 'github-dark',
    cssVars: {
      '--bg-primary': '#0d1117',
      '--bg-secondary': '#161b22',
      '--bg-tertiary': '#21262d',
      '--bg-hover': '#30363d',
      '--bg-selected': '#388bfd33',
      '--text-primary': '#f0f6fc',
      '--text-secondary': '#c9d1d9',
      '--text-muted': '#8b949e',
      '--border-primary': '#30363d',
      '--accent-blue': '#58a6ff',
      '--accent-green': '#3fb950',
      '--accent-red': '#f85149',
      '--accent-yellow': '#d29922',
      '--accent-purple': '#a371f7',
    },
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    kind: 'light',
    diffsTheme: 'github-light',
    cssVars: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f6f8fa',
      '--bg-tertiary': '#eaeef2',
      '--bg-hover': '#d0d7de',
      '--bg-selected': '#ddf4ff',
      '--text-primary': '#1f2328',
      '--text-secondary': '#656d76',
      '--text-muted': '#8c959f',
      '--border-primary': '#d0d7de',
      '--accent-blue': '#0969da',
      '--accent-green': '#1a7f37',
      '--accent-red': '#cf222e',
      '--accent-yellow': '#9a6700',
      '--accent-purple': '#8250df',
    },
  },
  // Dracula (Shiki bundled)
  {
    id: 'dracula',
    label: 'Dracula',
    kind: 'dark',
    diffsTheme: 'dracula',
    cssVars: {
      '--bg-primary': '#282a36',
      '--bg-secondary': '#21222c',
      '--bg-tertiary': '#343746',
      '--bg-hover': '#44475a',
      '--bg-selected': '#44475a99',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#e9e9e4',
      '--text-muted': '#6272a4',
      '--border-primary': '#44475a',
      '--accent-blue': '#8be9fd',
      '--accent-green': '#50fa7b',
      '--accent-red': '#ff5555',
      '--accent-yellow': '#f1fa8c',
      '--accent-purple': '#bd93f9',
    },
  },
  // One Dark Pro (Shiki bundled)
  {
    id: 'one-dark-pro',
    label: 'One Dark Pro',
    kind: 'dark',
    diffsTheme: 'one-dark-pro',
    cssVars: {
      '--bg-primary': '#282c34',
      '--bg-secondary': '#21252b',
      '--bg-tertiary': '#2c313c',
      '--bg-hover': '#3e4451',
      '--bg-selected': '#3e445199',
      '--text-primary': '#abb2bf',
      '--text-secondary': '#9da5b4',
      '--text-muted': '#5c6370',
      '--border-primary': '#3e4451',
      '--accent-blue': '#61afef',
      '--accent-green': '#98c379',
      '--accent-red': '#e06c75',
      '--accent-yellow': '#e5c07b',
      '--accent-purple': '#c678dd',
    },
  },
];

/** Get a theme definition by id */
export function getTheme(id: ThemeId): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Check if a theme id is valid */
export function isValidThemeId(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}

/** Check if theme is light */
export function isLightTheme(id: ThemeId): boolean {
  const theme = getTheme(id);
  return theme?.kind === 'light';
}

/** Get the default theme */
export function getDefaultTheme(): ThemeId {
  return 'pierre-dark';
}

/** Group themes by kind for UI display */
export function getThemesByKind(): { dark: ThemeDefinition[]; light: ThemeDefinition[] } {
  return {
    dark: THEMES.filter((t) => t.kind === 'dark'),
    light: THEMES.filter((t) => t.kind === 'light'),
  };
}
