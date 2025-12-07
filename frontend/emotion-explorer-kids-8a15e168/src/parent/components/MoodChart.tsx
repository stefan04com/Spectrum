import { MoodEntry } from '@parent/types';
import { moodColors, moodEmojis, moodLabels } from '@parent/data/mockData';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { format } from 'date-fns';

interface MoodChartProps {
  data: MoodEntry[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload as MoodEntry;
    
    // Safe date formatting
    let formattedDate = 'Unknown date';
    try {
      const date = new Date(entry.date);
      if (!isNaN(date.getTime())) {
        formattedDate = format(date, 'EEEE, MMMM d');
      }
    } catch {
      // Keep default
    }
    
    return (
      <div className="glass-card p-3 rounded-lg animate-scale-in">
        <p className="font-semibold text-foreground">{formattedDate}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-2xl">{moodEmojis[entry.mood]}</span>
          <span className="text-muted-foreground">{moodLabels[entry.mood]}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Score: <span className="font-semibold text-foreground">{entry.score}%</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Activities: <span className="font-semibold text-foreground">{entry.activities}</span>
        </p>
      </div>
    );
  }
  return null;
};

export function MoodChart({ data }: MoodChartProps) {
  const chartData = data.map((entry) => {
    let formattedDate = 'N/A';
    try {
      const date = new Date(entry.date);
      if (!isNaN(date.getTime())) {
        formattedDate = format(date, 'EEE');
      }
    } catch {
      // Keep default
    }
    return {
      ...entry,
      formattedDate,
      color: moodColors[entry.mood],
    };
  });

  return (
    <div className="glass-card p-6 rounded-xl animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Emotional Progress
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
            <XAxis
              dataKey="formattedDate"
              stroke="hsl(215, 16%, 47%)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="hsl(215, 16%, 47%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(199, 89%, 48%)"
              strokeWidth={3}
              fill="url(#moodGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
