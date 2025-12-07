import { Users } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = 'Select a Child',
  description = 'Choose a child from the list on the left to view their activities and emotional state.',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Users className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {title}
      </h2>
      <p className="text-muted-foreground max-w-sm">
        {description}
      </p>
    </div>
  );
}
