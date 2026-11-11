import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 5 * 60;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Gravador de áudio do navegador (MediaRecorder): gravar, parar, ouvir antes de
 * enviar, gravar de novo ou descartar. Para sozinho em 5 minutos.
 */
export function AudioRecorder({ onChange, disabled, label = "Gravar áudio" }: {
  onChange: (audio: Blob | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const urlRef = useRef<string | null>(null);
  urlRef.current = url;
  // Ao sair da tela: para o cronômetro, solta o microfone e libera o áudio.
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stop();
    setRecording(false);
  };

  const start = async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não grava áudio. Escreva a resposta.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        onChange(blob);
      };
      recorder.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      }), 1000);
    } catch {
      setError("Não foi possível usar o microfone. Libere o acesso no navegador ou escreva a resposta.");
    }
  };

  const discard = () => {
    setUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {!url && (
        <Button type="button" size="sm" variant={recording ? "destructive" : "outline"} className="gap-1.5" disabled={disabled}
          onClick={recording ? stop : start}>
          {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {recording ? `Parar (${fmt(seconds)})` : label}
        </Button>
      )}
      {recording && <span className={cn("ml-2 inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse")} aria-hidden="true" />}
      {url && (
        <div className="flex flex-wrap items-center gap-2">
          <audio controls src={url} className="h-9 max-w-full" aria-label="Áudio gravado" />
          <Button type="button" size="sm" variant="ghost" className="gap-1 h-8" onClick={() => { discard(); void start(); }} disabled={disabled}>
            <RotateCcw className="h-3.5 w-3.5" /> Gravar de novo
          </Button>
          <Button type="button" size="sm" variant="ghost" className="gap-1 h-8 text-muted-foreground" onClick={discard} disabled={disabled}>
            <Trash2 className="h-3.5 w-3.5" /> Descartar
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
