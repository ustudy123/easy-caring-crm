import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Bloqueia o sistema quando o admin redefiniu a senha do usuário: ele precisa
 * escolher uma senha própria antes de continuar. A senha definida pelo admin é
 * temporária, só para o primeiro acesso.
 */
export function ForcePasswordChange({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mustChange, setMustChange] = useState<boolean | null>(null); // null = verificando
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) { setMustChange(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) setMustChange(!!(data as any)?.must_change_password);
    };
    check();
    return () => { active = false; };
  }, [user]);

  const submit = async () => {
    if (pw.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres."); return; }
    if (pw !== pw2) { toast.error("As senhas não conferem."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      // Só limpa a exigência depois que a senha foi de fato trocada.
      await supabase.from("profiles")
        .update({ must_change_password: false } as any)
        .eq("user_id", user!.id);
      toast.success("Senha atualizada! Bem-vindo.");
      setMustChange(false);
    } catch (e: any) {
      toast.error("Não foi possível alterar a senha: " + (e?.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  // Enquanto verifica, deixa o app seguir (evita piscar tela de bloqueio).
  if (mustChange !== true) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" /> Defina sua senha
          </CardTitle>
          <CardDescription>
            Sua senha foi redefinida por um administrador. Para continuar, escolha uma
            senha só sua.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="Mínimo de 6 caracteres" autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label>Repita a nova senha</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
          <Button onClick={submit} disabled={saving || pw.length < 6 || pw !== pw2} className="w-full gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar e entrar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
