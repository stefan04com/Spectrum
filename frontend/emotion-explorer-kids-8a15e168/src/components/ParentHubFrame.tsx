import { Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@parent/components/ui/tooltip";
import { Toaster } from "@parent/components/ui/toaster";
import { Toaster as Sonner } from "@parent/components/ui/sonner";
import "@parent/index.css";

const parentQueryClient = new QueryClient();

const ParentHubFrame = () => (
  <QueryClientProvider client={parentQueryClient}>
    <TooltipProvider>
      <div id="parent-mode-root" className="parent-mode min-h-[calc(100vh-6rem)] bg-background">
        <Outlet />
      </div>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default ParentHubFrame;
