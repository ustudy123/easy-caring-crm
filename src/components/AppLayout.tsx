import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Columns3, CalendarDays, Megaphone, MessageCircle, Sun, Moon, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrm, Notification } from "@/contexts/CrmContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
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
  const { 
    newLeadsCount, 
    pendingFollowUpsCount, 
    negotiationCount, 
    unreadWhatsAppCount, 
    notifications,
    markNotificationRead
  } = useCrm();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("crm-dismissed-notifs") || "{}");
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem("crm-dismissed-notifs", JSON.stringify(dismissed));
  }, [dismissed]);

  const visibleLeads = Math.max(0, newLeadsCount - (dismissed.leads || 0));
  const visibleFollowUps = Math.max(0, pendingFollowUpsCount - (dismissed.followUps || 0));
  const visibleNegotiations = Math.max(0, negotiationCount - (dismissed.negotiations || 0));
  const visibleWhatsApp = Math.max(0, unreadWhatsAppCount - (dismissed.whatsapp || 0));
   const totalNotifications = notifications.filter(n => n.type === 'sla_critical').length || notifications.length;

  const handleNotificationClick = (type: string, count: number, route: string) => {
    setDismissed((prev) => ({ ...prev, [type]: (prev[type] || 0) + count }));
    navigate(route);
  };

  const handleSlaNotificationClick = (notif: Notification) => {
    markNotificationRead(notif.id);
    navigate("/conversas");
  };

  const markAllAsRead = async () => {
    setDismissed({
      leads: newLeadsCount,
      followUps: pendingFollowUpsCount,
      negotiations: negotiationCount,
      whatsapp: unreadWhatsAppCount
    });

    // Mark notifications as read
    for (const notif of notifications) {
      markNotificationRead(notif.id);
    }

    // Marcar todas as mensagens do WhatsApp como lidas no banco de dados
    if (unreadWhatsAppCount > 0) {
      const { error } = await supabase
        .from("whatsapp_messages")
        .update({ is_read: true })
        .eq("is_read", false)
        .eq("is_from_me", false);
      
      if (error) console.error("Erro ao marcar todas as mensagens como lidas:", error);
    }
  };
 
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            role="banner"
            className="h-14 sm:h-16 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-4 sm:px-6 shrink-0 sticky top-0 z-30"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger
                aria-label="Alternar barra lateral"
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-md"
              />
              {title && (
                <h1 className="text-sm sm:text-lg font-extrabold text-foreground truncate tracking-tight">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl hover:bg-muted transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                     aria-label={`Notificações${totalNotifications > 0 ? `, ${totalNotifications} alertas pendentes` : ""}`}
                    className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl hover:bg-muted transition-colors"
                  >
                    <Bell className="h-4 w-4" aria-hidden="true" />
                     {totalNotifications > 0 && (
                       <span
                         aria-hidden="true"
                         className={cn(
                           "absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-card transition-all",
                           notifications.some(n => n.type === 'sla_critical') 
                             ? "bg-destructive text-destructive-foreground animate-pulse" 
                             : "bg-amber-500 text-white"
                         )}
                       >
                         {totalNotifications > 9 ? "9+" : totalNotifications}
                       </span>
                     )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-0 rounded-xl shadow-lg border-border/60" align="end" sideOffset={8}>
                   <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
                     <h4 className="text-sm font-bold text-foreground">Notificações</h4>
                     {totalNotifications > 0 && (
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={markAllAsRead}
                         className="h-7 px-2 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/5 rounded-lg"
                       >
                         Ler todas
                       </Button>
                     )}
                   </div>
                   <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleSlaNotificationClick(notif)} 
                    className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notif.type === 'sla_critical' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                      {notif.type === 'sla_critical' ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-success/20 text-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            markNotificationRead(notif.id);
                          }}
                          title="Resolver alerta"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                    </div>
                  </div>
                ))}
                    {totalNotifications === 0 && (
                      <div className="p-8 text-center">
                        <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-5 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
