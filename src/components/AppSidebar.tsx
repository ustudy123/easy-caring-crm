import {
  LayoutDashboard,
  Columns3,
  Users,
  CalendarDays,
  MessageSquare,
  Settings,
  ChevronRight,
  LogOut,
  FileText,
  ShieldCheck,
  Sparkles,
  Home,
  TrendingUp,
  Repeat,
  ClipboardList,
  CalendarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import taecoLogo from "@/assets/taeco-logo.png";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badgeKey: string | null;
  roles?: string[];
};

const allMainNav: NavItem[] = [
  {
    title: "Início",
    url: "/",
    icon: Home,
    badgeKey: null,
  },
  {
    title: "CRM Dashboard",
    url: "/crm-dashboard",
    icon: LayoutDashboard,
    badgeKey: null,
    roles: ["admin", "gerente"],
  },
  { title: "Kanban", url: "/kanban", icon: Columns3, badgeKey: "newLeads" },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
    badgeKey: null,
    roles: ["admin", "gerente"],
  },
  {
    title: "Clientes Recorrentes",
    url: "/clientes-recorrentes",
    icon: Repeat,
    badgeKey: null,
  },
  {
    title: "Agenda",
    url: "/agenda",
    icon: CalendarDays,
    badgeKey: "pendingFollowUps",
  },
];

const allToolsNav: NavItem[] = [
  {
    title: "Conversas",
    url: "/conversas",
    icon: MessageSquare,
    badgeKey: "whatsapp",
  },
  {
    title: "Suporte Orçamento",
    url: "/suporte-orcamento",
    icon: FileText,
    badgeKey: null,
    roles: ["admin", "suporte"],
  },
  {
    // Mesma página, rótulo amigável para o vendedor (ele vê só as próprias solicitações).
    title: "Orçamentos/Negociações",
    url: "/suporte-orcamento",
    icon: FileText,
    badgeKey: null,
    roles: ["vendedor"],
  },
  {
    title: "Vendas CRM x ERP",
    url: "/relatorio-vendas",
    icon: TrendingUp,
    badgeKey: null,
    roles: ["admin", "gerente"],
  },
  {
    title: "Relatório de Encerramentos",
    url: "/relatorio-encerramentos",
    icon: ClipboardList,
    badgeKey: null,
    roles: ["admin", "gerente"],
  },
  {
    title: "Feriados",
    url: "/feriados",
    icon: CalendarOff,
    badgeKey: null,
    roles: ["admin", "gerente"],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: ShieldCheck,
    badgeKey: null,
    roles: ["admin"],
  },
];

