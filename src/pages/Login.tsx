import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, AtSign, Lock, User as UserIcon, ArrowLeft } from "lucide-react";
import { apelidoToEmail, apelidoToSlug, resolveLoginEmail } from "@/lib/auth";
import taecoLogo from "@/assets/taeco-logo.png";

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [apelido, setApelido] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isForgot) {
      // Redefinição por e-mail só funciona para contas com e-mail real.
      // Quem usa apelido (e-mail interno) deve pedir ao administrador.
      if (!apelido.includes("@")) {
        setLoading(false);
        toast.info("Para redefinir a senha, peça ao administrador. O login por apelido não usa e-mail.");
        return;
      }
      const { error } = await resetPassword(apelido.trim());
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
        setIsForgot(false);
      }
      return;
    }

    if (isSignUp) {
      if (!apelidoToSlug(apelido)) {
        setLoading(false);
        toast.error("Escolha um apelido válido (letras ou números).");
        return;
      }
      const email = apelidoToEmail(apelido);
      const { error } = await signUp(email, password, apelido.trim(), fullName.trim());
      setLoading(false);
      if (error) {
        const msg = /already registered|already been registered|exists/i.test(error.message || "")
          ? "Esse apelido já está em uso. Escolha outro."
          : error.message;
        toast.error(msg);
      } else {
        toast.success("Conta criada! Aguarde a aprovação do administrador para acessar.");
        navigate("/");
      }
    } else {
      const email = resolveLoginEmail(apelido);
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        toast.error("Apelido ou senha inválidos.");
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} />
      <div className="w-full max-w-md animate-fade-up relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <img src={taecoLogo} alt="MyTaeco" className="h-24 w-auto mb-3 select-none" draggable={false} />
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground uppercase">
            Show das <span className="text-brand-500">Tintas</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Plataforma Integrada Taeco</p>
        </div>

        <Card className="shadow-2xl border-border/40 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
              {isForgot ? "Recuperar senha" : isSignUp ? "Criar conta" : "Bem-vindo de volta"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isForgot
                ? "Se você usa e-mail, enviaremos um link. Login por apelido: peça ao administrador."
                : isSignUp
                ? "Preencha os dados para começar"
                : "Entre com seu apelido e senha para continuar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-label={isForgot ? "Formulário de recuperação de senha" : isSignUp ? "Formulário de cadastro" : "Formulário de login"}>
              {isSignUp && !isForgot && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold">Nome completo</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <Input
                      id="fullName"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      className="pl-9 h-10 transition-shadow focus-visible:shadow-sm"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="apelido" className="text-xs font-semibold">
                  {isSignUp ? "Como quer ser chamado (apelido)" : isForgot ? "Apelido ou e-mail" : "Apelido"}
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <Input
                    id="apelido"
                    type="text"
                    placeholder={isSignUp ? "Ex.: Dedé" : "Seu apelido"}
                    value={apelido}
                    onChange={(e) => setApelido(e.target.value)}
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    className="pl-9 h-10 transition-shadow focus-visible:shadow-sm"
                  />
                </div>
                {isSignUp && (
                  <p className="text-[11px] text-muted-foreground mt-1">É assim que você vai entrar e aparecer no sistema.</p>
                )}
              </div>
              {!isForgot && (
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      aria-describedby={isSignUp ? "password-hint" : undefined}
                      className="pl-9 pr-10 h-10 transition-shadow focus-visible:shadow-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {isSignUp && (
                    <p id="password-hint" className="text-[11px] text-muted-foreground mt-1">Mínimo de 6 caracteres</p>
                  )}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-10 font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 border-0"
                disabled={loading}
                aria-busy={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
                {isForgot ? "Enviar link de recuperação" : isSignUp ? "Criar conta" : "Entrar"}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-border/40 space-y-2.5 text-center text-sm">
              {!isForgot && !isSignUp && (
                <button
                  type="button"
                  onClick={() => setIsForgot(true)}
                  className="text-primary font-medium hover:underline focus-visible:outline-none focus-visible:underline rounded-sm"
                >
                  Esqueci minha senha
                </button>
              )}
              <div>
                {!isForgot && (
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setIsForgot(false); }}
                    className="text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm focus-visible:outline-none focus-visible:underline rounded-sm"
                  >
                    {isSignUp ? "Já tem conta? " : "Não tem conta? "}
                    <span className="text-primary font-semibold">{isSignUp ? "Entrar" : "Criar conta"}</span>
                  </button>
                )}
                {isForgot && (
                  <button
                    type="button"
                    onClick={() => setIsForgot(false)}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm focus-visible:outline-none focus-visible:underline rounded-sm"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Voltar ao login
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
