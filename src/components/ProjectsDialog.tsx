import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KANBAN_STAGES } from "@/types/crm";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, FolderKanban } from "lucide-react";

interface Project {
  id: string;
  client_phone: string;
  client_name: string | null;
  name: string;
  stage: string;
  notes: string | null;
  seller_id: string | null;
}

interface Seller { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientPhone: string;
  clientName?: string;
}

const stageLabel = (k: string) => KANBAN_STAGES.find((s) => s.key === k)?.label ?? k;

export function ProjectsDialog({ open, onOpenChange, clientPhone, clientName }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<string>("abordagem");
  const [notes, setNotes] = useState("");
  const [sellerId, setSellerId] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const [projRes, sellRes] = await Promise.all([
      (supabase as any).from("client_projects").select("*").eq("client_phone", clientPhone).order("created_at", { ascending: false }),
      supabase.from("sellers").select("id, name").order("name"),
    ]);
    setProjects((projRes.data as Project[]) || []);
    setSellers((sellRes.data as Seller[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (open && clientPhone) load(); }, [open, clientPhone]);

  const resetForm = () => {
    setEditingId(null); setName(""); setStage("abordagem"); setNotes(""); setSellerId("none"); setShowForm(false);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id); setName(p.name); setStage(p.stage); setNotes(p.notes || "");
    setSellerId(p.seller_id || "none"); setShowForm(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Informe o nome do projeto"); return; }
    setSaving(true);
    const payload = {
      client_phone: clientPhone,
      client_name: clientName || null,
      name: name.trim(),
      stage,
      notes: notes.trim() || null,
      seller_id: sellerId === "none" ? null : sellerId,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await (supabase as any).from("client_projects").update(payload).eq("id", editingId)
      : await (supabase as any).from("client_projects").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editingId ? "Projeto atualizado!" : "Projeto criado!");
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("client_projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const sellerName = (id: string | null) => sellers.find((s) => s.id === id)?.name;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Projetos — {clientName || clientPhone}</DialogTitle>
          <DialogDescription>Cada projeto tem sua própria etapa no funil.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {!showForm && (
              <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo projeto
              </Button>
            )}

            {showForm && (
              <div className="space-y-3 rounded-lg border border-border/60 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nome do projeto *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pintura galpão A" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Etapa</Label>
                    <Select value={stage} onValueChange={setStage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KANBAN_STAGES.map((s) => (<SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Vendedor</Label>
                    <Select value={sellerId} onValueChange={setSellerId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {sellers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Observação</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
                  <Button size="sm" onClick={save} disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}</Button>
                </div>
              </div>
            )}

            {projects.length === 0 && !showForm ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum projeto ainda. Crie o primeiro.</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{stageLabel(p.stage)}</Badge>
                        {p.seller_id && <span className="text-[11px] text-muted-foreground">• {sellerName(p.seller_id)}</span>}
                      </div>
                      {p.notes && <p className="text-[11px] text-muted-foreground mt-1">{p.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
