import { useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import ChildHome from "./pages/Index";
import ParentHubFrame from "./components/ParentHubFrame";
import ParentIndex from "@parent/pages/Index";
import ParentNotFound from "@parent/pages/NotFound";
import Tasks from "./pages/Tasks";
import GameSelect from "./pages/GameSelect";
import LevelSelect from "./pages/LevelSelect";
import GamePlay from "./pages/GamePlay";
import GameComplete from "./pages/GameComplete";
import NotFound from "./pages/NotFound";
import SpeechHelper from "./pages/SpeechHelper";
import VirtualFriend from "./pages/VirtualFriend";
import RoutineBuilder from "./pages/RoutineBuilder";

const queryClient = new QueryClient();

const ModeSwitcher = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentMode = useMemo(() => (location.pathname.startsWith("/child") ? "child" : "parent"), [location.pathname]);

  const handleSwitch = (target: "parent" | "child") => {
    if (target === "parent") {
      navigate("/parent");
    } else {
      navigate("/child");
    }
  };

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Experience Mode</p>
          <p className="text-sm text-muted-foreground">Switch between the parent dashboard and the kid adventures.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={currentMode === "parent" ? "default" : "outline"}
            onClick={() => handleSwitch("parent")}
            className={cn("rounded-full px-5", currentMode === "parent" && "shadow-md")}
            aria-pressed={currentMode === "parent"}
          >
            Parent Mode
          </Button>
          <Button
            variant={currentMode === "child" ? "default" : "outline"}
            onClick={() => handleSwitch("child")}
            className={cn("rounded-full px-5", currentMode === "child" && "shadow-md")}
            aria-pressed={currentMode === "child"}
          >
            Child Mode
          </Button>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <ModeSwitcher />
          <Routes>
            <Route path="/" element={<Navigate to="/parent" replace />} />
            <Route path="/parent" element={<ParentHubFrame />}>
              <Route index element={<ParentIndex />} />
              <Route path="*" element={<ParentNotFound />} />
            </Route>
            <Route path="/child" element={<ChildHome />} />
            <Route path="/child/tasks" element={<Tasks />} />
            <Route path="/child/games" element={<GameSelect />} />
            <Route path="/child/routine" element={<RoutineBuilder />} />
            <Route path="/child/levels" element={<LevelSelect />} />
            <Route path="/child/play/:levelId" element={<GamePlay />} />
            <Route path="/child/complete" element={<GameComplete />} />
            <Route path="/child/speech" element={<SpeechHelper />} />
            <Route path="/child/friend" element={<VirtualFriend />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
