import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BellRing, Loader2, RotateCcw, Save, Store as StoreIcon, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  AlertTimes, AlertTimeSetting, AlertTimesSource, DEFAULT_ALERT_TIMES,
  formatAlertMinutes, mapAlertTimeSetting, resolveAlertTimes, validateAlertTimes,
} from "@/lib/alertTimes";

interface StoreRow { id: string; name: string; is_external_team?: boolean }
interface SellerRow { id: string; name: string; store_id: string | null; is_active: boolean | null; status: string | null }

const SOURCE_LABEL: Record<AlertTimesSource, string> = {
  seller: "Exceção do vendedor",
  store: "Padrão da loja",
  global: "Padrão geral",
  default: "Padrão geral",
};

const FIELDS: { key: keyof AlertTimes; label: string; hint: string }[] = [
  { key: "sellerMinutes", label: "Vendedor", hint: "avisa o vendedor responsável" },
  { key: "managerMinutes", label: "Gerente", hint: "avisa o gerente da loja" },
  { key: "adminMinutes", label: "Gestão", hint: "avisa a gestão (admin)" },
];

/**
 * Linha editável com os três tempos. Sem configuração própria, mostra os tempos
 * herdados e o botão "Personalizar"; com configuração, permite salvar ou voltar
 * a herdar.
 */
