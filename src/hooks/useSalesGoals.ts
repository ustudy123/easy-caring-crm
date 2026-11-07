import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapLeadFromDb, useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { useExternalStores } from "@/hooks/useExternalStores";
import { mapSalesDocument, type SalesDocument } from "@/lib/salesDocuments";
import { isoDay, monthKey, type MonthRange } from "@/lib/salesGoals";
import type { Lead, Seller } from "@/types/crm";

/**
 * Vendedores ativos da equipe externa cujos orçamentos e notas esta pessoa
 * cuida: admin e suporte, todos; gerente, os da loja; vendedor, só ele.
 */
export function useSalesTeamSellers(): Seller[] {
  const { sellers } = useCrm();
  const { isAdmin, isSuporte, isGerente, storeId, sellerId } = useRole();
  const externalStores = useExternalStores();
  return useMemo(() => sellers
    .filter((s) => s.isActive !== false && !!s.store_id && externalStores.has(s.store_id))
    .filter((s) => isAdmin || isSuporte || (isGerente && !!storeId ? s.store_id === storeId : s.id === sellerId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  [sellers, externalStores, isAdmin, isSuporte, isGerente, storeId, sellerId]);
}

export interface SellerMonthGoal { quoteGoal: number | null; salesGoal: number | null }

/** Metas do mês por vendedor e os dias úteis informados pelo gestor. */
export function useMonthlyGoals(month: Date) {
  const key = monthKey(month);
  const [goals, setGoals] = useState<Map<string, SellerMonthGoal>>(new Map());
  const [businessDays, setBusinessDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const [goalsRes, daysRes] = await Promise.all([
      supabase.from("monthly_goals").select("seller_id, quote_goal, sales_goal").eq("month", key),
      supabase.from("month_business_days").select("business_days").eq("month", key).maybeSingle(),
    ]);
    setGoals(new Map((goalsRes.data ?? []).map((g) => [g.seller_id, {
      quoteGoal: g.quote_goal === null ? null : Number(g.quote_goal),
      salesGoal: g.sales_goal === null ? null : Number(g.sales_goal),
    }])));
    setBusinessDays(daysRes.data?.business_days ?? null);
    setLoading(false);
  }, [key]);
  useEffect(() => { reload(); }, [reload]);
  return { goals, businessDays, loading, reload };
}

/** Feriados das lojas da equipe externa ("AAAA-MM-DD"), para sugerir os dias úteis. */
export function useExternalHolidays(externalStores: Set<string>) {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const ids = [...externalStores].sort().join(",");
  useEffect(() => {
    if (!ids) { setHolidays(new Set()); return; }
    let cancelled = false;
    supabase.from("store_holidays").select("holiday_date").in("store_id", ids.split(",")).then(({ data }) => {
      if (!cancelled) setHolidays(new Set((data ?? []).map((h) => h.holiday_date)));
    });
    return () => { cancelled = true; };
  }, [ids]);
  return holidays;
}

/**
 * Orçamentos e notas do período (pela data de emissão), mais os que ainda não
 * têm data (enviados e não conferidos).
 */
export function useSalesDocuments(range: MonthRange, enabled = true) {
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const from = isoDay(range.from);
  const to = isoDay(range.to);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("sales_documents")
      .select("*")
      .or(`and(issue_date.gte.${from},issue_date.lt.${to}),issue_date.is.null`)
      .order("issue_date", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false });
    setError(err ? err.message : null);
    setDocuments((data ?? []).map(mapSalesDocument));
    setLoading(false);
  }, [from, to, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { documents, loading, error, reload };
}

/** Vendas concluídas no período (inclui recorrentes arquivadas). */
export function useClosedSales(range: MonthRange, enabled = true) {
  const [sales, setSales] = useState<Lead[]>([]);
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabase.rpc("get_closed_sales", { _from: from, _to: to }).then(({ data }) => {
      if (!cancelled) setSales((data ?? []).map(mapLeadFromDb));
    });
    return () => { cancelled = true; };
  }, [from, to, enabled]);
  return sales;
}
