import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import type { Extension } from '@codemirror/state';

/**
 * Get CodeMirror language extension based on file extension
 */
export function getLanguageExtension(filePath: string): Extension | null {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    // JavaScript / TypeScript
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'ts':
    case 'mts':
    case 'cts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ jsx: true, typescript: true });

    // Python
    case 'py':
    case 'pyw':
    case 'pyi':
      return python();

    // Rust
    case 'rs':
      return rust();

    // CSS
    case 'css':
      return css();
    case 'scss':
    case 'sass':
    case 'less':
      return css();

    // HTML
    case 'html':
    case 'htm':
    case 'xhtml':
      return html();
    case 'vue':
    case 'svelte':
      return html();

    // JSON
    case 'json':
    case 'jsonc':
      return json();

    // Config files that are typically JSON
    case 'prettierrc':
    case 'eslintrc':
    case 'babelrc':
      return json();

    // Markdown - no specific support, return null
    case 'md':
    case 'mdx':
      return null;

    // YAML/TOML - no specific support, return null
    case 'yaml':
    case 'yml':
    case 'toml':
      return null;

    default:
      return null;
  }
}

/**
 * Get a human-readable language name for display
 */
export function getLanguageName(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'JavaScript';
    case 'jsx':
      return 'JSX';
    case 'ts':
    case 'mts':
    case 'cts':
      return 'TypeScript';
    case 'tsx':
      return 'TSX';
    case 'py':
    case 'pyw':
    case 'pyi':
      return 'Python';
    case 'rs':
      return 'Rust';
    case 'css':
      return 'CSS';
    case 'scss':
      return 'SCSS';
    case 'sass':
      return 'Sass';
    case 'less':
      return 'Less';
    case 'html':
    case 'htm':
      return 'HTML';
    case 'vue':
      return 'Vue';
    case 'svelte':
      return 'Svelte';
    case 'json':
    case 'jsonc':
      return 'JSON';
    case 'md':
    case 'mdx':
      return 'Markdown';
    case 'yaml':
    case 'yml':
      return 'YAML';
    case 'toml':
      return 'TOML';
    default:
      return 'Plain Text';
  }
}
