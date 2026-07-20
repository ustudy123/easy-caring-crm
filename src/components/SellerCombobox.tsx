import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SellerOption {
  id: string;
  name: string;
  store_id?: string;
}

interface SellerGroup {
  label: string;
  items: SellerOption[];
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Lista simples (gerente) OU grupos por loja (admin). Passe um dos dois. */
  sellers?: SellerOption[];
  groups?: SellerGroup[];
  /** Opções fixas no topo (ex.: "Todos os vendedores", "Sem vendedor"). */
  presets?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

/**
 * Combobox de vendedor com busca por digitação (estilo filtro de planilha):
 * conforme o usuário digita, a lista reduz. Substitui o Select puro, que
 * obrigava a rolar entre dezenas de vendedores no perfil admin.
 */
export function SellerCombobox({
  value, onChange, sellers, groups, presets = [], placeholder = "Selecionar vendedor", className,
}: Props) {
  const [open, setOpen] = useState(false);

  // Rótulo do item selecionado, buscando entre presets e vendedores.
  const allSellers = groups ? groups.flatMap((g) => g.items) : (sellers ?? []);
  const selectedLabel =
    presets.find((p) => p.value === value)?.label ??
    allSellers.find((s) => s.id === value)?.name ??
    placeholder;

  const pick = (v: string) => { onChange(v); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between text-xs rounded-lg font-normal", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar vendedor..." className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
            {presets.length > 0 && (
              <CommandGroup>
                {presets.map((p) => (
                  <CommandItem key={p.value} value={p.label} onSelect={() => pick(p.value)} className="text-xs">
                    <Check className={cn("mr-2 h-3.5 w-3.5", value === p.value ? "opacity-100" : "opacity-0")} />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {groups
              ? groups.map((g) => (
                  <CommandGroup key={g.label} heading={g.label}>
                    {g.items.map((s) => (
                      // value inclui a loja para a busca também casar pelo nome da loja
                      <CommandItem key={s.id} value={`${s.name} ${g.label}`} onSelect={() => pick(s.id)} className="text-xs">
                        <Check className={cn("mr-2 h-3.5 w-3.5", value === s.id ? "opacity-100" : "opacity-0")} />
                        {s.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              : (sellers ?? []).map((s) => (
                  <CommandItem key={s.id} value={s.name} onSelect={() => pick(s.id)} className="text-xs">
                    <Check className={cn("mr-2 h-3.5 w-3.5", value === s.id ? "opacity-100" : "opacity-0")} />
                    {s.name}
                  </CommandItem>
                ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
