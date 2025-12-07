import { useState } from 'react';
import { useTaskStorage } from '@/hooks/useTaskStorage';
import { Button } from '@parent/components/ui/button';
import { Bell, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@parent/components/ui/popover";
import { ScrollArea } from '@parent/components/ui/scroll-area';

export const NotificationBell = () => {
  const { notifications, markNotificationRead, deleteNotification, unreadCount } = useTaskStorage();
  const [open, setOpen] = useState(false);

  const getEmotionEmoji = (emotion: string) => {
    const emojis: Record<string, string> = {
      'very_happy': '😄',
      'happy': '🙂',
      'neutral': '😐',
      'sad': '😢',
      'very_stressed': '😰',
    };
    return emojis[emotion] || '❓';
  };

  const getEmotionLabel = (emotion: string) => {
    const labels: Record<string, string> = {
      'very_happy': 'Very Happy',
      'happy': 'Happy',
      'neutral': 'Neutral',
      'sad': 'Sad',
      'very_stressed': 'Very Stressed',
    };
    return labels[emotion] || emotion;
  };

  const getStressColor = (level: number) => {
    if (level <= 2) return 'text-green-600';
    if (level === 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleNotificationClick = (notificationId: string) => {
    markNotificationRead(notificationId);
  };

  const handleNotificationDelete = (event: React.MouseEvent<HTMLButtonElement>, notificationId: string) => {
    event.stopPropagation();
    deleteNotification(notificationId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 
              ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`
              : 'No new notifications'}
          </p>
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 20).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {getEmotionEmoji(notification.feedback.emotion)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {notification.childName} completed a task
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        "{notification.taskTitle}"
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs">
                          Feeling: {getEmotionLabel(notification.feedback.emotion)}
                        </span>
                        <span className={`text-xs font-medium ${getStressColor(notification.feedback.stressLevel)}`}>
                          Stress: {notification.feedback.stressLevel}/5
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {!notification.read && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                      )}
                      <button
                        type="button"
                        onClick={(event) => handleNotificationDelete(event, notification.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
