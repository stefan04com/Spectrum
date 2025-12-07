import { Settings, User, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@parent/components/ui/dropdown-menu';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  parentName?: string;
  childCount?: number;
  onProfileClick?: () => void;
}

export function Header({ parentName, childCount, onProfileClick }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const parentRoot = document.getElementById('parent-mode-root');
    const isDarkMode = parentRoot?.classList.contains('dark') ?? false;
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const parentRoot = document.getElementById('parent-mode-root');
    if (!parentRoot) {
      return;
    }
    const newIsDark = !parentRoot.classList.contains('dark');
    setIsDark(newIsDark);
    if (newIsDark) {
      parentRoot.classList.add('dark');
    } else {
      parentRoot.classList.remove('dark');
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <span className="text-xl">🧩</span>
          </div>
          <div>
            <h1 className="font-bold text-foreground">SpectrumAI</h1>
            <p className="text-xs text-muted-foreground">Parent Portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <NotificationBell />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={toggleDarkMode} className="cursor-pointer">
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 mr-2" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 mr-2" />
                    Dark Mode
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                  onProfileClick?.();
                }}
              >
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={onProfileClick}
            className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-semibold text-foreground">{parentName ?? 'Parent'}</span>
              <span className="text-xs text-muted-foreground">{childCount ?? 0} children</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
