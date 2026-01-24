import { useState } from 'react';
import { Select } from '@base-ui/react/select';
import { SquaresFour, Check, CaretUpDown } from '@phosphor-icons/react';
import { layoutPresets, applyLayout } from '../../lib/layouts';
import { getDockviewApi } from '../../stores/ui-store';

export function LayoutSwitcher() {
  const [selectedLayout, setSelectedLayout] = useState('standard');

  const handleLayoutChange = (layoutId: string | null) => {
    const api = getDockviewApi();
    if (layoutId && api) {
      setSelectedLayout(layoutId);
      applyLayout(api, layoutId);
    }
  };

  const currentLayout = layoutPresets.find((p) => p.id === selectedLayout);

  return (
    <Select.Root value={selectedLayout} onValueChange={handleLayoutChange}>
      <Select.Trigger className="flex items-center gap-1.5 px-3 py-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs rounded-r">
        <SquaresFour size={14} weight="bold" />
        <span className="hidden sm:inline">{currentLayout?.name ?? 'Layout'}</span>
        <CaretUpDown size={10} />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50">
          <Select.Popup className="min-w-[180px] max-w-[250px] overflow-hidden rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-hidden">
            {layoutPresets.map((preset) => (
              <Select.Item
                key={preset.id}
                value={preset.id}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden"
              >
                <Select.ItemIndicator className="w-4">
                  <Check size={14} weight="bold" className="text-accent-green" />
                </Select.ItemIndicator>
                <div className="flex flex-col">
                  <span>{preset.name}</span>
                  <span className="text-xs text-text-muted">{preset.description}</span>
                </div>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
