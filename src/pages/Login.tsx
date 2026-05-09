import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, Lock, User as UserIcon, ArrowLeft } from "lucide-react";

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isForgot) {
      const { error } = await resetPassword(email);
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
      const { error } = await signUp(email, password, displayName);
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        toast.error("E-mail ou senha inválidos.");
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-8 sm:py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} />
      <div className="w-full max-w-md animate-fade-up relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 mb-3 ring-1 ring-primary/20">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="2" y="2" width="11" height="11" rx="2" fill="white" fillOpacity="0.95" />
              <rect x="15" y="2" width="11" height="11" rx="2" fill="white" fillOpacity="0.5" />
              <rect x="2" y="15" width="11" height="11" rx="2" fill="white" fillOpacity="0.5" />
              <rect x="15" y="15" width="11" height="11" rx="2" fill="white" fillOpacity="0.8" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">CRM Taeco</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Gestão Comercial Inteligente</p>
        </div>

        <Card className="shadow-2xl border-border/40 backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
              {isForgot ? "Recuperar senha" : isSignUp ? "Criar conta" : "Bem-vindo de volta"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isForgot
                ? "Enviaremos um link de recuperação por e-mail"
                : isSignUp
                ? "Preencha os dados para começar"
                : "Entre com suas credenciais para continuar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-label={isForgot ? "Formulário de recuperação de senha" : isSignUp ? "Formulário de cadastro" : "Formulário de login"}>
              {isSignUp && !isForgot && (
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs font-semibold">Nome completo</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <Input
                      id="displayName"
                      placeholder="Seu nome completo"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      autoComplete="name"
                      className="pl-9 h-10 transition-shadow focus-visible:shadow-sm"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                    className="pl-9 h-10 transition-shadow focus-visible:shadow-sm"
                  />
                </div>
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
