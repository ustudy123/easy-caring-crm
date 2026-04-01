import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Columns3, CalendarDays, Megaphone, MessageCircle } from "lucide-react";
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
  const { newLeadsCount, pendingFollowUpsCount, negotiationCount, unreadWhatsAppCount } = useCrm();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("crm-dismissed-notifs") || "{}");
    } catch { return {}; }
  });

  // Persist dismissed to localStorage
  useEffect(() => {
    localStorage.setItem("crm-dismissed-notifs", JSON.stringify(dismissed));
  }, [dismissed]);

  // A notification is visible only if the current count exceeds the dismissed count
  const visibleLeads = Math.max(0, newLeadsCount - (dismissed.leads || 0));
  const visibleFollowUps = Math.max(0, pendingFollowUpsCount - (dismissed.followUps || 0));
  const visibleNegotiations = Math.max(0, negotiationCount - (dismissed.negotiations || 0));
  const visibleWhatsApp = Math.max(0, unreadWhatsAppCount - (dismissed.whatsapp || 0));
  const totalNotifications = visibleLeads + visibleFollowUps + visibleNegotiations + visibleWhatsApp;

  const handleNotificationClick = (type: string, count: number, route: string) => {
    setDismissed((prev) => ({ ...prev, [type]: (prev[type] || 0) + count }));
    navigate(route);
  };
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
                    {visibleLeads > 0 && (
                      <div onClick={() => handleNotificationClick("leads", visibleLeads, "/kanban")} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Columns3 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{visibleLeads} novo(s) lead(s)</p>
                          <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
                        </div>
                      </div>
                    )}
                    {visibleFollowUps > 0 && (
                      <div onClick={() => handleNotificationClick("followUps", visibleFollowUps, "/agenda")} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{visibleFollowUps} follow-up(s)</p>
                          <p className="text-xs text-muted-foreground">Pendentes na agenda</p>
                        </div>
                      </div>
                    )}
                    {visibleNegotiations > 0 && (
                      <div onClick={() => handleNotificationClick("negotiations", visibleNegotiations, "/kanban")} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                          <Megaphone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{visibleNegotiations} em negociação</p>
                          <p className="text-xs text-muted-foreground">Leads em fase final</p>
                        </div>
                      </div>
                    )}
                    {visibleWhatsApp > 0 && (
                      <div onClick={() => handleNotificationClick("whatsapp", "/conversas")} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{visibleWhatsApp} mensagem(ns)</p>
                          <p className="text-xs text-muted-foreground">Novas no WhatsApp</p>
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
