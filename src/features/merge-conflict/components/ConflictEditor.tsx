import { useEffect, useRef, useMemo, useCallback } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { useUIStore } from '../../../stores/ui-store';
import { getLanguageExtension } from '../utils/language-detection';

interface ConflictEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  filePath: string;
  highlightLines?: { start: number; end: number } | null;
}

// Custom theme that follows our app theme
const createBaseTheme = (isDark: boolean, fontSize: number) =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      },
      '.cm-content': {
        caretColor: isDark ? '#fff' : '#000',
      },
      '.cm-cursor': {
        borderLeftColor: isDark ? '#fff' : '#000',
        borderLeftWidth: '2px',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
        borderRight: `1px solid ${isDark ? '#333' : '#ddd'}`,
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      },
    },
    { dark: isDark }
  );

export function ConflictEditor({
  value,
  onChange,
  readOnly = false,
  filePath,
  highlightLines,
}: ConflictEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isInternalChange = useRef(false);
  const { theme, diffFontSize } = useUIStore();
  const isDark = theme === 'pierre-dark';

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Get language extension for syntax highlighting
  const languageExtension = useMemo(() => {
    return getLanguageExtension(filePath);
  }, [filePath]);

  // Stable callback for handling changes
  const handleChange = useCallback((newValue: string) => {
    isInternalChange.current = true;
    onChangeRef.current?.(newValue);
    // Reset flag after a tick
    requestAnimationFrame(() => {
      isInternalChange.current = false;
    });
  }, []);

  // Build extensions array - only depends on stable values
  const extensions = useMemo(() => {
    const exts: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      createBaseTheme(isDark, diffFontSize),
      // Always add update listener, but check ref inside
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !readOnly) {
          handleChange(update.state.doc.toString());
        }
      }),
    ];

    // Add dark theme if needed
    if (isDark) {
      exts.push(oneDark);
    }

    // Add language extension if available
    if (languageExtension) {
      exts.push(languageExtension);
    }

    // Add read-only state
    if (readOnly) {
      exts.push(EditorState.readOnly.of(true));
    }

    return exts;
  }, [isDark, diffFontSize, languageExtension, readOnly, handleChange]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate when extensions change (theme, font size, language, readOnly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  // Update content when value changes externally (not from typing)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Skip if this is an internal change from typing
    if (isInternalChange.current) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      // Preserve cursor position if possible
      const currentSelection = view.state.selection;
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
        // Try to restore selection
        selection: currentSelection.main.to <= value.length ? currentSelection : undefined,
      });
    }
  }, [value]);

  // Scroll to highlighted lines when they change
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !highlightLines) return;

    // Convert 1-based line numbers to 0-based positions
    const lineNum = Math.min(highlightLines.start, view.state.doc.lines);
    if (lineNum > 0) {
      const line = view.state.doc.line(lineNum);
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      });
    }
  }, [highlightLines]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
    />
  );
}
