import { useState, useEffect, createContext, useContext } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, AlertTriangle, MessageCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrm, Notification } from "@/contexts/CrmContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TitleCtx = { title: string; setTitle: (t: string) => void };
const PageTitleContext = createContext<TitleCtx>({ title: "", setTitle: () => {} });
export const usePageTitle = () => useContext(PageTitleContext);

export function AppShell() {
  const [title, setTitle] = useState<string>("");
  const location = useLocation();
  const {
    newLeadsCount,
    pendingFollowUpsCount,
    negotiationCount,
    unreadWhatsAppCount,
    notifications,
    markNotificationRead,
  } = useCrm();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("crm-dismissed-notifs") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("crm-dismissed-notifs", JSON.stringify(dismissed));
  }, [dismissed]);

  const nonWhatsAppNotifications = notifications.filter((n) => n.type !== "whatsapp_new_message");
  const totalNotifications = unreadWhatsAppCount + nonWhatsAppNotifications.length;

  const handleSlaNotificationClick = (notif: Notification) => {
    markNotificationRead(notif.id);
    navigate("/conversas");
  };

  const handleWhatsAppNotificationClick = () => {
    navigate("/conversas");
  };

  const markAllAsRead = async () => {
    setDismissed({
      leads: newLeadsCount,
      followUps: pendingFollowUpsCount,
      negotiations: negotiationCount,
      whatsapp: unreadWhatsAppCount,
    });
    for (const notif of notifications) {
      markNotificationRead(notif.id);
    }
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
    <PageTitleContext.Provider value={{ title, setTitle }}>
      <SidebarProvider className="min-h-screen w-full overflow-hidden">
        <AppSidebar className="shadow-[4px_0_24px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_32px_rgba(0,0,0,0.3)] z-40" />
        <SidebarInset className="flex flex-col min-w-0 bg-background h-screen">
            <header
              role="banner"
              className="h-[60px] flex items-center justify-between border-b border-black/10 bg-white px-4 sm:px-6 shrink-0 sticky top-0 z-30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger
                  aria-label="Alternar barra lateral"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                />
                <div className="flex flex-col">
                  {title && (
                    <h1 className="text-[18px] font-medium text-primary tracking-tight leading-tight">
                      {title}
                    </h1>
                  )}
                  <span className="text-[13px] text-muted-foreground">
                    Gestão comercial inteligente
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="relative h-[36px] w-[36px] rounded-[8px] border-black/10 hover:bg-secondary transition-colors"
                    >
                      <Bell className="h-4 w-4" />
                      {totalNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
                          {totalNotifications > 99 ? "99+" : totalNotifications}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[calc(100vw-2rem)] sm:w-80 p-0 rounded-xl shadow-lg border-border/60"
                    align="end"
                    sideOffset={8}
                  >
                    <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
                      <h4 className="text-[13px] font-medium text-foreground">Notificações</h4>
                      {totalNotifications > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="h-7 px-2 text-[11px] font-medium text-primary"
                        >
                          Ler todas
                        </Button>
                      )}
                    </div>
                    <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
                      {unreadWhatsAppCount > 0 && (
                        <div
                          onClick={handleWhatsAppNotificationClick}
                          className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                Mensagens não lidas
                              </p>
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                                {unreadWhatsAppCount > 99 ? "99+" : unreadWhatsAppCount}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {unreadWhatsAppCount === 1
                                ? "1 conversa com mensagem pendente."
                                : `${unreadWhatsAppCount} mensagens aguardando leitura.`}
                            </p>
                          </div>
                        </div>
                      )}
                      {nonWhatsAppNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleSlaNotificationClick(notif)}
                          className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notif.type === "sla_critical" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}
                          >
                            {notif.type === "sla_critical" ? (
                              <ShieldAlert className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">
                                {notif.title}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {notif.message}
                            </p>
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
            <main
              className={cn(
                "flex-1 overflow-auto p-3 sm:p-5 md:p-6",
                location.pathname === "/kanban" && "kanban-scrollbar"
              )}
            >
              <Outlet />
            </main>
        </SidebarInset>
      </SidebarProvider>
    </PageTitleContext.Provider>
  );
}