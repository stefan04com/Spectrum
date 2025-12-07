import { AlertTriangle, Loader2 } from 'lucide-react';
import { ChildAlert } from '@parent/types';
import { Button } from '@parent/components/ui/button';

interface ChildAlertBannerProps {
  alert?: ChildAlert | null;
  loading?: boolean;
  onDismiss?: (alertId: number) => void | Promise<void>;
}

export const ChildAlertBanner = ({ alert, loading, onDismiss }: ChildAlertBannerProps) => {
  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4 animate-pulse">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <div>
          <p className="font-semibold">Checking recent activity…</p>
          <p className="text-sm text-muted-foreground">We are reviewing the latest task feedback.</p>
        </div>
      </div>
    );
  }

  if (!alert) {
    return null;
  }

  const tasks = alert.payload?.tasks ?? [];
  const documents = (alert.payload?.documents ?? [])
    .map(doc => doc.source)
    .filter((source): source is string => Boolean(source));

  const handleDismiss = () => {
    if (!onDismiss) return;
    void onDismiss(alert.id);
  };

  return (
    <div className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-destructive/15 flex items-center justify-center text-destructive">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">High Stress Alert</p>
          <p className="text-base text-foreground mt-1 leading-relaxed">{alert.message}</p>
          {tasks.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground/80">Recent signals</p>
              <ul className="mt-1 space-y-1">
                {tasks.slice(0, 2).map((task, index) => (
                  <li key={`${task.taskName}-${index}`}>
                    {task.taskName} · emotion {task.emotion ?? 'n/a'} · stress {task.stressLevel ?? '?'} / 5
                  </li>
                ))}
              </ul>
            </div>
          )}
          {documents.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Guidance inspired by {documents.join(', ')}
            </p>
          )}
        </div>
        {onDismiss && !alert.acknowledged && (
          <Button variant="ghost" onClick={handleDismiss} className="text-destructive hover:text-destructive">
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
};
