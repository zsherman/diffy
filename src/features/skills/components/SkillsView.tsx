import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import {
  MagnifyingGlass,
  BookBookmark,
  Globe,
  Plus,
  Trash,
  PencilSimple,
  FloppyDisk,
  ArrowCounterClockwise,
  Copy,
  Check,
  Link,
  Warning,
  CaretRight,
  DownloadSimple,
} from '@phosphor-icons/react';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { markdown } from '@codemirror/lang-markdown';
import { useTheme } from '../../../stores/ui-store';
import {
  useSkills,
  useRemoteSkills,
  useSkillRaw,
  useInstallSkill,
  useDeleteSkill,
  useUpdateSkill,
} from '../hooks/useSkills';
import { LoadingSpinner } from '../../../components/ui';
import { getErrorMessage } from '../../../lib/errors';
import type { SkillMetadata, RemoteSkill } from '../../../types/skills';

type SkillTab = 'installed' | 'remote';

// Union type for selected skill (installed or remote)
type SelectedSkill =
  | { type: 'installed'; skill: SkillMetadata }
  | { type: 'remote'; skill: RemoteSkill };

// Custom CodeMirror theme
const createBaseTheme = (isDark: boolean, fontSize: number) =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
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
    { dark: isDark },
  );

// Skill Editor using CodeMirror
function SkillEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isInternalChange = useRef(false);
  const { theme } = useTheme();
  const isDark = theme === 'pierre-dark';

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleChange = useCallback((newValue: string) => {
    isInternalChange.current = true;
    onChangeRef.current?.(newValue);
    requestAnimationFrame(() => {
      isInternalChange.current = false;
    });
  }, []);

  const extensions = useMemo(() => {
    const exts: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      createBaseTheme(isDark, 13),
      markdown(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !readOnly) {
          handleChange(update.state.doc.toString());
        }
      }),
    ];

    if (isDark) {
      exts.push(oneDark);
    }

    if (readOnly) {
      exts.push(EditorState.readOnly.of(true));
    }

    return exts;
  }, [isDark, readOnly, handleChange]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (isInternalChange.current) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      const currentSelection = view.state.selection;
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
        selection:
          currentSelection.main.to <= value.length ? currentSelection : undefined,
      });
    }
  }, [value]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}

// Skill list item component
function SkillListItem({
  name,
  description,
  isSelected,
  isInstalled,
  onClick,
}: {
  name: string;
  description?: string;
  isSelected: boolean;
  isInstalled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-accent-blue/20 text-text-primary'
          : 'hover:bg-bg-hover text-text-primary'
      }`}
    >
      <BookBookmark
        size={16}
        weight="duotone"
        className={`shrink-0 mt-0.5 ${isInstalled ? 'text-accent-purple' : 'text-text-muted'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          {isInstalled && (
            <span className="text-[10px] px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded-sm">
              Installed
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
            {description}
          </p>
        )}
      </div>
      <CaretRight size={14} className="text-text-muted shrink-0 mt-1" />
    </div>
  );
}

