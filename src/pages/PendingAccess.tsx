import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut, User as UserIcon } from "lucide-react";

export default function PendingAccess() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-xl border-border/40">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Acesso Pendente</CardTitle>
          <CardDescription>
            Sua conta foi criada com sucesso, mas ainda não possui uma função atribuída.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Próximos passos:</p>
            <p className="text-muted-foreground">
              Entre em contato com o gestor da sua loja ou com o administrador do sistema
              para que ele atribua sua função (vendedor, gerente ou suporte) e libere seu acesso.
            </p>
          </div>

          {(() => {
            const apelido =
              (user?.user_metadata?.display_name as string | undefined) ||
              user?.email?.split("@")[0] ||
              "";
            return apelido ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border/40 rounded-md px-3 py-2">
                <UserIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{apelido}</span>
              </div>
            ) : null;
          })()}

          <Button onClick={signOut} variant="outline" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
