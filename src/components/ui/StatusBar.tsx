import { Menu } from '@base-ui/react/menu';
import { GearSix, Sun, Moon, Check, CaretUpDown } from '@phosphor-icons/react';
import { useUIStore, useTheme } from '../../stores/ui-store';
import { THEMES, getTheme, isLightTheme, type ThemeId } from '../../lib/themes';

export function StatusBar() {
  const { activePanel, setShowSettingsDialog } = useUIStore();
  const { theme, setTheme } = useTheme();
  const currentTheme = getTheme(theme);

  const hints: Record<string, string> = {
    branches: 'j/k:navigate | Enter:checkout | Tab:next panel',
    commits: 'j/k:navigate | Enter:select | Tab:next panel',
    files: 'j/k:navigate | Space:stage | u:unstage | d:discard',
    diff: 'v:toggle view | Tab:next panel',
    staging: 'Stage/unstage files | Enter:commit',
    'merge-conflict': 'Ctrl+1:use ours | Ctrl+2:use theirs | Ctrl+Up/Down:navigate files',
  };

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-bg-tertiary border-t border-border-primary text-xs">
      {/* Left: Context-sensitive hints */}
      <div className="text-text-muted">{hints[activePanel]}</div>

      {/* Right: Theme picker, Settings and Help */}
      <div className="flex items-center gap-3 text-text-muted">
        {/* Theme Picker */}
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bg-hover transition-colors hover:text-text-primary cursor-pointer">
            {isLightTheme(theme) ? (
              <Sun size={14} weight="bold" />
            ) : (
              <Moon size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">{currentTheme?.label ?? 'Theme'}</span>
            <CaretUpDown size={10} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={4} className="z-50">
              <Menu.Popup className="min-w-[180px] overflow-hidden rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-none">
                {THEMES.map((t) => (
                  <Menu.Item
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-[highlighted]:bg-bg-hover outline-none"
                    onClick={() => setTheme(t.id as ThemeId)}
                  >
                    <span className="w-4">
                      {theme === t.id && (
                        <Check size={14} weight="bold" className="text-accent-green" />
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {t.kind === 'light' ? (
                        <Sun size={14} className="text-text-muted" />
                      ) : (
                        <Moon size={14} className="text-text-muted" />
                      )}
                      {t.label}
                    </span>
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <button
          onClick={() => setShowSettingsDialog(true)}
          className="p-1 rounded hover:bg-bg-hover transition-colors hover:text-text-primary"
          title="Settings"
        >
          <GearSix size={16} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-bg-hover rounded text-xs">?</span>
          <span>help</span>
        </div>
      </div>
    </div>
  );
}
