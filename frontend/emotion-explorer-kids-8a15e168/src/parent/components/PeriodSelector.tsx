import { DateRange } from '@parent/types';
import { cn } from '@parent/lib/utils';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';

interface PeriodSelectorProps {
  selected: DateRange;
  onChange: (range: DateRange) => void;
}

const periods: { value: DateRange; label: string; icon: typeof Calendar }[] = [
  { value: 'today', label: 'Today', icon: Calendar },
  { value: 'week', label: 'Week', icon: CalendarDays },
  { value: 'month', label: 'Month', icon: CalendarRange },
];

export function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-2">
      {periods.map((period) => {
        const Icon = period.icon;
        return (
          <button
            key={period.value}
            onClick={() => onChange(period.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
              selected === period.value
                ? "gradient-primary text-primary-foreground shadow-soft"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{period.label}</span>
          </button>
        );
      })}
    </div>
  );
}
