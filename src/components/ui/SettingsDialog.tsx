import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X, Sliders, Minus, Plus, Sun, Moon, BookBookmark, ArrowSquareOut, Timer, MagnifyingGlass, Check } from '@phosphor-icons/react';
import { useUIStore, isReactScanEnabled, toggleReactScanAndReload } from '../../stores/ui-store';
import { useSkills } from '../../features/skills/hooks/useSkills';
import { THEMES, type ThemeId } from '../../lib/themes';

type SettingsSection = 'appearance' | 'diff' | 'skills' | 'developer';

const sections: { id: SettingsSection; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'diff', label: 'Diff' },
  { id: 'skills', label: 'Skills' },
  { id: 'developer', label: 'Developer' },
];

export function SettingsDialog() {
  const {
    showSettingsDialog,
    setShowSettingsDialog,
    theme,
    setTheme,
    diffFontSize,
    setDiffFontSize,
    panelFontSize,
    setPanelFontSize,
    selectedSkillIds,
    aiReviewReviewerId,
    setAIReviewReviewerId,
    setShowSkillsDialog,
    perfTracingEnabled,
    setPerfTracingEnabled,
  } = useUIStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { data: skills = [] } = useSkills();

  const handleDiffFontSizeChange = (delta: number) => {
    const newSize = Math.min(24, Math.max(10, diffFontSize + delta));
    setDiffFontSize(newSize);
  };

  const handlePanelFontSizeChange = (delta: number) => {
    const newSize = Math.min(16, Math.max(10, panelFontSize + delta));
    setPanelFontSize(newSize);
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
            <Dialog.Close className="p-1 rounded-sm hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
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
                    <div className="mb-4">
                      <label className="text-sm text-text-primary">Theme</label>
                      <p className="text-xs text-text-muted mt-0.5 mb-3">
                        Choose a color theme for the application
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setTheme(t.id as ThemeId)}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors text-left ${
                              theme === t.id
                                ? 'bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/50'
                                : 'bg-bg-hover text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                            }`}
                          >
                            {t.kind === 'light' ? (
                              <Sun size={14} weight="bold" className="shrink-0" />
                            ) : (
                              <Moon size={14} weight="bold" className="shrink-0" />
                            )}
                            <span className="flex-1">{t.label}</span>
                            {theme === t.id && (
                              <Check size={14} weight="bold" className="shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Panel Font Size */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-text-primary">Panel Font Size</label>
                        <p className="text-xs text-text-muted mt-0.5">
                          Adjust the text size in branch, commit, and file panels
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePanelFontSizeChange(-1)}
                          disabled={panelFontSize <= 10}
                          className="p-1.5 rounded-sm bg-bg-hover hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={14} weight="bold" className="text-text-muted" />
                        </button>
                        <span className="w-12 text-center text-sm text-text-primary tabular-nums">
                          {panelFontSize}px
                        </span>
                        <button
                          onClick={() => handlePanelFontSizeChange(1)}
                          disabled={panelFontSize >= 16}
                          className="p-1.5 rounded-sm bg-bg-hover hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} weight="bold" className="text-text-muted" />
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
                          onClick={() => handleDiffFontSizeChange(-1)}
                          disabled={diffFontSize <= 10}
                          className="p-1.5 rounded-sm bg-bg-hover hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={14} weight="bold" className="text-text-muted" />
                        </button>
                        <span className="w-12 text-center text-sm text-text-primary tabular-nums">
                          {diffFontSize}px
                        </span>
                        <button
                          onClick={() => handleDiffFontSizeChange(1)}
                          disabled={diffFontSize >= 24}
                          className="p-1.5 rounded-sm bg-bg-hover hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

                    {/* AI Review */}
                    <div className="space-y-3 mb-6">
                      <div>
                        <label className="text-sm text-text-primary">AI Review Reviewer</label>
                        <p className="text-xs text-text-muted mt-0.5">
                          Choose which engine powers the AI Review panel
                        </p>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <select
                          value={aiReviewReviewerId}
                          onChange={(e) =>
                            setAIReviewReviewerId(
                              e.target.value as typeof aiReviewReviewerId,
                            )
                          }
                          className="bg-bg-hover border border-border-primary rounded-sm px-2 py-1.5 text-sm text-text-primary focus:outline-hidden focus:border-accent-blue min-w-[260px]"
                        >
                          <option value="claude-cli">Claude CLI (Structured)</option>
                          <option value="coderabbit-cli">CodeRabbit CLI (Text)</option>
                        </select>
                        <div className="text-xs text-text-muted leading-relaxed flex-1">
                          {aiReviewReviewerId === "coderabbit-cli" ? (
                            <span>Working changes only (v1).</span>
                          ) : (
                            <span>Supports skills and commit review.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Skills summary */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-text-primary">Installed Skills</label>
                          <p className="text-xs text-text-muted mt-0.5">
                            Skills provide domain-specific guidelines for AI code reviews
                          </p>
                        </div>
                        <span className="text-sm text-text-muted bg-bg-tertiary px-2 py-1 rounded-sm">
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
                        <span className="text-sm text-text-muted bg-bg-tertiary px-2 py-1 rounded-sm">
                          {selectedSkillIds.length} selected
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setShowSettingsDialog(false);
                          setShowSkillsDialog(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-bg-hover hover:bg-bg-tertiary rounded-sm text-sm text-text-primary transition-colors"
                      >
                        <BookBookmark size={16} weight="bold" />
                        Manage Skills
                        <ArrowSquareOut size={14} className="text-text-muted ml-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'developer' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-4">Developer Settings</h3>

                    {/* Performance Tracing */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="text-sm text-text-primary">Performance Tracing</label>
                        <p className="text-xs text-text-muted mt-0.5">
                          Log timing info to console for debugging render performance
                        </p>
                      </div>
                      <button
                        onClick={() => setPerfTracingEnabled(!perfTracingEnabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                          perfTracingEnabled
                            ? 'bg-accent-blue/20 text-accent-blue'
                            : 'bg-bg-hover text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <Timer size={14} weight="bold" />
                        {perfTracingEnabled ? 'On' : 'Off'}
                      </button>
                    </div>

                    {/* React Scan */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-text-primary">React Scan</label>
                        <p className="text-xs text-text-muted mt-0.5">
                          Highlight components that re-render (requires reload)
                        </p>
                      </div>
                      <button
                        onClick={toggleReactScanAndReload}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                          isReactScanEnabled()
                            ? 'bg-accent-blue/20 text-accent-blue'
                            : 'bg-bg-hover text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <MagnifyingGlass size={14} weight="bold" />
                        {isReactScanEnabled() ? 'On' : 'Off'}
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
