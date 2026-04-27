import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CrmProvider } from "@/contexts/CrmContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminPanel from "./pages/AdminPanel";
import Dashboard from "./pages/Dashboard";
import Kanban from "./pages/Kanban";
import Clientes from "./pages/Clientes";
import Agenda from "./pages/Agenda";
import Campanhas from "./pages/Campanhas";
import Configuracoes from "./pages/Configuracoes";
import Conversas from "./pages/Conversas";
import SuporteOrcamento from "./pages/SuporteOrcamento";
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
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/kanban" element={<Kanban />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/agenda" element={<Agenda />} />
                      <Route path="/campanhas" element={<Campanhas />} />
                      <Route path="/conversas" element={<Conversas />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route path="/suporte-orcamento" element={<SuporteOrcamento />} />
                      <Route path="/admin" element={<AdminPanel />} />
                      <Route path="*" element={<NotFound />} />
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