export function SkillsView() {
  const [activeTab, setActiveTab] = useState<SkillTab>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<SelectedSkill | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [hasEdits, setHasEdits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [installUrl, setInstallUrl] = useState('');

  // Data hooks
  const { data: installedSkills = [], isLoading: loadingInstalled } = useSkills();
  const { data: remoteSkills = [], isLoading: loadingRemote } = useRemoteSkills();
  const installSkill = useInstallSkill();
  const deleteSkillMutation = useDeleteSkill();
  const updateSkill = useUpdateSkill();

  // Get raw content for selected installed skill
  const selectedId =
    selected?.type === 'installed' ? selected.skill.id : null;
  const { data: rawContent, isLoading: loadingRaw } = useSkillRaw(selectedId);

  // Set edit content when raw content loads
  useEffect(() => {
    if (rawContent && selected?.type === 'installed') {
      setEditContent(rawContent);
      setHasEdits(false);
    }
  }, [rawContent, selected]);

  // Filter skills based on search query
  const filteredInstalled = useMemo(() => {
    if (!searchQuery.trim()) return installedSkills;
    const q = searchQuery.toLowerCase();
    return installedSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [installedSkills, searchQuery]);

  const filteredRemote = useMemo(() => {
    if (!searchQuery.trim()) return remoteSkills;
    const q = searchQuery.toLowerCase();
    return remoteSkills.filter(
      (s) =>
        s.skill.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q) ||
        s.repo.toLowerCase().includes(q) ||
        `${s.owner}/${s.repo}`.toLowerCase().includes(q),
    );
  }, [remoteSkills, searchQuery]);

  // Check if a remote skill is already installed
  const isRemoteInstalled = useCallback(
    (remote: RemoteSkill) => {
      return installedSkills.some((s) => s.sourceUrl === remote.url);
    },
    [installedSkills],
  );

  // Handlers
  const handleSelectInstalled = useCallback((skill: SkillMetadata) => {
    setSelected({ type: 'installed', skill });
    setError(null);
  }, []);

  const handleSelectRemote = useCallback((skill: RemoteSkill) => {
    setSelected({ type: 'remote', skill });
    setError(null);
    setEditContent('');
    setHasEdits(false);
  }, []);

  const handleEditChange = useCallback(
    (value: string) => {
      setEditContent(value);
      setHasEdits(value !== rawContent);
    },
    [rawContent],
  );

  const handleSave = async () => {
    if (!hasEdits || selected?.type !== 'installed') return;
    setError(null);
    try {
      await updateSkill.mutateAsync({
        skillId: selected.skill.id,
        content: editContent,
      });
      setHasEdits(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleReset = () => {
    if (rawContent) {
      setEditContent(rawContent);
      setHasEdits(false);
      setError(null);
    }
  };

  const handleDelete = async () => {
    if (selected?.type !== 'installed') return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${selected.skill.name}"?`,
    );
    if (!confirmed) return;

    try {
      await deleteSkillMutation.mutateAsync(selected.skill.id);
      setSelected(null);
      setEditContent('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleInstall = async (url: string) => {
    setError(null);
    try {
      const installed = await installSkill.mutateAsync(url);
      // Switch to installed tab and select the new skill
      setActiveTab('installed');
      setSelected({ type: 'installed', skill: installed });
      setInstallUrl('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleInstallRemote = async () => {
    if (selected?.type !== 'remote') return;
    await handleInstall(selected.skill.url);
  };

  const handleCopyUrl = () => {
    if (!selected) return;
    const url =
      selected.type === 'installed'
        ? selected.skill.sourceUrl || selected.skill.id
        : selected.skill.url;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get selected skill display info
  const selectedName =
    selected?.type === 'installed'
      ? selected.skill.name
      : selected?.type === 'remote'
        ? selected.skill.skill
        : null;

  const selectedDescription =
    selected?.type === 'installed' ? selected.skill.description : null;

  const selectedUrl =
    selected?.type === 'installed'
      ? selected.skill.sourceUrl
      : selected?.type === 'remote'
        ? selected.skill.url
        : null;

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden h-full w-full">
      <PanelGroup direction="horizontal" autoSaveId="skills-view-layout">
        {/* Left Panel: Search + List */}
        <Panel defaultSize={25} minSize={15}>
          <div className="flex flex-col h-full border-r border-border-primary">
            {/* Search box */}
            <div className="p-3 border-b border-border-primary">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full pl-9 pr-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue"
                />
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-border-primary">
              <button
                onClick={() => setActiveTab('installed')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'installed'
                    ? 'text-accent-purple border-b-2 border-accent-purple bg-bg-hover'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <BookBookmark size={14} weight="bold" />
                Installed ({filteredInstalled.length})
              </button>
              <button
                onClick={() => setActiveTab('remote')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'remote'
                    ? 'text-accent-blue border-b-2 border-accent-blue bg-bg-hover'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Globe size={14} weight="bold" />
                Remote ({filteredRemote.length})
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
              {activeTab === 'installed' ? (
                loadingInstalled ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : filteredInstalled.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                    <BookBookmark size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">No skills installed</p>
                    <p className="text-xs mt-1">
                      Install from Remote or paste a URL
                    </p>
                  </div>
                ) : (
                  filteredInstalled.map((skill) => (
                    <SkillListItem
                      key={skill.id}
                      name={skill.name}
                      description={skill.description}
                      isSelected={
                        selected?.type === 'installed' &&
                        selected.skill.id === skill.id
                      }
                      isInstalled
                      onClick={() => handleSelectInstalled(skill)}
                    />
                  ))
                )
              ) : loadingRemote ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : filteredRemote.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                  <Globe size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">No skills found</p>
                  <p className="text-xs mt-1">Try a different search</p>
                </div>
              ) : (
                filteredRemote.map((skill) => (
                  <SkillListItem
                    key={skill.url}
                    name={skill.skill}
                    description={`${skill.owner}/${skill.repo}`}
                    isSelected={
                      selected?.type === 'remote' &&
                      selected.skill.url === skill.url
                    }
                    isInstalled={isRemoteInstalled(skill)}
                    onClick={() => handleSelectRemote(skill)}
                  />
                ))
              )}
            </div>

            {/* Install from URL */}
            <div className="p-3 border-t border-border-primary bg-bg-secondary">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1.5 mb-2">
                <Link size={12} />
                Install from URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={installUrl}
                  onChange={(e) => setInstallUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && installUrl.trim()) {
                      handleInstall(installUrl.trim());
                    }
                  }}
                  placeholder="https://skills.sh/..."
                  className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue"
                  disabled={installSkill.isPending}
                />
                <button
                  onClick={() => installUrl.trim() && handleInstall(installUrl.trim())}
                  disabled={!installUrl.trim() || installSkill.isPending}
                  className="px-3 py-1.5 bg-accent-blue text-white rounded-sm text-xs font-medium hover:bg-accent-blue/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {installSkill.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Plus size={12} weight="bold" />
                  )}
                  Add
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border-primary hover:bg-accent-blue/50 transition-colors cursor-col-resize" />

        {/* Center Panel: Preview/Details */}
        <Panel defaultSize={40} minSize={20}>
          <div className="flex flex-col h-full border-r border-border-primary">
            {selected ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-border-primary">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-medium text-text-primary truncate">
                        {selectedName}
                      </h2>
                      {selectedDescription && (
                        <p className="text-sm text-text-muted mt-1">
                          {selectedDescription}
                        </p>
                      )}
                      {selectedUrl && (
                        <p className="text-xs text-text-muted mt-2 truncate">
                          {selectedUrl}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleCopyUrl}
                        className="p-2 rounded-sm hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                        title="Copy URL"
                      >
                        {copied ? (
                          <Check size={14} weight="bold" className="text-accent-green" />
                        ) : (
                          <Copy size={14} weight="bold" />
                        )}
                      </button>
                      {selected.type === 'installed' && (
                        <button
                          onClick={handleDelete}
                          disabled={deleteSkillMutation.isPending}
                          className="p-2 rounded-sm hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors disabled:opacity-50"
                          title="Delete skill"
                        >
                          {deleteSkillMutation.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Trash size={14} weight="bold" />
                          )}
                        </button>
                      )}
                      {selected.type === 'remote' && !isRemoteInstalled(selected.skill) && (
                        <button
                          onClick={handleInstallRemote}
                          disabled={installSkill.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-sm text-xs font-medium hover:bg-accent-blue/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                        >
                          {installSkill.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <DownloadSimple size={12} weight="bold" />
                          )}
                          Install
                        </button>
                      )}
                      {selected.type === 'remote' && isRemoteInstalled(selected.skill) && (
                        <span className="text-xs text-accent-green font-medium flex items-center gap-1">
                          <Check size={12} weight="bold" />
                          Installed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content preview */}
                <div className="flex-1 overflow-auto p-4">
                  {selected.type === 'installed' ? (
                    loadingRaw ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : rawContent ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-primary">
                          {rawContent}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-text-muted text-sm">No content available</p>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                      <Globe size={48} className="mb-3 opacity-50" />
                      <p className="text-sm font-medium">Remote Skill</p>
                      <p className="text-xs mt-1">
                        Install this skill to view and edit its content
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="px-4 pb-4">
                    <div className="text-xs text-accent-red flex items-start gap-1 bg-accent-red/10 rounded-sm p-2">
                      <Warning size={12} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                <BookBookmark size={48} className="mb-3 opacity-50" />
                <p className="text-sm font-medium">No skill selected</p>
                <p className="text-xs mt-1">
                  Select a skill from the list to view details
                </p>
              </div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border-primary hover:bg-accent-blue/50 transition-colors cursor-col-resize" />

        {/* Right Panel: Editor */}
        <Panel defaultSize={35} minSize={20}>
          <div className="flex flex-col h-full">
            {/* Editor header */}
            {selected?.type === 'installed' && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
                <div className="flex items-center gap-2">
                  <PencilSimple size={14} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-primary">
                    Edit Skill
                  </span>
                  {hasEdits && (
                    <span className="text-xs text-accent-yellow">(unsaved)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasEdits && (
                    <button
                      onClick={handleReset}
                      className="p-1.5 rounded-sm hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                      title="Reset changes"
                    >
                      <ArrowCounterClockwise size={14} weight="bold" />
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={!hasEdits || updateSkill.isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-blue text-white rounded-sm text-xs font-medium hover:bg-accent-blue/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                  >
                    {updateSkill.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <FloppyDisk size={12} weight="bold" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Editor area */}
            <div className="flex-1 overflow-hidden">
              {selected?.type === 'installed' ? (
                loadingRaw ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : (
                  <SkillEditor
                    value={editContent}
                    onChange={handleEditChange}
                    readOnly={false}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-muted bg-bg-secondary">
                  <PencilSimple size={48} className="mb-3 opacity-50" />
                  <p className="text-sm font-medium">Editor</p>
                  <p className="text-xs mt-1 text-center px-8">
                    {selected?.type === 'remote'
                      ? 'Install the skill to edit its content'
                      : 'Select an installed skill to edit'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
