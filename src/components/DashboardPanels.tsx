import { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DashboardPanel {
  /** Identificador usado na URL (?painel=...), para abrir direto num painel. */
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Resumo curto mostrado no cartão (ex.: contagens). Opcional. */
  summary?: ReactNode;
  /** Destaque vermelho no cartão (ex.: há clientes em situação grave). */
  alert?: boolean;
  /** Relatório completo; só é montado quando o popup abre. */
  content: () => ReactNode;
}

/**
 * Cartões do dashboard que abrem o relatório completo num popup. Antes os
 * relatórios ficavam empilhados na página, e para chegar ao de baixo era preciso
 * passar por listas longas (ex.: clientes sem atendimento).
 */
export function DashboardPanels({ panels }: { panels: DashboardPanel[] }) {
  const [params, setParams] = useSearchParams();
  const openKey = params.get("painel");
  const open = panels.find((p) => p.key === openKey) ?? null;

  const setOpen = (key: string | null) => {
    const next = new URLSearchParams(params);
    if (key) next.set("painel", key);
    else next.delete("painel");
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {panels.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setOpen(p.key)}
            className={cn(
              "group text-left rounded-[14px] border bg-white p-4 shadow-none transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              p.alert ? "border-red-300 bg-red-50/40" : "border-black/8",
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                p.alert ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary",
              )}>
                <p.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{p.description}</p>
                {p.summary && <div className="mt-2 text-xs">{p.summary}</div>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-6xl p-3 pt-11 sm:p-5 sm:pt-11">
          {open && (
            <>
              {/* Cada relatório já tem o próprio título visível. */}
              <DialogTitle className="sr-only">{open.title}</DialogTitle>
              <DialogDescription className="sr-only">{open.description}</DialogDescription>
              <div className="min-w-0">{open.content()}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
