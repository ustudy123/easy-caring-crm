import { useEffect, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { cn } from "@/lib/utils";

/** Só a gestão (admin e gerente) exporta os painéis de metas e orçamentos. */
export function useCanExport(): boolean {
  const { isAdmin, isGerente } = useRole();
  return isAdmin || isGerente;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Texto da marca d'água: quem está vendo e quando. */
export function watermarkText(name: string | null | undefined, email: string | null | undefined, now: Date = new Date()): string {
  const when = now.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return [name, email, when].filter(Boolean).join(" · ");
}

function watermarkBackground(text: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="170"><text x="10" y="110" transform="rotate(-24 170 85)" font-family="sans-serif" font-size="13" fill="rgba(0,0,0,0.09)">${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * Painel sensível (metas, orçamentos, vendas): marca d'água com o nome de quem
 * está vendo, impressão bloqueada e sem copiar nem arrastar o conteúdo.
 * Print da tela no computador ou foto do celular não dá para bloquear num site;
 * a marca d'água identifica quem vazou.
 */
export function ProtectedView({ children, className }: { children: ReactNode; className?: string }) {
  const { user } = useAuth();
  const { sellerName } = useRole();
  const text = useMemo(() => watermarkText(sellerName, user?.email), [sellerName, user?.email]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        toast.error("A impressão deste painel está bloqueada.");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const block = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div
      data-protected-view
      className={cn("relative select-none", className)}
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      <style>{`@media print { [data-protected-view] { display: none !important; } }`}</style>
      {children}
      <div
        aria-hidden="true"
        data-testid="watermark"
        data-text={text}
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage: watermarkBackground(text), backgroundRepeat: "repeat" }}
      />
    </div>
  );
}
