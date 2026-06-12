import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Phone, Mail, MapPin, StickyNote, Plus, Loader2, Activity } from "lucide-react";

type InteractionType = "whatsapp" | "phone" | "email" | "visit" | "note";

interface InteractionRow {
  id: string;
  type: InteractionType;
  description: string;
  created_at: string;
  created_by: string | null;
}

const TYPE_CONFIG: Record<InteractionType, { label: string; icon: typeof Phone; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600 bg-emerald-50" },
  phone: { label: "Ligação", icon: Phone, color: "text-blue-600 bg-blue-50" },
  email: { label: "E-mail", icon: Mail, color: "text-violet-600 bg-violet-50" },
  visit: { label: "Visita", icon: MapPin, color: "text-amber-600 bg-amber-50" },
  note: { label: "Nota", icon: StickyNote, color: "text-slate-600 bg-slate-100" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ClientTimeline({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<InteractionType>("note");
  const [newText, setNewText] = useState("");

  const fetchInteractions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("interactions")
      .select("id, type, description, created_at, created_by")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as InteractionRow[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("interactions").insert({
      client_id: clientId,
      type: newType,
      description: text,
      created_by: user?.id ?? null,
    });
    setAdding(false);
    if (!error) {
      setNewText("");
      setNewType("note");
      fetchInteractions();
    }
  };

  return (
    <div className="rounded-[14px] bg-muted/40 border border-border/30 p-3.5">
      <div className="flex items-center gap-1.5 mb-3">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] tracking-wider text-muted-foreground font-medium uppercase">
          Histórico de atividades
        </p>
      </div>

      {/* Quick add */}
      <div className="flex items-center gap-2 mb-3">
        <Select value={newType} onValueChange={(v) => setNewType(v as InteractionType)}>
          <SelectTrigger className="h-8 w-[120px] text-xs rounded-lg shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_CONFIG) as InteractionType[]).map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {TYPE_CONFIG[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Registrar atividade..."
          className="h-8 text-xs rounded-lg"
        />
        <Button
          size="sm"
          className="h-8 px-2.5 rounded-lg bg-brand-500 hover:opacity-90 shrink-0"
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhuma atividade registrada ainda.
        </p>
      ) : (
        <div className="relative space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {items.map((it, idx) => {
            const cfg = TYPE_CONFIG[it.type] ?? TYPE_CONFIG.note;
            const Icon = cfg.icon;
            return (
              <div key={it.id} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${cfg.color} shrink-0`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {idx < items.length - 1 && <div className="w-px flex-1 bg-border/60 my-1" />}
                </div>
                <div className="flex-1 pb-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-foreground">{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">{relativeTime(it.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{it.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
