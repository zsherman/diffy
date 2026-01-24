import { useState, useEffect, useRef } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Field } from '@base-ui/react/field';
import {
  X,
  BookBookmark,
  Trash,
  Plus,
  Link,
  Warning,
  PencilSimple,
  FloppyDisk,
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import { useUIStore } from '../../../stores/ui-store';
import { LoadingSpinner } from '../../../components/ui';
import { getErrorMessage } from '../../../lib/errors';
import {
  useSkills,
  useInstallSkill,
  useDeleteSkill,
  useSkillRaw,
  useUpdateSkill,
} from '../hooks/useSkills';
import type { SkillMetadata } from '../../../types/skills';

function SkillEditor({
  skill,
  onClose,
}: {
  skill: SkillMetadata;
  onClose: () => void;
}) {
  const { data: rawContent, isLoading } = useSkillRaw(skill.id);
  const updateSkill = useUpdateSkill();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (rawContent) {
      setContent(rawContent);
      setHasChanges(false);
    }
  }, [rawContent]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(value !== rawContent);
    setError(null);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setError(null);
    try {
      await updateSkill.mutateAsync({ skillId: skill.id, content });
      setHasChanges(false);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleReset = () => {
    if (rawContent) {
      setContent(rawContent);
      setHasChanges(false);
      setError(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          Edit: {skill.name}
        </span>
        <div className="flex items-center gap-2">
          {hasChanges && (
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
            disabled={!hasChanges || updateSkill.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-blue text-white rounded-sm text-xs font-medium hover:bg-accent-blue/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
          >
            {updateSkill.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <FloppyDisk size={12} weight="bold" />
            )}
            Save
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      <Field.Root>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full h-64 px-3 py-2 bg-bg-primary border border-border-primary rounded-sm text-sm text-text-primary font-mono resize-y focus:outline-hidden focus:border-accent-blue"
          placeholder="---
name: skill-name
description: Skill description
---

# Skill Content

Your skill guidelines here..."
          spellCheck={false}
        />
      </Field.Root>

      {error && (
        <p className="text-xs text-accent-red flex items-center gap-1">
          <Warning size={12} />
          {error}
        </p>
      )}

      <p className="text-xs text-text-muted">
        Edit the skill content including the YAML frontmatter. Changes to the
        name field will rename the skill.
      </p>
    </div>
  );
}

function SkillItem({
  skill,
  onDelete,
  isDeleting,
}: {
  skill: SkillMetadata;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-bg-tertiary rounded-lg border border-border-primary overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-0.5 text-text-muted hover:text-text-primary transition-colors"
        >
          {isExpanded ? (
            <CaretDown size={14} weight="bold" />
          ) : (
            <CaretRight size={14} weight="bold" />
          )}
        </button>

        <BookBookmark
          size={20}
          weight="duotone"
          className="text-accent-purple shrink-0 mt-0.5"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {skill.name}
            </span>
            <span className="text-xs text-text-muted font-mono bg-bg-secondary px-1.5 py-0.5 rounded-sm">
              {skill.id}
            </span>
          </div>
          {skill.description && (
            <p className="text-xs text-text-muted mt-1 line-clamp-2">
              {skill.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              setIsExpanded(true);
              setIsEditing(true);
            }}
            className="p-1.5 rounded-sm hover:bg-bg-hover text-text-muted hover:text-accent-blue transition-colors"
            title="Edit skill"
          >
            <PencilSimple size={14} weight="bold" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-sm hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors disabled:opacity-50"
            title="Delete skill"
          >
            {isDeleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Trash size={14} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content / Editor */}
      {isExpanded && (
        <div className="border-t border-border-primary p-3 bg-bg-secondary">
          {isEditing ? (
            <SkillEditor skill={skill} onClose={() => setIsEditing(false)} />
          ) : (
            <div className="space-y-2">
              {skill.sourceUrl && (
                <p className="text-xs text-text-muted truncate">
                  <span className="font-medium">Source:</span> {skill.sourceUrl}
                </p>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors flex items-center gap-1"
              >
                <PencilSimple size={12} weight="bold" />
                Edit skill content
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SkillsDialog() {
  const { showSkillsDialog, setShowSkillsDialog, selectedSkillIds, setSelectedSkillIds } =
    useUIStore();
  const { data: skills = [], isLoading, error } = useSkills();
  const installSkill = useInstallSkill();
  const deleteSkillMutation = useDeleteSkill();

  const [urlInput, setUrlInput] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleInstall = async () => {
    if (!urlInput.trim()) return;

    setInstallError(null);
    try {
      await installSkill.mutateAsync(urlInput.trim());
      setUrlInput('');
    } catch (err) {
      setInstallError(getErrorMessage(err));
    }
  };

  const handleDelete = async (skillId: string) => {
    setDeletingId(skillId);
    try {
      await deleteSkillMutation.mutateAsync(skillId);
      if (selectedSkillIds.includes(skillId)) {
        setSelectedSkillIds(selectedSkillIds.filter((id) => id !== skillId));
      }
    } catch (err) {
      console.error('Failed to delete skill:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog.Root open={showSkillsDialog} onOpenChange={setShowSkillsDialog}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[90vw] max-h-[85vh] bg-bg-secondary rounded-lg shadow-xl border border-border-primary flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary shrink-0">
            <Dialog.Title className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <BookBookmark size={16} weight="bold" />
              Manage Skills
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded-sm hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Install from URL */}
            <Field.Root className="space-y-2">
              <Field.Label className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Link size={14} />
                Install from URL
              </Field.Label>
              <Field.Description className="text-xs text-text-muted">
                Enter a skills.sh URL (e.g., https://skills.sh/owner/repo/skill-name)
                or a direct link to a raw SKILL.md file.
              </Field.Description>
              <div className="flex gap-2">
                <Field.Control
                  render={
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        setInstallError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !installSkill.isPending) {
                          handleInstall();
                        }
                      }}
                      placeholder="https://skills.sh/owner/repo/skill-name"
                      className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-sm text-text-primary placeholder-text-muted focus:outline-hidden focus:border-accent-blue"
                      disabled={installSkill.isPending}
                    />
                  }
                />
                <button
                  onClick={handleInstall}
                  disabled={!urlInput.trim() || installSkill.isPending}
                  className="px-3 py-2 bg-accent-blue text-white rounded-sm text-sm font-medium hover:bg-accent-blue/90 disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {installSkill.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Plus size={16} weight="bold" />
                  )}
                  Add
                </button>
              </div>
              {installError && (
                <div className="text-xs text-accent-red flex items-start gap-1">
                  <Warning size={12} className="shrink-0 mt-0.5" />
                  <span>{installError}</span>
                </div>
              )}
            </Field.Root>

            {/* Installed Skills */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Installed Skills ({skills.length})
              </label>

              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-text-muted">
                  <LoadingSpinner size="sm" />
                </div>
              ) : error ? (
                <div className="text-sm text-accent-red py-4 text-center">
                  Failed to load skills: {error.message}
                </div>
              ) : skills.length === 0 ? (
                <div className="text-sm text-text-muted py-8 text-center bg-bg-tertiary rounded-lg border border-border-primary border-dashed">
                  <BookBookmark size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No skills installed yet.</p>
                  <p className="text-xs mt-1">
                    Install skills from URLs to enhance AI code reviews.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {skills.map((skill) => (
                    <SkillItem
                      key={skill.id}
                      skill={skill}
                      onDelete={() => handleDelete(skill.id)}
                      isDeleting={deletingId === skill.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
