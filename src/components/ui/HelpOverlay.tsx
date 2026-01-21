import React from 'react';
import { useUIStore } from '../../stores/ui-store';

interface ShortcutGroup {
  title: string;
  shortcuts: { key: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'j / ↓', description: 'Move down' },
      { key: 'k / ↑', description: 'Move up' },
      { key: 'h / Shift+Tab', description: 'Previous panel' },
      { key: 'l / Tab', description: 'Next panel' },
      { key: '1-4', description: 'Jump to panel' },
      { key: 'Enter', description: 'Select / Confirm' },
    ],
  },
  {
    title: 'Git Operations',
    shortcuts: [
      { key: 'Space', description: 'Stage / Unstage file' },
      { key: 'u', description: 'Unstage file' },
      { key: 'd', description: 'Discard changes' },
      { key: 'c', description: 'Commit staged changes' },
      { key: 'r', description: 'Refresh' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { key: 'v', description: 'Toggle split/unified diff' },
      { key: '/', description: 'Filter current panel' },
      { key: 'Esc', description: 'Clear filter / Close overlay' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: '?', description: 'Toggle help' },
      { key: 'Cmd+K', description: 'Command palette' },
    ],
  },
];

export function HelpOverlay() {
  const { showHelpOverlay, setShowHelpOverlay } = useUIStore();

  if (!showHelpOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setShowHelpOverlay(false)}
    >
      <div
        className="bg-bg-secondary rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowHelpOverlay(false)}
            className="text-text-muted hover:text-text-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Shortcuts grid */}
        <div className="grid grid-cols-2 gap-6 p-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-accent-blue mb-2">{group.title}</h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center gap-2">
                    <kbd className="px-2 py-0.5 bg-bg-tertiary rounded text-xs font-mono text-text-primary min-w-[60px] text-center">
                      {shortcut.key}
                    </kbd>
                    <span className="text-sm text-text-secondary">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border-primary text-center text-xs text-text-muted">
          Press <kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Esc</kbd> or{' '}
          <kbd className="px-1 py-0.5 bg-bg-tertiary rounded">?</kbd> to close
        </div>
      </div>
    </div>
  );
}
