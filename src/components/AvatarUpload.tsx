import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  userId: string;
  initialUrl?: string | null;
  displayName?: string | null;
  /** Admin trocando a foto de outro operador (cadastro do operador): grava pela função do banco. */
  asAdmin?: boolean;
}

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AvatarUpload({ userId, initialUrl, displayName, asAdmin = false }: AvatarUploadProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  // Sem foto informada (cadastro do operador no Admin): busca a atual.
  useEffect(() => {
    if (initialUrl !== undefined) return;
    supabase.from("sellers").select("avatar").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (data?.avatar) setUrl(data.avatar); });
  }, [initialUrl, userId]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "O limite é 5 MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      if (asAdmin) {
        const { error } = await supabase.rpc("admin_set_user_avatar", { _user_id: userId, _url: publicUrl });
        if (error) throw error;
      } else {
        // Salva no perfil e espelha no vendedor
        const [{ error: pErr }, { error: sErr }] = await Promise.all([
          supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", userId),
          supabase.from("sellers").update({ avatar: publicUrl }).eq("user_id", userId),
        ]);
        if (pErr) throw pErr;
        if (sErr) console.warn("Não foi possível espelhar avatar no vendedor:", sErr.message);
      }

      setUrl(publicUrl);
      toast({ title: "Foto atualizada", description: asAdmin ? "A foto do operador foi salva e aparece no ranking." : "Sua foto de perfil foi salva." });
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast({ title: "Erro ao enviar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-400 text-lg font-bold text-primary-foreground shadow-sm">
          {url ? (
            <img src={url} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <span>{initials(displayName)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-border shadow-sm hover:bg-muted disabled:opacity-60"
          title="Alterar foto"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3 text-foreground" />}
        </button>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Foto de perfil</p>
        <p className="text-xs text-muted-foreground">PNG ou JPG, até 5 MB.</p>
        <Button variant="outline" size="sm" className="mt-2 h-8" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
          {url ? "Trocar foto" : "Adicionar foto"}
        </Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
