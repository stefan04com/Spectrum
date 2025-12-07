import { Calendar, Mail, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@parent/components/ui/sheet';
import { Separator } from '@parent/components/ui/separator';
import { Badge } from '@parent/components/ui/badge';
import { Button } from '@parent/components/ui/button';
import { ParentSummary } from '@parent/hooks/useParentSummary';

interface ParentProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ParentSummary | null;
  isLoading: boolean;
  onRefresh?: () => void;
}

export const ParentProfileSheet = ({ open, onOpenChange, summary, isLoading, onRefresh }: ParentProfileSheetProps) => {
  const childList = summary?.children ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>Parent profile</SheetTitle>
          <SheetDescription>Overview of the caregiver account and linked children.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl">
                🧸
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Caregiver</p>
                <h3 className="text-xl font-semibold text-foreground">{summary?.name ?? 'Parent account'}</h3>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {summary?.email ?? '—'}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                {summary?.childCount ?? 0} children connected
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active alerts</p>
                <p className="text-2xl font-bold text-foreground">{summary?.stats?.activeAlerts ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Emotion logs</p>
                <p className="text-2xl font-bold text-foreground">{summary?.stats?.taskLogs ?? 0}</p>
              </div>
            </div>
            {onRefresh && (
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onRefresh} disabled={isLoading}>
                Refresh data
              </Button>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-foreground">Children overview</h4>
              <Badge variant="secondary">{childList.length} linked</Badge>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              {isLoading && !childList.length && (
                <p className="text-sm text-muted-foreground">Loading children…</p>
              )}
              {!isLoading && !childList.length && (
                <p className="text-sm text-muted-foreground">No children are linked to this parent yet.</p>
              )}
              {childList.map((child) => (
                <div key={child.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-foreground">{child.name}</p>
                      <p className="text-sm text-muted-foreground">{child.age} years old</p>
                    </div>
                    {child.level && (
                      <Badge variant="outline" className="text-xs uppercase tracking-wide">{child.level}</Badge>
                    )}
                  </div>
                  {child.disability && (
                    <p className="mt-2 text-sm text-muted-foreground">Support focus: {child.disability}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {child.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> added {new Date(child.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    {child.profileNotes && (
                      <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground/90">
                        Notes: {child.profileNotes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};
