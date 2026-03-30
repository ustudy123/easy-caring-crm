import {
  LayoutDashboard,
  Columns3,
  Users,
  CalendarDays,
  Megaphone,
  MessageSquare,
  Settings,
  Palette,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useCrm } from "@/contexts/CrmContext";

const menuItemsDef = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, badgeKey: null as null },
  { title: "Kanban", url: "/kanban", icon: Columns3, badgeKey: "newLeads" as const },
  { title: "Clientes", url: "/clientes", icon: Users, badgeKey: null as null },
  { title: "Agenda", url: "/agenda", icon: CalendarDays, badgeKey: "pendingFollowUps" as const },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone, badgeKey: "negotiation" as const },
  { title: "Conversas", url: "/conversas", icon: MessageSquare, badgeKey: null as null },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { newLeadsCount, pendingFollowUpsCount, negotiationCount } = useCrm();

  const badgeMap: Record<string, number> = {
    newLeads: newLeadsCount,
    pendingFollowUps: pendingFollowUpsCount,
    negotiation: negotiationCount,
  };

  const menuItems = menuItemsDef.map((item) => ({
    ...item,
    badge: item.badgeKey ? badgeMap[item.badgeKey] : 0,
  }));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("p-5", collapsed && "flex items-center justify-center p-3")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-secondary to-accent shadow-lg shadow-primary/20">
            <Palette className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-sidebar-foreground">
                CRM Taeco
              </span>
              <span className="text-[11px] font-medium text-sidebar-foreground/50">
                Gestão Comercial
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <div className="px-4">
        <Separator className="bg-sidebar-border/60" />
      </div>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          {!collapsed && (
            <span className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/30">
              Menu
            </span>
          )}
          <SidebarGroupContent>
            <SidebarMenu className={cn("space-y-1", collapsed ? "px-0.5" : "px-2")}>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="h-auto p-0">
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={cn(
                          "group relative flex items-center rounded-lg text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          collapsed ? "justify-center px-2 py-2.5 gap-0" : "gap-3 px-3 py-2.5"
                        )}
                        activeClassName="!bg-sidebar-accent !text-sidebar-primary font-semibold"
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                        )}
                        <div className="relative shrink-0">
                          <item.icon className="h-5 w-5" />
                          {collapsed && item.badge > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground animate-pulse">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                        {!collapsed && item.badge > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground animate-pulse">
                            {item.badge}
                          </span>
                        )}
                        {!collapsed && isActive && item.badge === 0 && (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/60" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("p-3", collapsed && "p-2")}>
        {!collapsed && (
          <div className="px-2">
            <Separator className="mb-3 bg-sidebar-border/60" />
          </div>
        )}

        <SidebarMenu className={cn("space-y-1", collapsed ? "px-0.5" : "px-2")}>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-auto p-0">
              <NavLink
                to="/configuracoes"
                className={cn(
                  "flex items-center rounded-lg text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed ? "justify-center px-2 py-2.5 gap-0" : "gap-3 px-3 py-2.5"
                )}
                activeClassName="!bg-sidebar-accent !text-sidebar-primary font-semibold"
              >
                <Settings className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {!collapsed && (
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-sidebar-accent/80 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white shadow-md">
              CS
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-semibold text-sidebar-foreground">
                Carlos Silva
              </span>
              <span className="text-[10px] text-sidebar-foreground/45">Vendedor</span>
            </div>
            <button className="rounded-md p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground/70">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {collapsed && (
          <div className="mt-1 flex justify-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white shadow-md">
              CS
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
