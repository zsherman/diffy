import { Select } from "@base-ui/react/select";
import { Check, CaretUpDown, Calendar } from "@phosphor-icons/react";

// 0.25 represents ~1 week (7 days), handled specially in data fetching
export type TimeRange = 0.25 | 1 | 3 | 6 | 12;

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 0.25, label: "1 week" },
  { value: 1, label: "1 month" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];

/**
 * Dropdown selector for statistics time range
 */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const selectedRange = TIME_RANGES.find((r) => r.value === value);

  const handleValueChange = (newValue: string | null) => {
    if (newValue) {
      onChange(Number(newValue) as TimeRange);
    }
  };

  return (
    <Select.Root value={String(value)} onValueChange={handleValueChange}>
      <Select.Trigger className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-primary bg-bg-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-colors cursor-pointer min-w-[120px]">
        <Calendar size={14} weight="bold" className="text-text-muted" />
        <span className="flex-1 text-left">{selectedRange?.label}</span>
        <CaretUpDown size={12} className="text-text-muted" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50">
          <Select.Popup className="min-w-[140px] rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-hidden">
            {TIME_RANGES.map((range) => (
              <Select.Item
                key={range.value}
                value={String(range.value)}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden"
              >
                <Select.ItemIndicator className="w-4">
                  <Check
                    size={14}
                    weight="bold"
                    className="text-accent-green"
                  />
                </Select.ItemIndicator>
                <span>{range.label}</span>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

