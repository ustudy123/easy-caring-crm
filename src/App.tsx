import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CrmProvider } from "@/contexts/CrmContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><CrmProvider><Dashboard /></CrmProvider></ProtectedRoute>} />
            <Route path="/kanban" element={<ProtectedRoute><CrmProvider><Kanban /></CrmProvider></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><CrmProvider><Clientes /></CrmProvider></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><CrmProvider><Agenda /></CrmProvider></ProtectedRoute>} />
            <Route path="/campanhas" element={<ProtectedRoute><CrmProvider><Campanhas /></CrmProvider></ProtectedRoute>} />
            <Route path="/conversas" element={<ProtectedRoute><CrmProvider><Conversas /></CrmProvider></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><CrmProvider><Configuracoes /></CrmProvider></ProtectedRoute>} />
            <Route path="/suporte-orcamento" element={<ProtectedRoute><CrmProvider><SuporteOrcamento /></CrmProvider></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