function TimesRow({
  title, subtitle, custom, inherited, inheritedLabel, onSave, onReset, canReset = true,
}: {
  title: string;
  subtitle?: string;
  custom: AlertTimes | null;
  inherited: AlertTimes;
  inheritedLabel: string;
  onSave: (t: AlertTimes) => Promise<boolean>;
  onReset?: () => Promise<boolean>;
  canReset?: boolean;
}) {
  const [editing, setEditing] = useState<AlertTimes | null>(custom);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setEditing(custom); }, [custom]);

  const shown = editing ?? inherited;
  const error = editing ? validateAlertTimes(editing) : null;
  const dirty = !!editing && (!custom || FIELDS.some((f) => editing[f.key] !== custom[f.key]));

  const save = async () => {
    if (!editing || error) return;
    setSaving(true);
    if (await onSave(editing)) toast.success(`Tempos de alerta salvos: ${title}`);
    setSaving(false);
  };
  const reset = async () => {
    if (!onReset) { setEditing(null); return; }
    setSaving(true);
    if (await onReset()) toast.success(`${title} voltou a usar: ${inheritedLabel.toLowerCase()}`);
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {custom ? (
          <Badge className="bg-brand-500/10 text-brand-600 border-brand-500/20 hover:bg-brand-500/10">Personalizado</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Usa: {inheritedLabel}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{f.label} (min)</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              aria-label={`${title} — ${f.label} (minutos)`}
              value={shown[f.key]}
              disabled={!editing || saving}
              onChange={(e) => setEditing({ ...shown, [f.key]: Number(e.target.value) })}
              className="h-9"
            />
            <span className="block text-[11px] text-muted-foreground">
              {shown[f.key] > 0 ? formatAlertMinutes(shown[f.key]) : "—"} · {f.hint}
            </span>
          </label>
        ))}
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end flex-wrap">
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing({ ...inherited })}>Personalizar</Button>
        ) : (
          <>
            {canReset && (
              <Button size="sm" variant="ghost" onClick={reset} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> {custom ? `Usar ${inheritedLabel.toLowerCase()}` : "Cancelar"}
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving || !!error || !dirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Salvar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Admin → Alertas: tempos de alerta de atendimento por padrão, loja e vendedor. */
export function AlertTimesTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AlertTimeSetting[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [sellerStore, setSellerStore] = useState<string>("");

  const load = async () => {
    const [settingsRes, storesRes, sellersRes] = await Promise.all([
      supabase.from("alert_time_settings").select("*"),
      supabase.from("stores").select("id, name, is_external_team").order("name"),
      supabase.from("sellers").select("id, name, store_id, is_active, status").order("name"),
    ]);
    if (settingsRes.error) toast.error("Erro ao carregar os tempos de alerta: " + settingsRes.error.message);
    setSettings((settingsRes.data || []).map(mapAlertTimeSetting));
    setStores((storesRes.data as StoreRow[]) || []);
    setSellers(((sellersRes.data as SellerRow[]) || []).filter((s) => s.is_active !== false && s.status !== "inactive"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Começa pela equipe externa, que foi o foco do pedido (tempos maiores).
  useEffect(() => {
    if (!sellerStore && stores.length) setSellerStore((stores.find((s) => s.is_external_team) || stores[0]).id);
  }, [stores, sellerStore]);

  const globalRow = settings.find((s) => !s.storeId && !s.sellerId) || null;
  const globalTimes: AlertTimes = globalRow ?? DEFAULT_ALERT_TIMES;

  const persist = async (existing: AlertTimeSetting | null | undefined, scope: { store_id?: string; seller_id?: string }, t: AlertTimes) => {
    const values = {
      seller_minutes: t.sellerMinutes, manager_minutes: t.managerMinutes, admin_minutes: t.adminMinutes,
      updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
    };
    const { error } = existing
      ? await supabase.from("alert_time_settings").update(values).eq("id", existing.id)
      : await supabase.from("alert_time_settings").insert({ ...values, ...scope });
    if (error) { toast.error("Não foi possível salvar: " + error.message); return false; }
    await load();
    return true;
  };
  const remove = async (existing: AlertTimeSetting | undefined) => {
    if (!existing) return true;
    const { error } = await supabase.from("alert_time_settings").delete().eq("id", existing.id);
    if (error) { toast.error("Não foi possível remover: " + error.message); return false; }
    await load();
    return true;
  };

  const storeSellers = useMemo(() => sellers.filter((s) => s.store_id === sellerStore), [sellers, sellerStore]);

  if (loading) {
    return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BellRing className="h-4 w-4 text-brand-500" /> Tempos de alerta de atendimento</CardTitle>
          <p className="text-sm text-muted-foreground">
            Quanto tempo um cliente pode ficar sem atendimento antes de avisar o vendedor, o gerente e a gestão.
            Vale o mais específico: <strong>exceção do vendedor</strong> → <strong>loja</strong> → <strong>padrão geral</strong>.
          </p>
        </CardHeader>
        <CardContent>
          <TimesRow
            title="Padrão geral"
            subtitle="Vale para todas as lojas e vendedores sem configuração própria."
            custom={globalTimes}
            inherited={DEFAULT_ALERT_TIMES}
            inheritedLabel="Padrão geral"
            canReset={false}
            onSave={(t) => persist(globalRow, {}, t)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><StoreIcon className="h-4 w-4 text-brand-500" /> Por loja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stores.map((st) => {
            const own = settings.find((s) => s.storeId === st.id && !s.sellerId);
            return (
              <TimesRow
                key={st.id}
                title={st.name}
                subtitle={st.is_external_team ? "Equipe de vendas externas" : undefined}
                custom={own ?? null}
                inherited={globalTimes}
                inheritedLabel="Padrão geral"
                onSave={(t) => persist(own, { store_id: st.id }, t)}
                onReset={own ? () => remove(own) : undefined}
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2"><UserCog className="h-4 w-4 text-brand-500" /> Exceções por vendedor</CardTitle>
            <Select value={sellerStore} onValueChange={setSellerStore}>
              <SelectTrigger className="h-9 w-[220px]" aria-label="Loja dos vendedores"><SelectValue placeholder="Escolha a loja" /></SelectTrigger>
              <SelectContent>
                {stores.map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">Só para quem precisa de um tempo diferente do da loja.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {storeSellers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vendedor ativo nesta loja.</p>}
          {storeSellers.map((sl) => {
            const own = settings.find((s) => s.sellerId === sl.id);
            const inheritedRes = resolveAlertTimes(settings.filter((s) => s.sellerId !== sl.id), { storeId: sl.store_id });
            return (
              <TimesRow
                key={sl.id}
                title={sl.name}
                custom={own ?? null}
                inherited={inheritedRes.times}
                inheritedLabel={SOURCE_LABEL[inheritedRes.source]}
                onSave={(t) => persist(own, { seller_id: sl.id }, t)}
                onReset={own ? () => remove(own) : undefined}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
