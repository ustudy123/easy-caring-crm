import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Lock, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/lib/masks";
import { CLIENT_TYPES, type KanbanStage, type Lead } from "@/types/crm";
import { LeadCardFields } from "@/components/forms/LeadCardFields";
import { fromLocalInput, toLocalDateInput } from "@/lib/externalTeam";
import {
  APPLICATION_METHODS, APPLICATION_PLACES, BRANDS, LOW_RATING, LOW_RATING_MIN_CHARS, MONTHLY_VOLUMES, OBJECTION_GROUPS,
  OTHER_BRAND, OTHER_OBJECTION, OTHER_PAINT, OTHER_PLACE, OTHER_PROBLEM, PAINT_TYPES, PURCHASE_DECISIONS,
  QUALIFICATION_GROUPS, SURFACE_PREPS, TECHNICAL_PROBLEMS, missingForStage, postSaleNotesError, stageLabel,
  type LeadQualification,
} from "@/lib/qualification";

// ── Controles de resposta (toques grandes, bons no celular) ─────────────────────
function Chips({ options, value, onChange, multiple = false, label }: {
  options: string[]; value: string[] | string | undefined; onChange: (v: string[] | string | undefined) => void;
  multiple?: boolean; label: string;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const toggle = (o: string) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(o)) next.delete(o); else next.add(o);
      onChange([...next]);
    } else {
      onChange(selected.has(o) ? undefined : o);
    }
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role={multiple ? "checkbox" : "radio"}
          aria-checked={selected.has(o)}
          onClick={() => toggle(o)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs text-left transition-colors",
            selected.has(o) ? "border-brand-500 bg-brand-500 text-white" : "border-border bg-background hover:border-brand-500/50",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function YesNo({ value, onChange, label }: { value?: boolean; onChange: (v?: boolean) => void; label: string }) {
  return (
    <Chips
      label={label}
      options={["Sim", "Não"]}
      value={value === undefined ? undefined : value ? "Sim" : "Não"}
      onChange={(v) => onChange(v === undefined ? undefined : v === "Sim")}
    />
  );
}

function Stars({ value, onChange, label }: { value?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)} className="p-0.5">
          <Star className={cn("h-7 w-7", value && n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v?: string) => void }) {
  return (
    <Question label={label}>
      <Input type="date" aria-label={label} value={toLocalDateInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />
    </Question>
  );
}

/**
 * Qualificação do cliente por etapa (equipe externa). Aberta pelo card ou
 * automaticamente quando o vendedor tenta avançar sem os campos obrigatórios;
 * nesse caso mostra o que falta e o botão "Salvar e mover".
 */
export function LeadQualificationDialog({
  lead, targetStage, canMove = true, open, onOpenChange, onSave,
}: {
  lead: Lead | null;
  targetStage?: KanbanStage;
  /** false quando a etapa de destino depende de outro fluxo (ex.: encerrar venda). */
  canMove?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe o lead atualizado e, se pedido, a etapa para onde mover. */
  onSave: (lead: Lead, moveTo?: KanbanStage) => void;
}) {
  const [draft, setDraft] = useState<Lead | null>(lead);
  useEffect(() => { setDraft(lead); }, [lead]);

  const missing = useMemo(() => (draft && targetStage ? missingForStage(draft, targetStage) : []), [draft, targetStage]);
  const missingKeys = new Set(missing.map((m) => m.group.key));
  const [openItems, setOpenItems] = useState<string[]>([]);
  useEffect(() => {
    if (!lead) return;
    const keys = targetStage ? missingForStage(lead, targetStage).map((m) => m.group.key) : [];
    if (keys.length) { setOpenItems(keys); return; }
    // Sem destino: abre o grupo que o lead precisa completar para o próximo passo.
    const pending = QUALIFICATION_GROUPS.find((g) => g.missing(lead).length > 0);
    setOpenItems(pending ? [pending.key] : []);
  }, [lead, targetStage]);

  if (!draft) return null;
  const x: LeadQualification = draft.qualification ?? {};
  const setQ = (patch: Partial<LeadQualification>) => setDraft((d) => d && ({ ...d, qualification: { ...(d.qualification ?? {}), ...patch } }));
  const setLead = (patch: Partial<Lead>) => setDraft((d) => d && ({ ...d, ...patch }));

  const emailError = draft.clientEmail && !isValidEmail(draft.clientEmail) ? "E-mail inválido" : null;
  const notesError = postSaleNotesError(x);
  const lowRating = [x.deliveryRating, x.productRating].some((r) => !!r && r <= LOW_RATING);
  const canSave = !emailError && !notesError;

  const save = (moveTo?: KanbanStage) => {
    if (!canSave) return;
    onSave({ ...draft, updatedAt: new Date().toISOString() }, moveTo);
  };

  const sections: Record<string, React.ReactNode> = {
    abordagem: (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="q-client-type" className="text-xs font-semibold">Tipo de cliente</Label>
          <Select value={draft.clientType ?? ""} onValueChange={(v) => setLead({ clientType: v })}>
            <SelectTrigger id="q-client-type"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{CLIENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-company" className="text-xs font-semibold">Empresa/Obra</Label>
          <Input id="q-company" value={draft.companyWorkSite ?? ""} onChange={(e) => setLead({ companyWorkSite: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="q-email" className="text-xs font-semibold">E-mail</Label>
          <Input id="q-email" type="email" value={draft.clientEmail ?? ""} onChange={(e) => setLead({ clientEmail: e.target.value })} />
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>
        <LeadCardFields
          value={{ city: draft.city, segment: draft.segment, lastContactAt: draft.lastContactAt, nextAction: draft.nextAction, nextActionAt: draft.nextActionAt }}
          onChange={(patch) => setLead(patch)}
        />
      </div>
    ),
    sondagem: (
      <div className="space-y-4">
        <Question label="Interesse/Produto/Projeto">
          <Input aria-label="Interesse/Produto/Projeto" value={draft.interestProducts ?? ""} onChange={(e) => setLead({ interestProducts: e.target.value })} />
        </Question>
        <Question label="1. Quais tipos de tintas são utilizados atualmente? (mais de uma)">
          <Chips multiple label="Tipos de tinta" options={PAINT_TYPES} value={x.paintTypes} onChange={(v) => setQ({ paintTypes: v as string[] })} />
          {x.paintTypes?.includes(OTHER_PAINT) && (
            <Input aria-label="Outras especificações" placeholder="Quais?" value={x.paintTypesOther ?? ""} onChange={(e) => setQ({ paintTypesOther: e.target.value })} />
          )}
        </Question>
        <Question label="2. Local de aplicação">
          <Chips label="Local de aplicação" options={APPLICATION_PLACES} value={x.applicationPlace} onChange={(v) => setQ({ applicationPlace: v as string | undefined })} />
          {x.applicationPlace === OTHER_PLACE && (
            <Input aria-label="Outras peças" placeholder="Quais peças?" value={x.applicationPlaceOther ?? ""} onChange={(e) => setQ({ applicationPlaceOther: e.target.value })} />
          )}
        </Question>
        <Question label="3. Tipo de preparação de superfícies">
          <Chips label="Preparação de superfície" options={SURFACE_PREPS} value={x.surfacePrep} onChange={(v) => setQ({ surfacePrep: v as string | undefined })} />
        </Question>
        <Question label="4. Marcas utilizadas (mais de uma)">
          <Chips multiple label="Marcas" options={BRANDS} value={x.brands} onChange={(v) => setQ({ brands: v as string[] })} />
          {x.brands?.includes(OTHER_BRAND) && (
            <Input aria-label="Outras marcas" placeholder="Quais marcas?" value={x.brandsOther ?? ""} onChange={(e) => setQ({ brandsOther: e.target.value })} />
          )}
        </Question>
        <Question label="5. Método de aplicação">
          <Chips label="Método de aplicação" options={APPLICATION_METHODS} value={x.applicationMethod} onChange={(v) => setQ({ applicationMethod: v as string | undefined })} />
        </Question>
        <Question label="7. Principais problemas técnicos e de qualidade (mais de uma)">
          <Chips multiple label="Problemas técnicos" options={TECHNICAL_PROBLEMS} value={x.technicalProblems} onChange={(v) => setQ({ technicalProblems: v as string[] })} />
          {x.technicalProblems?.includes(OTHER_PROBLEM) && (
            <Input aria-label="Melhorias desejadas" placeholder="Quais melhorias?" value={x.desiredImprovements ?? ""} onChange={(e) => setQ({ desiredImprovements: e.target.value })} />
          )}
        </Question>
      </div>
    ),
    orcamento: (
      <div className="space-y-4">
        <Question label="8a. Utiliza normas Petrobras?">
          <YesNo label="Normas Petrobras" value={x.petrobrasNorms} onChange={(v) => setQ({ petrobrasNorms: v })} />
        </Question>
        <Question label="8b. Segue alguma especificação técnica específica?">
          <YesNo label="Especificação técnica" value={x.techSpec} onChange={(v) => setQ({ techSpec: v })} />
          {x.techSpec && (
            <Input aria-label="Qual especificação" placeholder="Qual?" value={x.techSpecWhich ?? ""} onChange={(e) => setQ({ techSpecWhich: e.target.value })} />
          )}
        </Question>
        <Question label="8c. Testes industriais ou amostras necessárias?">
          <YesNo label="Testes industriais" value={x.industrialTests} onChange={(v) => setQ({ industrialTests: v })} />
        </Question>
        <Question label="9. Como é tomada a decisão de compra?">
          <Chips label="Decisão de compra" options={PURCHASE_DECISIONS} value={x.purchaseDecision} onChange={(v) => setQ({ purchaseDecision: v as string | undefined })} />
          <Input aria-label="Detalhes da decisão" placeholder="Quem decide / influencia (opcional)" value={x.purchaseDecisionNotes ?? ""}
            onChange={(e) => setQ({ purchaseDecisionNotes: e.target.value })} />
        </Question>
        <p className="text-[11px] text-muted-foreground">
          10. Valor do orçamento: preencha o <strong>Valor estimado</strong> do card. 11. Data do próximo contato: use a <strong>Próxima ação</strong> da Etapa 1.
        </p>
      </div>
    ),
    objecoes: (
      <div className="space-y-3">
        {OBJECTION_GROUPS.map((g) => (
          <Question key={g.title} label={g.title}>
            <Chips
              multiple
              label={`Objeções — ${g.title}`}
              options={g.options}
              value={(x.objections ?? []).filter((o) => g.options.includes(o))}
              onChange={(v) => setQ({ objections: [...(x.objections ?? []).filter((o) => !g.options.includes(o)), ...(v as string[])] })}
            />
          </Question>
        ))}
        {x.objections?.includes(OTHER_OBJECTION) && (
          <Input aria-label="Outra objeção" placeholder="Qual objeção?" value={x.objectionsOther ?? ""} onChange={(e) => setQ({ objectionsOther: e.target.value })} />
        )}
      </div>
    ),
    venda_adicional: (
      <Question label="6. Volume médio de tinta consumido por mês">
        <Chips label="Volume mensal" options={MONTHLY_VOLUMES} value={x.monthlyVolume} onChange={(v) => setQ({ monthlyVolume: v as string | undefined })} />
      </Question>
    ),
    fechamento: (
      <div className="space-y-4">
        <DateField label="Data do envio do pedido" value={x.orderSentAt} onChange={(v) => setQ({ orderSentAt: v })} />
        <Question label="O pedido atende a necessidade total do projeto?">
          <YesNo label="Pedido atende o total" value={x.orderCoversTotal} onChange={(v) => setQ({ orderCoversTotal: v })} />
        </Question>
        {x.orderCoversTotal === false && (
          <DateField label="Previsão do envio do próximo pedido" value={x.nextOrderForecastAt} onChange={(v) => setQ({ nextOrderForecastAt: v })} />
        )}
        <DateField label="Data do pós-venda" value={x.postSaleAt} onChange={(v) => setQ({ postSaleAt: v })} />
        <p className="text-[11px] text-muted-foreground">O PDF da nota fiscal entra com o painel de metas e orçamentos.</p>
      </div>
    ),
    pos_venda: (
      <div className="space-y-4">
        <DateField label="Data da visita ao cliente" value={x.postSaleVisitAt} onChange={(v) => setQ({ postSaleVisitAt: v })} />
        <Question label="Como o cliente avalia a entrega?">
          <Stars label="Avaliação da entrega" value={x.deliveryRating} onChange={(v) => setQ({ deliveryRating: v })} />
        </Question>
        <Question label="Como o cliente avalia o sistema de pintura/produtos?">
          <Stars label="Avaliação dos produtos" value={x.productRating} onChange={(v) => setQ({ productRating: v })} />
        </Question>
        {(lowRating || x.postSaleNotes) && (
          <Question label={lowRating ? `Explique o ocorrido (obrigatório com nota ${LOW_RATING} ou menos)` : "Observação"}>
            <Textarea aria-label="Observação do pós-venda" rows={3} value={x.postSaleNotes ?? ""} onChange={(e) => setQ({ postSaleNotes: e.target.value })} />
            <p className={cn("text-[11px]", notesError ? "text-destructive" : "text-muted-foreground")}>
              {(x.postSaleNotes ?? "").trim().length}/{LOW_RATING_MIN_CHARS} caracteres{notesError ? ` · ${notesError}` : ""}
            </p>
          </Question>
        )}
      </div>
    ),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-brand-500" /> Qualificação · {draft.clientName}</DialogTitle>
          <DialogDescription>
            {targetStage
              ? canMove
                ? `Para mover para "${stageLabel(targetStage)}", complete as etapas marcadas.`
                : "Para encerrar como venda concluída, complete as etapas marcadas e encerre de novo."
              : "Preencha conforme o atendimento avança. Cada etapa precisa estar completa para o card seguir no funil."}
          </DialogDescription>
        </DialogHeader>

        {targetStage && missing.length > 0 && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Falta preencher:</p>
            {missing.map((m) => (
              <p key={m.group.key}><strong>{m.group.title}:</strong> {m.items.join(", ")}</p>
            ))}
          </div>
        )}

        <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-2">
          {QUALIFICATION_GROUPS.map((g) => {
            const pending = g.missing(draft);
            return (
              <AccordionItem key={g.key} value={g.key} className={cn("rounded-xl border px-3", missingKeys.has(g.key) && "border-amber-300")}>
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  <span className="flex items-center gap-2 text-left">
                    {pending.length === 0
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />}
                    <span>
                      {g.title}
                      {pending.length > 0 && (
                        <span className="ml-1.5 whitespace-nowrap text-[11px] font-normal text-muted-foreground">
                          · falta{pending.length > 1 ? "m" : ""} {pending.length}
                        </span>
                      )}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">{sections[g.key]}</AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" variant={targetStage && canMove ? "outline" : "default"} disabled={!canSave} onClick={() => save()}>Salvar</Button>
          {targetStage && canMove && (
            <Button type="button" disabled={!canSave || missing.length > 0} onClick={() => save(targetStage)}>
              Salvar e mover para {stageLabel(targetStage)}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
