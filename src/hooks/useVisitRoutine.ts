import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { useExternalStores } from "@/hooks/useExternalStores";
import { mapSellerGoals, type Range, type VisitCount, type VisitGoals } from "@/lib/visitRoutine";
import type { Seller } from "@/types/crm";

/**
 * Vendedores da equipe externa que o usuário acompanha na rotina de visitas:
 * admin vê todos, gerente os da própria loja e o vendedor só a si mesmo.
 * Inativados no Admin ficam de fora.
 */
export function useVisitRoutineSellers(): Seller[] {
  const { sellers } = useCrm();
  const { isAdmin, isGerente, storeId, sellerId } = useRole();
  const externalStores = useExternalStores();
  return useMemo(() => sellers
    .filter((s) => s.isActive !== false && !!s.store_id && externalStores.has(s.store_id))
    .filter((s) => isAdmin || (isGerente && !!storeId ? s.store_id === storeId : s.id === sellerId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  [sellers, externalStores, isAdmin, isGerente, storeId, sellerId]);
}

export function useSellerGoals() {
  const [goals, setGoals] = useState<Map<string, VisitGoals>>(new Map());
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("seller_goals")
      .select("seller_id, weekly_visits_planned, weekly_visits_done, quarterly_new_clients");
    if (!error && data) setGoals(new Map(data.map((r) => [r.seller_id, mapSellerGoals(r)])));
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const goalFor = useCallback((sellerId: string) => goals.get(sellerId) ?? mapSellerGoals(null), [goals]);
  return { goals, goalFor, loading, reload };
}

export function useVisitProgress(range: Range, enabled = true) {
  const [bySeller, setBySeller] = useState<Map<string, VisitCount>>(new Map());
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    supabase.rpc("get_visit_progress", { _from: from, _to: to }).then(({ data, error: err }) => {
      if (cancelled) return;
      setError(err ? err.message : null);
      setBySeller(new Map((data ?? []).map((r) => [r.seller_id, { planned: r.planned, done: r.done }])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [from, to, enabled]);
  return { bySeller, loading, error };
}

export interface NewClientRow {
  sellerId: string;
  leadId: string;
  clientName: string;
  clientPhone: string;
  closedAt: string;
  value: number;
}

export function useNewClients(range: Range, enabled = true) {
  const [rows, setRows] = useState<NewClientRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    supabase.rpc("get_new_clients", { _from: from, _to: to }).then(({ data, error: err }) => {
      if (cancelled) return;
      setError(err ? err.message : null);
      setRows((data ?? []).map((r) => ({
        sellerId: r.seller_id,
        leadId: r.lead_id,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        closedAt: r.closed_at,
        value: Number(r.value) || 0,
      })));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [from, to, enabled]);
  return { rows, loading, error };
}
