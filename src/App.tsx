import { UrgencyAlertPopup } from "@/components/UrgencyAlertPopup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CrmProvider } from "@/contexts/CrmContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import AdminPanel from "./pages/AdminPanel";
import Dashboard from "./pages/Dashboard";
import CrmDashboard from "./pages/CrmDashboard";
import Quiz from "./pages/Quiz";
import Kanban from "./pages/Kanban";
import Clientes from "./pages/Clientes";
import Agenda from "./pages/Agenda";
import Configuracoes from "./pages/Configuracoes";
import Conversas from "./pages/Conversas";
import SuporteOrcamento from "./pages/SuporteOrcamento";
import RelatorioVendasCRM from "./pages/RelatorioVendasCRM";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
         <RoleProvider>
           <Toaster />
           <Sonner />
           <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={
                <ProtectedRoute>
                  <CrmProvider>
                    <UrgencyAlertPopup />
                    <Routes>
                      <Route element={<AppShell />}>
                        <Route path="/" element={<Dashboard />} />
                        {/* Redirecionamentos defensivos: rotas legadas/erradas que apontam
                            para um dashboard inexistente não devem cair em 404. */}
                        <Route path="/dashboard" element={<Navigate to="/" replace />} />
                        <Route path="/vendedor" element={<Navigate to="/" replace />} />
                        <Route path="/seller" element={<Navigate to="/" replace />} />
                        <Route path="/home" element={<Navigate to="/" replace />} />
                        <Route path="/crm-dashboard" element={<CrmDashboard />} />
                        <Route path="/quiz" element={<Quiz />} />
                        <Route path="/kanban" element={<Kanban />} />
                        <Route path="/clientes" element={<Clientes />} />
                        <Route path="/agenda" element={<Agenda />} />
                        <Route path="/conversas" element={<Conversas />} />
                        <Route path="/configuracoes" element={<Configuracoes />} />
                        <Route path="/suporte-orcamento" element={<SuporteOrcamento />} />
                        <Route path="/admin" element={<AdminPanel />} />
                        <Route path="/relatorio-vendas" element={<RelatorioVendasCRM />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  </CrmProvider>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