export function AppSidebar({ className }: { className?: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const {
    newLeadsCount,
    pendingFollowUpsCount,
    negotiationCount,
    unreadWhatsAppCount,
    notifications,
  } = useCrm();
  const { user, signOut } = useAuth();
  const { role } = useRole();

  const mainNav = useMemo(
    () =>
      allMainNav.filter(
        (item) => !item.roles || (role && item.roles.includes(role)),
      ),
    [role],
  );
  const toolsNav = useMemo(() => {
    return allToolsNav.filter(
      (item) => !item.roles || (role && item.roles.includes(role)),
    );
  }, [role]);

  const STORAGE_KEY = "crm-sidebar-dismissed";
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const next = { ...dismissed };
    if (location.pathname === "/kanban") next.newLeads = newLeadsCount;
    if (location.pathname === "/agenda")
      next.pendingFollowUps = pendingFollowUpsCount;
    if (location.pathname === "/campanhas") next.negotiation = negotiationCount;
    if (location.pathname === "/conversas") next.whatsapp = unreadWhatsAppCount;
    if (JSON.stringify(next) !== JSON.stringify(dismissed)) {
      setDismissed(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [
    location.pathname,
    newLeadsCount,
    pendingFollowUpsCount,
    negotiationCount,
    unreadWhatsAppCount,
  ]);

  const badgeMap: Record<string, number> = {
    newLeads: Math.max(0, newLeadsCount - (dismissed.newLeads ?? 0)),
    pendingFollowUps: Math.max(
      0,
      pendingFollowUpsCount - (dismissed.pendingFollowUps ?? 0),
    ),
    negotiation: Math.max(0, negotiationCount - (dismissed.negotiation ?? 0)),
    whatsapp: Math.max(0, unreadWhatsAppCount - (dismissed.whatsapp ?? 0)),
    notifications: notifications.length,
  };

  const getBadge = (badgeKey: string | null) =>
    badgeKey ? badgeMap[badgeKey] : 0;

  const firstName =
    user?.user_metadata?.display_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "User";

  // Apelido (display_name) é o que aparece na sidebar — nunca o e-mail.
  const apelido =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const fullName = user?.user_metadata?.full_name || "";

  const renderItem = (item: { title: string; url: string; icon: React.ComponentType<any>; badgeKey: string | null }) => {
    const isActive = location.pathname === item.url;
    const badge = getBadge(item.badgeKey);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive} className="h-auto p-0 hover:bg-transparent">
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className={cn(
              "group relative flex items-center transition-all duration-200 rounded-[10px] mx-2 px-3 py-2.5 overflow-hidden",
              isActive
                ? "text-white bg-gradient-to-r from-brand-500/20 via-brand-500/10 to-transparent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                : "text-white/55 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-500 shadow-[0_0_10px_2px_rgba(243,112,33,0.55)]"
              />
            )}
            <span
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-[8px] shrink-0 transition-all duration-200",
                isActive
                  ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30"
                  : "text-white/55 group-hover:text-white group-hover:bg-white/[0.06]"
              )}
            >
              <item.icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </span>
            {!collapsed && (
              <span className={cn(
                "ml-3 text-[13px] tracking-[-0.005em] transition-colors",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {item.title}
              </span>
            )}
            {badge > 0 && !collapsed && (
              <span className="ml-auto h-[18px] min-w-[18px] flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-semibold px-1.5 ring-2 ring-sidebar-background shadow-sm">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {badge > 0 && collapsed && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-sidebar-background" />
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "relative border-r border-white/[0.04]",
        "bg-[linear-gradient(180deg,#161412_0%,#0E0C0B_60%,#0A0908_100%)]",
        className,
      )}
    >
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-[140%] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(ellipse at center, #F37021 0%, transparent 60%)" }}
      />

      {/* Brand area */}
      <SidebarHeader className="relative p-4 pt-5 pb-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="relative h-[38px] w-[38px] rounded-[10px] bg-white flex items-center justify-center shrink-0 p-1 ring-1 ring-white/10 shadow-[0_4px_12px_-2px_rgba(243,112,33,0.35)]">
            <img src={taecoLogo} alt="Taeco Tintas" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-bold text-white leading-tight tracking-tight">CRM Taeco</span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-brand-500/90 leading-tight mt-0.5">
                Gestão Comercial
              </span>
            </div>
          )}
        </div>
        {!collapsed && (
          <div
            className="mt-5 h-px w-full"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }}
          />
        )}
      </SidebarHeader>

      <SidebarContent className="relative pt-1">
        {/* Main navigation */}
        <SidebarGroup className="py-2">
          {!collapsed && (
            <SidebarGroupLabel className="mb-1.5 px-4 text-[10px] uppercase tracking-[0.14em] font-semibold text-white/30">
              Principal
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu
              className={cn("space-y-0.5", collapsed ? "px-1" : "px-0")}
            >
              {mainNav.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!collapsed && (
          <div
            className="mx-4 my-1 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
          />
        )}
        <SidebarGroup className="py-2">
          {!collapsed && (
            <SidebarGroupLabel className="mb-1.5 px-4 text-[10px] uppercase tracking-[0.14em] font-semibold text-white/30">
              Ferramentas
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu
              className={cn("space-y-0.5", collapsed ? "px-1" : "px-0")}
            >
              {toolsNav.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("relative p-2", collapsed && "p-1.5")}>
        {/* Settings */}
        <SidebarMenu className={cn("space-y-0", collapsed ? "px-1" : "px-0")}>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-auto p-0 hover:bg-transparent">
              <NavLink
                to="/configuracoes"
                title={collapsed ? "Configurações" : undefined}
                className={cn(
                  "group relative flex items-center transition-all duration-200 rounded-[10px] mx-1 overflow-hidden",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  location.pathname === "/configuracoes"
                    ? "text-white bg-gradient-to-r from-brand-500/20 via-brand-500/10 to-transparent"
                    : "text-white/55 hover:text-white hover:bg-white/[0.04]",
                )}
                activeClassName=""
              >
                {location.pathname === "/configuracoes" && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-500 shadow-[0_0_10px_2px_rgba(243,112,33,0.55)]"
                  />
                )}
                <span
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-[8px] shrink-0 transition-all duration-200",
                    location.pathname === "/configuracoes"
                      ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30"
                      : "text-white/55 group-hover:text-white group-hover:bg-white/[0.06]"
                  )}
                >
                  <Settings className="h-[15px] w-[15px]" strokeWidth={1.75} />
                </span>
                {!collapsed && (
                  <span className="text-[13px] font-medium">Configurações</span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Hairline + footer separator */}
        <div
          className={cn(
            "my-2 flex justify-center",
            collapsed ? "px-2" : "px-4",
          )}
        >
          <div
            className="h-px w-full"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }}
          />
        </div>

        {/* User area */}
        {!collapsed ? (
          <div className="group/footer mx-1 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 bg-white/[0.025] border border-white/[0.05] hover:border-white/10 transition-colors">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-brand-500 to-brand-600 text-[12px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(243,112,33,0.6)]">
              {firstName[0].toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0E0C0B]" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-semibold text-white/90 leading-tight">
                {apelido}
              </span>
              {fullName && (
                <span className="truncate text-[10.5px] text-white/40 leading-tight mt-0.5">
                  {fullName}
                </span>
              )}
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              title="Sair"
              className="rounded-md p-1.5 text-white/30 transition-all duration-200 hover:text-brand-500 hover:bg-brand-500/10"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-1.5">
            <button
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-br from-brand-500 to-brand-600 text-[12px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(243,112,33,0.6)] transition-transform hover:scale-105"
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
