import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Columns3, CalendarDays, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrm } from "@/contexts/CrmContext";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { newLeadsCount, pendingFollowUpsCount, negotiationCount } = useCrm();
  const totalNotifications = newLeadsCount + pendingFollowUpsCount + negotiationCount;
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 sm:h-14 flex items-center justify-between border-b bg-card px-3 sm:px-4 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
              {title && <h1 className="text-base sm:text-lg font-bold text-foreground truncate">{title}</h1>}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9">
                    <Bell className="h-4 w-4" />
                    {totalNotifications > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground animate-pulse">
                        {totalNotifications > 99 ? "99+" : totalNotifications}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-3 border-b">
                    <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
                  </div>
                  <div className="divide-y">
                    {newLeadsCount > 0 && (
                      <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Columns3 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{newLeadsCount} novo(s) lead(s)</p>
                          <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
                        </div>
                      </div>
                    )}
                    {pendingFollowUpsCount > 0 && (
                      <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{pendingFollowUpsCount} follow-up(s)</p>
                          <p className="text-xs text-muted-foreground">Pendentes na agenda</p>
                        </div>
                      </div>
                    )}
                    {negotiationCount > 0 && (
                      <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                          <Megaphone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{negotiationCount} em negociação</p>
                          <p className="text-xs text-muted-foreground">Leads em fase final</p>
                        </div>
                      </div>
                    )}
                    {totalNotifications === 0 && (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma notificação
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
