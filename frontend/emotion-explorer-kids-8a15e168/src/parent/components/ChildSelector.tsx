import { Child } from '@parent/types';
import { cn } from '@parent/lib/utils';
import { Clock, MessageCircle } from 'lucide-react';
import { Badge } from '@parent/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface ChildSelectorProps {
  children: Child[];
  selectedChild: Child | null;
  onSelectChild: (child: Child) => void;
  onAskAboutChild: (child: Child) => void;
}

export function ChildSelector({ children, selectedChild, onSelectChild, onAskAboutChild }: ChildSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">
        My Children
      </h2>
      <div className="space-y-2">
        {children.map((child) => (
          <div
            key={child.id}
            className={cn(
              "w-full rounded-lg transition-all duration-200",
              "hover:shadow-soft",
              selectedChild?.id === child.id
                ? "bg-primary/10 border-2 border-primary shadow-soft"
                : "bg-card hover:bg-muted/50 border-2 border-transparent"
            )}
          >
            <button
              onClick={() => onSelectChild(child)}
              className="w-full flex items-center gap-3 p-3"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-2xl",
                "bg-gradient-to-br from-primary/20 to-secondary/20"
              )}>
                {child.avatar}
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-foreground">{child.name}</h3>
                <p className="text-sm text-muted-foreground">{child.age} years old</p>
                {child.disability && (
                  <Badge variant="secondary" className="mt-1">
                    {child.disability}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {(() => {
                      try {
                        const date = new Date(child.lastActivity);
                        if (isNaN(date.getTime())) return 'Recently';
                        return formatDistanceToNow(date, { addSuffix: true });
                      } catch {
                        return 'Recently';
                      }
                    })()}
                  </span>
                </div>
              </div>
            </button>
            <div className="px-3 pb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAboutChild(child);
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg",
                  "bg-primary/10 hover:bg-primary/20 text-primary font-medium text-sm",
                  "transition-colors duration-200"
                )}
              >
                <MessageCircle className="w-4 h-4" />
                Ask about {child.name}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
