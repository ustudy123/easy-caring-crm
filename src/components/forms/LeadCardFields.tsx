import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RJ_CITIES, stripAccents } from "@/lib/rjCities";
import { LEAD_SEGMENTS, NEXT_ACTIONS, type LeadSegment, type NextAction } from "@/types/crm";
import { fromLocalInput, toLocalDateInput, toLocalDateTimeInput } from "@/lib/externalTeam";

export interface LeadCardFieldsValue {
  city?: string;
  segment?: LeadSegment;
  lastContactAt?: string;
  nextAction?: NextAction;
  nextActionAt?: string;
}

/** A próxima ação só vale com data (vira compromisso na Agenda). */
export function validateLeadCardFields(v: LeadCardFieldsValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.nextAction && !v.nextActionAt) e.nextActionAt = "Informe a data e a hora da próxima ação.";
  if (!v.nextAction && v.nextActionAt) e.nextAction = "Escolha qual é a próxima ação.";
  return e;
}

function CityCombobox({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Cidade"
          className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || "Buscar cidade do RJ"}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite parte do nome..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma cidade do RJ encontrada.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__limpar__" onSelect={() => { onChange(undefined); setOpen(false); }} className="text-muted-foreground">
                  Limpar cidade
                </CommandItem>
              )}
              {RJ_CITIES.map((c) => (
                // keywords sem acento: digitar "sao g" encontra "São Gonçalo".
                <CommandItem key={c} value={c} keywords={[stripAccents(c)]} onSelect={() => { onChange(c); setOpen(false); }}>
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === c ? "opacity-100" : "opacity-0")} />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Campos do card do cliente da equipe externa (Qualificação de Clientes —
 * Etapa 1): cidade, segmento, último contato e próxima ação com data.
 */
export function LeadCardFields({
  value, onChange, errors = {},
}: {
  value: LeadCardFieldsValue;
  onChange: (patch: Partial<LeadCardFieldsValue>) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="col-span-2 rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-3 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 flex items-center gap-1.5">
        <MapPin className="h-3 w-3" /> Card do cliente · equipe externa
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <CityCombobox value={value.city} onChange={(city) => onChange({ city })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-segment">Segmento</Label>
          <Select value={value.segment ?? ""} onValueChange={(v) => onChange({ segment: v as LeadSegment })}>
            <SelectTrigger id="lead-segment"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {LEAD_SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-last-contact">Último contato</Label>
          <Input
            id="lead-last-contact"
            type="date"
            value={toLocalDateInput(value.lastContactAt)}
            onChange={(e) => onChange({ lastContactAt: fromLocalInput(e.target.value) })}
          />
          <p className="text-[11px] text-muted-foreground">Atualiza sozinho com a última mensagem enviada ao cliente.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-next-action">Próxima ação</Label>
          <Select
            value={value.nextAction ?? ""}
            onValueChange={(v) => onChange({ nextAction: v as NextAction })}
          >
            <SelectTrigger id="lead-next-action"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {NEXT_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.nextAction && <p className="text-xs text-destructive">{errors.nextAction}</p>}
        </div>
        {(value.nextAction || value.nextActionAt) && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="lead-next-action-at">Data da próxima ação</Label>
            <Input
              id="lead-next-action-at"
              type="datetime-local"
              value={toLocalDateTimeInput(value.nextActionAt)}
              onChange={(e) => onChange({ nextActionAt: fromLocalInput(e.target.value) })}
            />
            {errors.nextActionAt
              ? <p className="text-xs text-destructive">{errors.nextActionAt}</p>
              : <p className="text-[11px] text-muted-foreground">Ao salvar, o compromisso entra na Agenda do vendedor.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
