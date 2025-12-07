import { TaskEmotionStats } from '@parent/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';

interface MoodBreakdownChartProps {
  stats?: TaskEmotionStats | null;
  loading?: boolean;
}

const emotionConfig = {
    very_happy: { label: 'Very Happy', emoji: '😄', color: 'hsl(142, 76%, 36%)' },
    happy: { label: 'Happy', emoji: '🙂', color: 'hsl(199, 89%, 48%)' },
    neutral: { label: 'Okay', emoji: '😐', color: 'hsl(38, 92%, 50%)' },
    sad: { label: 'Sad', emoji: '😢', color: 'hsl(215, 16%, 47%)' },
    very_stressed: { label: 'Very Stressed', emoji: '😰', color: 'hsl(0, 84%, 60%)' },
  } as const;

const buildChartData = (stats?: TaskEmotionStats | null) => {
    const entries = Object.entries(emotionConfig).map(([key, meta]) => {
      const count = stats?.emotionCounts?.[key] ?? 0;
      return {
        name: key,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        count,
      };
    });

    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const entriesWithPercent = entries.map((entry) => ({
      ...entry,
      percent: total > 0 ? Math.round((entry.count / total) * 100) : 0,
    }));

    const filtered = entriesWithPercent.filter((entry) => entry.count > 0);
    return {
      total,
      entries: entriesWithPercent,
      chartEntries: filtered.length > 0 ? filtered : entriesWithPercent,
    };
  };

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const datum = payload[0]?.payload;
      if (!datum) return null;
      return (
        <div className="glass-card p-3 rounded-lg animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="text-xl">{datum.emoji}</span>
            <span className="font-medium text-foreground">{datum.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{datum.percent}%</span> of logged tasks
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {payload?.map((entry: any, index: number) => {
        const config = emotionConfig[entry.value as keyof typeof emotionConfig];
        if (!config) return null;
        return (
          <div key={index} className="flex items-center gap-1.5">
            <span className="text-lg">{config.emoji}</span>
            <span className="text-sm text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
    </div>
  );

  export function MoodBreakdownChart({ stats, loading }: MoodBreakdownChartProps) {
    const { total, chartEntries } = buildChartData(stats);

    const renderBody = () => {
      if (loading) {
        return (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading recent tasks…</span>
          </div>
        );
      }

      if (total === 0) {
        return (
          <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
            <p className="font-medium">No task feedback yet</p>
            <p className="text-sm">Encourage your child to submit task emotions to see the distribution here.</p>
          </div>
        );
      }

      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartEntries}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="count"
              >
                {chartEntries.map((entry, index) => (
                  <Cell key={`task-emotion-${entry.name}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    };

    return (
      <div className="glass-card p-6 rounded-xl animate-fade-in">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Emotion Distribution
        </h3>
        {renderBody()}
      </div>
    );
  }
