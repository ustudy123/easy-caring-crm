import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CrmProvider } from "@/contexts/CrmContext";
import Dashboard from "./pages/Dashboard";
import Kanban from "./pages/Kanban";
import Clientes from "./pages/Clientes";
import Agenda from "./pages/Agenda";
import Campanhas from "./pages/Campanhas";
import Configuracoes from "./pages/Configuracoes";
import Conversas from "./pages/Conversas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CrmProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/campanhas" element={<Campanhas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CrmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
