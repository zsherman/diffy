import { Select } from '@base-ui/react/select';
import {
  BookBookmark,
  Check,
  CaretUpDown,
  GearSix,
} from '@phosphor-icons/react';
import { useUIStore } from '../../../stores/ui-store';
import { useSkills } from '../hooks/useSkills';

export function SkillSelector() {
  const { selectedSkillIds, setSelectedSkillIds, setShowSkillsDialog } = useUIStore();
  const { data: skills = [], isLoading } = useSkills();

  const handleValueChange = (values: string[]) => {
    setSelectedSkillIds(values);
  };

  if (isLoading) {
    return null;
  }

  const selectedSkills = skills.filter((s) => selectedSkillIds.includes(s.id));

  return (
    <div className="space-y-2 mb-4">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wide flex items-center gap-1.5">
        <BookBookmark size={12} weight="bold" />
        Skills (optional)
      </label>

      {skills.length === 0 ? (
        <button
          onClick={() => setShowSkillsDialog(true)}
          className="w-full text-left text-xs text-accent-blue hover:text-accent-blue/80 transition-colors flex items-center gap-1 py-2"
        >
          <GearSix size={12} weight="bold" />
          Install skills for enhanced reviews
        </button>
      ) : (
        <div className="space-y-2">
          <Select.Root
            value={selectedSkillIds}
            onValueChange={handleValueChange}
            multiple
          >
            <Select.Trigger className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-sm text-text-primary hover:border-accent-blue transition-colors cursor-pointer">
              <span className="flex-1 text-left truncate">
                {selectedSkills.length === 0 ? (
                  <span className="text-text-muted">Select skills...</span>
                ) : selectedSkills.length === 1 ? (
                  selectedSkills[0].name
                ) : (
                  `${selectedSkills.length} skills selected`
                )}
              </span>
              <CaretUpDown size={14} className="text-text-muted shrink-0" />
            </Select.Trigger>

            <Select.Portal>
              <Select.Positioner sideOffset={4} className="z-50">
                <Select.Popup className="min-w-[200px] max-w-[300px] max-h-[300px] overflow-auto rounded-lg border border-border-primary bg-bg-secondary shadow-xl outline-hidden">
                  {skills.map((skill) => (
                    <Select.Item
                      key={skill.id}
                      value={skill.id}
                      className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden"
                    >
                      <Select.ItemIndicator className="w-4 mt-0.5 shrink-0">
                        <Check size={14} weight="bold" className="text-accent-purple" />
                      </Select.ItemIndicator>
                      <div
                        className="flex-1 min-w-0"
                        data-no-indicator={!selectedSkillIds.includes(skill.id)}
                      >
                        <div className="font-medium truncate">{skill.name}</div>
                        {skill.description && (
                          <div className="text-xs text-text-muted line-clamp-2">
                            {skill.description}
                          </div>
                        )}
                      </div>
                    </Select.Item>
                  ))}

                  {/* Manage Skills option */}
                  <div className="border-t border-border-primary mt-1 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSkillsDialog(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                    >
                      <GearSix size={12} weight="bold" />
                      Manage Skills...
                    </button>
                  </div>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>

          {/* Selected skills chips */}
          {selectedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedSkills.map((skill) => (
                <span
                  key={skill.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-purple/20 text-accent-purple rounded-sm text-xs font-medium"
                >
                  <BookBookmark size={10} weight="bold" />
                  <span className="truncate max-w-[100px]">{skill.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
