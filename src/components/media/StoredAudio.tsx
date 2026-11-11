import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Toca um áudio guardado no Storage (URL assinada de 1 hora). */
export function StoredAudio({ bucket = "seller-files", path, label = "Áudio" }: { bucket?: string; path: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.signedUrl) setFailed(true);
      else setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);
  if (failed) return <p className="text-xs text-muted-foreground">Não foi possível carregar o áudio.</p>;
  if (!url) return <p className="text-xs text-muted-foreground">Carregando áudio…</p>;
  return <audio controls controlsList="nodownload" src={url} className="h-9 max-w-full" aria-label={label} />;
}

/** Extensão do arquivo a partir do tipo de áudio gravado pelo navegador. */
export function audioExtension(type: string): string {
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("wav")) return "wav";
  return "webm";
}
