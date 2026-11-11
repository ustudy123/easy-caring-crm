import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedView } from "@/components/ProtectedView";

/**
 * Mostra um PDF do Storage só para leitura: as páginas são desenhadas na tela
 * (pdf.js), sem botão de baixar ou imprimir, dentro do ProtectedView (marca
 * d'água com quem está lendo, sem impressão nem cópia).
 */
export function ProtectedPdfViewer({ bucket = "seller-files", path }: { bucket?: string; path: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const holder = box.current;
    setStatus("loading");
    (async () => {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
        if (error || !data?.signedUrl) throw error ?? new Error("sem URL");
        const bytes = await (await fetch(data.signedUrl)).arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
        if (cancelled || !holder) return;
        holder.innerHTML = "";
        const width = Math.min(holder.clientWidth || 800, 900);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.className = "block rounded-lg border border-border/50 bg-white";
          canvas.setAttribute("aria-label", `Página ${i} de ${doc.numPages}`);
          canvas.addEventListener("contextmenu", (e) => e.preventDefault());
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          holder.appendChild(canvas);
        }
        setPages(doc.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [bucket, path]);

  return (
    <ProtectedView className="rounded-xl bg-muted/40 p-2">
      {status === "loading" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo o documento…</p>
      )}
      {status === "error" && <p role="alert" className="text-sm text-destructive p-4">Não foi possível abrir o documento.</p>}
      <div ref={box} className="space-y-2" data-pages={pages} />
    </ProtectedView>
  );
}
