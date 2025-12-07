import { useCallback, useEffect, useMemo, useState } from 'react';
import { Child } from '@parent/types';
import { useToast } from '@parent/hooks/use-toast';
import { Button } from '@parent/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@parent/components/ui/card';
import { Badge } from '@parent/components/ui/badge';
import { Plus, Sparkles, RefreshCcw } from 'lucide-react';
import { TaskStorageApi, useTaskStorage } from '@/hooks/useTaskStorage';
import { buildBackendUrl } from '@parent/lib/api';

type TaskTemplate = {
  title: string;
  description: string;
  scheduledTime: string;
  focus: string;
};

const QUICK_TASKS: TaskTemplate[] = [
  {
    title: 'Balloon breathing break',
    description: '2 minute guided breathing with arms up like a balloon.',
    scheduledTime: '08:30',
    focus: 'Regulation',
  },
  {
    title: 'Emotion mirror game',
    description: 'Stand in front of the mirror and copy 3 facial expressions.',
    scheduledTime: '10:00',
    focus: 'Awareness',
  },
  {
    title: 'Sensory bag check-in',
    description: 'Let your child pick one calming object and rate how it feels.',
    scheduledTime: '12:30',
    focus: 'Sensory',
  },
  {
    title: 'Stretch + wiggle reset',
    description: '90 second stretch with silly wiggles between tasks.',
    scheduledTime: '15:00',
    focus: 'Movement',
  },
  {
    title: 'Gratitude sticker moment',
    description: 'Name one win from today and place a sticker on the board.',
    scheduledTime: '19:15',
    focus: 'Reflection',
  },
];

interface TaskTemplateCardProps {
  child: Child;
  taskApi?: TaskStorageApi;
}

interface RawTemplate {
  title?: string;
  description?: string;
  scheduled_time?: string;
  focus?: string;
}

export const TaskTemplateCard = ({ child, taskApi }: TaskTemplateCardProps) => {
  const defaultTaskStore = useTaskStorage();
  const taskStore = taskApi ?? defaultTaskStore;
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const normalizeTemplates = (items?: RawTemplate[]): TaskTemplate[] => {
    if (!items || items.length === 0) {
      return QUICK_TASKS;
    }
    return items.map((item, index) => ({
      title: item.title?.trim() || QUICK_TASKS[index % QUICK_TASKS.length].title,
      description: item.description?.trim() || QUICK_TASKS[index % QUICK_TASKS.length].description,
      scheduledTime: item.scheduled_time?.trim() || QUICK_TASKS[index % QUICK_TASKS.length].scheduledTime,
      focus: item.focus?.trim() || QUICK_TASKS[index % QUICK_TASKS.length].focus,
    }));
  };

  const fetchTemplates = useCallback(
    async ({ silent, showToast }: { silent?: boolean; showToast?: boolean } = {}) => {
      setIsFetching(true);
      try {
        const response = await fetch(buildBackendUrl(`/parent/child/${child.id}/task-templates`));
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load task ideas');
        }

        const normalized = normalizeTemplates(payload?.templates);
        setTemplates(normalized);
        if (showToast) {
          toast({
            title: 'AI tasks refreshed',
            description: `Latest regulation ideas ready for ${child.name}.`,
          });
        }
      } catch (error) {
        console.error('Task template fetch error:', error);
        setTemplates(QUICK_TASKS);
        if (!silent) {
          toast({
            title: 'Using default tasks',
            description: 'We could not reach the AI service, so the standard list is shown.',
            variant: 'destructive',
          });
        }
      } finally {
        setIsFetching(false);
        setHasLoaded(true);
      }
    },
    [child.id, child.name, toast]
  );

  useEffect(() => {
    setTemplates([]);
    setHasLoaded(false);
    void fetchTemplates({ silent: true });
  }, [child.id, fetchTemplates]);

  const handleAddTemplate = (template: TaskTemplate) => {
    taskStore.addTask({
      childId: child.id,
      title: template.title,
      scheduledTime: template.scheduledTime,
      date: today,
    });

    toast({
      title: 'Task added',
      description: `${template.title} was placed in ${child.name}'s schedule for today.`,
    });
  };

  const handleRefresh = () => {
    void fetchTemplates({ showToast: true });
    taskStore.refreshTasks?.();
    taskStore.refreshNotifications?.();
  };

  const templatesToRender = templates.length > 0 ? templates : QUICK_TASKS;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            AI generated tasks
          </CardTitle>
          <CardDescription>
            Tasks generated based on your child data
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="self-start"
          disabled={isFetching}
        >
          <RefreshCcw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasLoaded ? (
          templatesToRender.map((template) => (
            <div
              key={`${template.title}-${template.scheduledTime}`}
              className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-xl p-3 bg-card/60"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{template.title}</p>
                  <Badge variant="outline">{template.scheduledTime}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="self-start sm:self-center"
                onClick={() => handleAddTemplate(template)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground px-1">Loading AI suggestions…</p>
        )}
      </CardContent>
    </Card>
  );
};
