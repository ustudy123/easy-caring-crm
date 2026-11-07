import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Target } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_VISIT_GOALS, mapSellerGoals, validateVisitGoals, type VisitGoals } from "@/lib/visitRoutine";
import { GoogleCalendarCard, useGoogleReturn } from "@/components/GoogleCalendarConnect";
import { useGoogleCalendarConnections } from "@/hooks/useGoogleCalendar";

export interface GoalSellerRow { id: string; name: string; store_id: string | null; storeName: string }

/** Campo numérico; vazio vira null (usado na meta de clientes novos = sem meta). */
function NumberField({ id, label, value, onChange, allowEmpty = false }: {
  id: string; label: string; value: number | null; onChange: (v: number | null) => void; allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        className="h-9 w-full sm:w-28"
        value={value ?? ""}
        placeholder={allowEmpty ? "sem meta" : undefined}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") onChange(allowEmpty ? null : 0);
          else onChange(Number(raw));
        }}
      />
    </div>
  );
}

function GoalsRow({ seller, saved, onSaved, extra }: {
  seller: GoalSellerRow; saved: VisitGoals | null; onSaved: () => void; extra?: ReactNode;
}) {
  const initial = saved ?? DEFAULT_VISIT_GOALS;
  const [draft, setDraft] = useState<VisitGoals>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(saved ?? DEFAULT_VISIT_GOALS); }, [saved]);

  const error = validateVisitGoals(draft);
  const dirty = !saved
    || draft.weeklyPlanned !== saved.weeklyPlanned
    || draft.weeklyDone !== saved.weeklyDone
    || draft.quarterlyNewClients !== saved.quarterlyNewClients;

  const save = async () => {
    if (error) return;
    setSaving(true);
    const { error: err } = await supabase.from("seller_goals").upsert({
      seller_id: seller.id,
      weekly_visits_planned: draft.weeklyPlanned,
      weekly_visits_done: draft.weeklyDone,
      quarterly_new_clients: draft.quarterlyNewClients,
    }, { onConflict: "seller_id" });
    setSaving(false);
    if (err) { toast.error(`Não foi possível salvar as metas: ${err.message}`); return; }
    toast.success(`Metas salvas: ${seller.name}`);
    onSaved();
  };

  const set = (patch: Partial<VisitGoals>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{seller.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {seller.storeName}{!saved && " · usando o padrão (10 planejadas e 5 realizadas)"}
          </p>
        </div>
        {extra}
      </div>
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-end gap-3">
        <NumberField id={`gp-${seller.id}`} label="Visitas planejadas / semana" value={draft.weeklyPlanned} onChange={(v) => set({ weeklyPlanned: v ?? 0 })} />
        <NumberField id={`gd-${seller.id}`} label="Visitas realizadas / semana" value={draft.weeklyDone} onChange={(v) => set({ weeklyDone: v ?? 0 })} />
        <NumberField id={`gn-${seller.id}`} label="Clientes novos / trimestre" value={draft.quarterlyNewClients} onChange={(v) => set({ quarterlyNewClients: v })} allowEmpty />
        <Button size="sm" className="h-9 gap-1.5" onClick={save} disabled={!!error || !dirty || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Admin → Metas: meta de visitas por semana e de clientes novos por trimestre
 * de cada vendedor ativo da equipe externa, e a conexão de cada um com o Google
 * Agenda (o admin pode conectar em nome do vendedor, ex.: um Gmail só da agenda).
 */
export function VisitGoalsTab() {
  const { connections, reload: reloadGoogle } = useGoogleCalendarConnections();
  useGoogleReturn(reloadGoogle);
  const [sellers, setSellers] = useState<GoalSellerRow[]>([]);
  const [goals, setGoals] = useState<Map<string, VisitGoals>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [storesRes, sellersRes, goalsRes] = await Promise.all([
      supabase.from("stores").select("id, name, is_external_team"),
      supabase.from("sellers").select("id, name, store_id, is_active, status").order("name"),
      supabase.from("seller_goals").select("seller_id, weekly_visits_planned, weekly_visits_done, quarterly_new_clients"),
    ]);
    const external = new Map((storesRes.data ?? []).filter((s) => s.is_external_team).map((s) => [s.id, s.name]));
    setSellers((sellersRes.data ?? [])
      .filter((s) => s.store_id && external.has(s.store_id) && s.is_active !== false && s.status !== "inactive")
      .map((s) => ({ id: s.id, name: s.name, store_id: s.store_id, storeName: external.get(s.store_id!) ?? "" })));
    setGoals(new Map((goalsRes.data ?? []).map((g) => [g.seller_id, mapSellerGoals(g)])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-brand-500" /> Metas da equipe externa</CardTitle>
        <p className="text-xs text-muted-foreground">
          Visitas por semana (segunda a domingo) e clientes novos por trimestre, por vendedor. Visita realizada é a que o
          vendedor confirma na Agenda; cliente novo é a primeira venda do cliente em todo o histórico.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
        ) : sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum vendedor ativo em loja de equipe externa. Marque a loja como equipe externa em Lojas.
          </p>
        ) : (
          sellers.map((s) => (
            <GoalsRow
              key={s.id}
              seller={s}
              saved={goals.get(s.id) ?? null}
              onSaved={load}
              extra={<GoogleCalendarCard compact sellerId={s.id} connection={connections.get(s.id)} onChanged={reloadGoogle} />}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
