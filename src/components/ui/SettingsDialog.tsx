import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X, Sliders, Minus, Plus, Sun, Moon, BookBookmark, ArrowSquareOut } from '@phosphor-icons/react';
import { useUIStore } from '../../stores/ui-store';
import { useSkills } from '../../features/skills/hooks/useSkills';

type SettingsSection = 'appearance' | 'diff' | 'skills';

const sections: { id: SettingsSection; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'diff', label: 'Diff' },
  { id: 'skills', label: 'Skills' },
];

export function SettingsDialog() {
  const {
    showSettingsDialog,
    setShowSettingsDialog,
    theme,
    setTheme,
    diffFontSize,
    setDiffFontSize,
    selectedSkillIds,
    setShowSkillsDialog,
  } = useUIStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { data: skills = [] } = useSkills();

  const handleFontSizeChange = (delta: number) => {
    const newSize = Math.min(24, Math.max(10, diffFontSize + delta));
    setDiffFontSize(newSize);
  };

  return (
    <Dialog.Root open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[90vw] max-h-[80vh] bg-bg-secondary rounded-lg shadow-xl border border-border-primary flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Sliders size={16} weight="bold" />
              Settings
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex flex-1 min-h-0">
            {/* Left sidebar - sections */}
            <div className="w-40 border-r border-border-primary bg-bg-tertiary p-2 flex flex-col gap-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`px-3 py-2 rounded text-sm text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-accent-blue/20 text-accent-blue'
                      : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {/* Right content */}
            <div className="flex-1 p-4 overflow-auto">
              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-4">Appearance</h3>

                    {/* Theme */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-text-primary">Theme</label>
                        <p className="text-xs text-text-muted mt-0.5">
                          Choose between Pierre Dark and Pierre Light themes
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTheme('pierre-dark')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                            theme === 'pierre-dark'
                              ? 'bg-accent-blue/20 text-accent-blue'
                              : 'bg-bg-hover text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <Moon size={14} weight="bold" />
                          Dark
                        </button>
                        <button
                          onClick={() => setTheme('pierre-light')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                            theme === 'pierre-light'
                              ? 'bg-accent-blue/20 text-accent-blue'
                              : 'bg-bg-hover text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <Sun size={14} weight="bold" />
                          Light
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'diff' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-4">Diff Settings</h3>

                    {/* Font Size */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-text-primary">Font Size</label>
                        <p className="text-xs text-text-muted mt-0.5">
                          Adjust the text size in diff views
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={diffFontSize <= 10}
                          className="p-1.5 rounded bg-bg-hover hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={14} weight="bold" className="text-text-muted" />
                        </button>
                        <span className="w-12 text-center text-sm text-text-primary tabular-nums">
                          {diffFontSize}px
                        </span>
                        <button
                          onClick={() => handleFontSizeChange(1)}
                          disabled={diffFontSize >= 24}
                          className="p-1.5 rounded bg-bg-hover hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} weight="bold" className="text-text-muted" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'skills' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-4">Skills</h3>

                    {/* Skills summary */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-text-primary">Installed Skills</label>
                          <p className="text-xs text-text-muted mt-0.5">
                            Skills provide domain-specific guidelines for AI code reviews
                          </p>
                        </div>
                        <span className="text-sm text-text-muted bg-bg-tertiary px-2 py-1 rounded">
                          {skills.length} installed
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-text-primary">Active Skills</label>
                          <p className="text-xs text-text-muted mt-0.5">
                            Currently selected for AI reviews
                          </p>
                        </div>
                        <span className="text-sm text-text-muted bg-bg-tertiary px-2 py-1 rounded">
                          {selectedSkillIds.length} selected
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setShowSettingsDialog(false);
                          setShowSkillsDialog(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-bg-hover hover:bg-bg-tertiary rounded text-sm text-text-primary transition-colors"
                      >
                        <BookBookmark size={16} weight="bold" />
                        Manage Skills
                        <ArrowSquareOut size={14} className="text-text-muted ml-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
