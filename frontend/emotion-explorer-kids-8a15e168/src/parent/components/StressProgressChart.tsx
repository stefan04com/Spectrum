import { TaskStressRecord } from '@parent/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Loader2 } from 'lucide-react';

interface StressProgressChartProps {
  records?: TaskStressRecord[];
  loading?: boolean;
}

const MAX_POINTS = 5;

const formatRecords = (records?: TaskStressRecord[]) => {
  if (!records?.length) return [];
  const sliced = records.slice(-MAX_POINTS);
  return sliced.map((record, index) => ({
    ...record,
    xLabel: record.taskName.length > 14 ? `${record.taskName.slice(0, 12)}…` : record.taskName,
    order: index + 1,
  }));
};

const StressTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const datum = payload[0]?.payload;
    if (!datum) return null;
    return (
      <div className="glass-card p-3 rounded-lg animate-scale-in">
        <p className="text-sm font-semibold text-foreground">{datum.taskName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Stress level: <span className="font-semibold text-foreground">{datum.stressLevel}/5</span>
        </p>
        {datum.loggedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Logged {new Date(datum.loggedAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const StressProgressChart = ({ records, loading }: StressProgressChartProps) => {
  const data = formatRecords(records);

  const body = () => {
    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading stress signals…</span>
        </div>
      );
    }

    if (!data.length) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
          <p className="font-medium">No recent task feedback</p>
          <p className="text-sm">Ask your child to submit task emotions to visualize stress progress.</p>
        </div>
      );
    }

    return (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
            <XAxis
              dataKey="xLabel"
              tick={{ fill: 'hsl(240, 5%, 45%)', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(240, 6%, 80%)' }}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fill: 'hsl(240, 5%, 45%)' }}
              axisLine={{ stroke: 'hsl(240, 6%, 80%)' }}
              allowDecimals={false}
            />
            <Tooltip content={<StressTooltip />} />
            <Line
              type="monotone"
              dataKey="stressLevel"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={3}
              dot={{ r: 5, strokeWidth: 2, fill: 'white' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="glass-card p-6 rounded-xl animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Stress Progress</h3>
          <p className="text-sm text-muted-foreground">Last {MAX_POINTS} completed tasks</p>
        </div>
      </div>
      {body()}
    </div>
  );
};
