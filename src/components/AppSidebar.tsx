import {
  LayoutDashboard,
  Columns3,
  Users,
  CalendarDays,
  Megaphone,
  MessageSquare,
  Settings,
  ChevronRight,
  LogOut,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { useCrm } from "@/contexts/CrmContext";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, badgeKey: null as null },
  { title: "Kanban", url: "/kanban", icon: Columns3, badgeKey: "newLeads" as const },
  { title: "Clientes", url: "/clientes", icon: Users, badgeKey: null as null },
  { title: "Agenda", url: "/agenda", icon: CalendarDays, badgeKey: "pendingFollowUps" as const },
];

const toolsNav = [
  { title: "Campanhas", url: "/campanhas", icon: Megaphone, badgeKey: "negotiation" as const },
  { title: "Conversas", url: "/conversas", icon: MessageSquare, badgeKey: "whatsapp" as const },
  { title: "Suporte Orçamento", url: "/suporte-orcamento", icon: FileText, badgeKey: null as null },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { newLeadsCount, pendingFollowUpsCount, negotiationCount, unreadWhatsAppCount } = useCrm();
  const { user, signOut } = useAuth();

  const STORAGE_KEY = "crm-sidebar-dismissed";
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    const next = { ...dismissed };
    if (location.pathname === "/kanban") next.newLeads = newLeadsCount;
    if (location.pathname === "/agenda") next.pendingFollowUps = pendingFollowUpsCount;
    if (location.pathname === "/campanhas") next.negotiation = negotiationCount;
    if (location.pathname === "/conversas") next.whatsapp = unreadWhatsAppCount;
    if (JSON.stringify(next) !== JSON.stringify(dismissed)) {
      setDismissed(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [location.pathname, newLeadsCount, pendingFollowUpsCount, negotiationCount, unreadWhatsAppCount]);

  const badgeMap: Record<string, number> = {
    newLeads: Math.max(0, newLeadsCount - (dismissed.newLeads ?? 0)),
    pendingFollowUps: Math.max(0, pendingFollowUpsCount - (dismissed.pendingFollowUps ?? 0)),
    negotiation: Math.max(0, negotiationCount - (dismissed.negotiation ?? 0)),
    whatsapp: Math.max(0, unreadWhatsAppCount - (dismissed.whatsapp ?? 0)),
  };

  const getBadge = (badgeKey: string | null) => badgeKey ? badgeMap[badgeKey] : 0;

  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  const renderItem = (item: typeof mainNav[0]) => {
    const isActive = location.pathname === item.url;
    const badge = getBadge(item.badgeKey);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive} className="h-auto p-0">
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className={cn(
              "group relative flex items-center transition-colors duration-150",
              collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
              isActive
                ? "text-sidebar-foreground"
                : "text-[#8A8F98] hover:text-sidebar-foreground/80"
            )}
            activeClassName=""
          >
            {/* Active indicator — 2px left border */}
            {isActive && !collapsed && (
              <div className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm bg-sidebar-foreground" />
            )}
            <div className="relative shrink-0">
              <item.icon
                className={cn("h-[18px] w-[18px]", isActive ? "text-sidebar-foreground" : "text-[#8A8F98]")}
                strokeWidth={1.5}
              />
              {collapsed && badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sidebar-foreground text-[8px] font-semibold text-sidebar-background">
                  {badge}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className={cn("text-[13px] leading-none", isActive ? "font-medium" : "font-normal")}>
                {item.title}
              </span>
            )}
            {!collapsed && badge > 0 && (
              <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sidebar-foreground/10 px-1 text-[10px] font-medium text-sidebar-foreground/70 tabular-nums">
                {badge}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      {/* Brand area */}
      <SidebarHeader className={cn("px-4 pt-5 pb-4", collapsed && "flex items-center justify-center px-2 pt-4 pb-3")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          {/* Geometric monogram — sharp square mark */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="11" height="11" rx="1" fill="hsl(var(--sidebar-foreground))" fillOpacity="0.9" />
              <rect x="15" y="2" width="11" height="11" rx="1" fill="hsl(var(--sidebar-foreground))" fillOpacity="0.3" />
              <rect x="2" y="15" width="11" height="11" rx="1" fill="hsl(var(--sidebar-foreground))" fillOpacity="0.3" />
              <rect x="15" y="15" width="11" height="11" rx="1" fill="hsl(var(--sidebar-foreground))" fillOpacity="0.6" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium tracking-tight text-sidebar-foreground">
                CRM Taeco
              </span>
              <span className="text-[10px] font-normal text-[#8A8F98]/60">
                Gestão Comercial
              </span>
            </div>
          )}
        </div>
        {/* Fading divider — 60% width */}
        {!collapsed && (
          <div className="mt-4 flex justify-center">
            <div className="h-px w-[60%]" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--sidebar-foreground) / 0.08) 20%, hsl(var(--sidebar-foreground) / 0.08) 80%, transparent)" }} />
          </div>
        )}
        {collapsed && (
          <div className="mt-2 flex justify-center">
            <div className="h-px w-4" style={{ background: "hsl(var(--sidebar-foreground) / 0.08)" }} />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="pt-1">
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className={cn("space-y-0", collapsed ? "px-1" : "px-0")}>
              {mainNav.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Hairline divider */}
        <div className={cn("my-2 flex justify-center", collapsed ? "px-2" : "px-4")}>
          <div className="h-px w-full" style={{ background: "hsl(var(--sidebar-foreground) / 0.06)" }} />
        </div>

        {/* Tools navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className={cn("space-y-0", collapsed ? "px-1" : "px-0")}>
              {toolsNav.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("p-2", collapsed && "p-1.5")}>
        {/* Settings */}
        <SidebarMenu className={cn("space-y-0", collapsed ? "px-1" : "px-0")}>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-auto p-0">
              <NavLink
                to="/configuracoes"
                className={cn(
                  "flex items-center transition-colors duration-150",
                  collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                  location.pathname === "/configuracoes"
                    ? "text-sidebar-foreground"
                    : "text-[#8A8F98] hover:text-sidebar-foreground/80"
                )}
                activeClassName=""
              >
                {location.pathname === "/configuracoes" && !collapsed && (
                  <div className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm bg-sidebar-foreground" />
                )}
                <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                {!collapsed && <span className="text-[13px]">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Hairline */}
        <div className={cn("my-1.5 flex justify-center", collapsed ? "px-2" : "px-4")}>
          <div className="h-px w-full" style={{ background: "hsl(var(--sidebar-foreground) / 0.06)" }} />
        </div>

        {/* User area */}
        {!collapsed ? (
          <div className="group/footer flex items-center gap-2.5 rounded-md px-4 py-2.5">
            {/* Monochrome square avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-foreground/10 text-[11px] font-semibold text-sidebar-foreground/70">
              {firstName[0].toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-medium text-sidebar-foreground/80">
                {firstName}
              </span>
              <span className="truncate text-[10px] text-[#8A8F98]/50">
                {user?.email}
              </span>
            </div>
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="rounded-md p-1 text-sidebar-foreground/0 transition-all duration-200 group-hover/footer:text-sidebar-foreground/40 hover:!text-sidebar-foreground/70"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-1.5">
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-foreground/10 text-[11px] font-semibold text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/15"
              title="Sair"
            >
              {firstName[0].toUpperCase()}
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
