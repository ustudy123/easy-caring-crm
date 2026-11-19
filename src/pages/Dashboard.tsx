import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Sparkles, ChevronRight, Paintbrush, MessageSquareText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/AppLayout";
import { useUnreadFeedbacks } from "@/pages/Feedback";

interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const iconMap: Record<string, any> = {
  LayoutDashboard: LayoutDashboard,
  Sparkles: Sparkles,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuporte, isVendedor, isGerente, isAdmin, sellerId } = useRole();
  // Bloco de Feedback: para quem é operador (tem cadastro de vendedor) ou gestor.
  const showFeedback = !!sellerId || isAdmin || isGerente;
  const pendingFeedbacks = useUnreadFeedbacks(sellerId);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("user_modules")
        .select(`
          module_id,
          modules (
            id,
            name,
            description,
            icon
          )
        `)
        .eq("user_id", user.id);

      if (!error && data) {
        const formattedModules = data.map((item: any) => item.modules);
        setModules(formattedModules);
      }
      setLoading(false);
    };

    fetchModules();
  }, [user]);

  const handleModuleClick = (moduleId: string) => {
    if (moduleId === 'crm') {
      // Suporte "puro" entra na página dele; quem também é vendedor/gerente/admin
      // vai para o Kanban normalmente.
      const canSeeKanban = isVendedor || isGerente || isAdmin;
      navigate(isSuporte && !canSeeKanban ? '/suporte-orcamento' : '/kanban');
    } else if (moduleId === 'quiz') {
      navigate('/quiz');
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <AppLayout title="Portal Taeco">
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/20">
            <Paintbrush className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">
            HUB Taeco <span className="text-brand-500">Tintas</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Bem-vindo ao hub da Taeco. Escolha um módulo para começar sua jornada hoje.
        </p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl"
      >
        {loading ? (
          <>
            <Skeleton className="h-[200px] w-full rounded-3xl" />
            <Skeleton className="h-[200px] w-full rounded-3xl" />
          </>
        ) : (
          modules.map((mod) => {
            const Icon = iconMap[mod.icon] || LayoutDashboard;
            
            return (
              <motion.div key={mod.id} variants={item} whileHover={{ y: -8 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <Card
                  className="group cursor-pointer overflow-hidden rounded-3xl border border-black/5 bg-white transition-all duration-300 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_-10px_rgba(15,23,42,0.15)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_28px_56px_-16px_rgba(243,112,33,0.35)] hover:border-brand-500/30 active:scale-[0.98]"
                  onClick={() => handleModuleClick(mod.id)}
                >
                  <CardContent className="p-8 relative">
                    {/* Top highlight for 3D edge */}
                    <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
                    {/* Background decorative elements */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-25 bg-brand-500" />
                    <div className="absolute -left-10 -bottom-10 w-28 h-28 rounded-full blur-3xl opacity-0 transition-opacity group-hover:opacity-15 bg-brand-400" />

                    <div className="flex flex-col h-full relative z-10">
                      <div className="p-4 rounded-2xl w-fit mb-6 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/40 ring-1 ring-inset ring-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                        <Icon className="h-8 w-8 drop-shadow-sm" />
                      </div>

                      <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-brand-500 transition-colors">
                        {mod.name}
                      </h2>

                      <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                        {mod.description}
                      </p>

                      <div className="flex items-center mt-auto">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-600 ring-1 ring-inset ring-brand-500/20 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-brand-500/30">
                          Acessar módulo
                          <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
        {!loading && showFeedback && (
          <motion.div variants={item} whileHover={{ y: -8 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <Card
              className="group cursor-pointer overflow-hidden rounded-3xl border border-black/5 bg-white transition-all duration-300 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_-10px_rgba(15,23,42,0.15)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_28px_56px_-16px_rgba(243,112,33,0.35)] hover:border-brand-500/30 active:scale-[0.98]"
              onClick={() => navigate("/feedback")}
            >
              <CardContent className="p-8 relative">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-25 bg-brand-500" />
                <div className="absolute -left-10 -bottom-10 w-28 h-28 rounded-full blur-3xl opacity-0 transition-opacity group-hover:opacity-15 bg-brand-400" />
                <div className="flex flex-col h-full relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl w-fit mb-6 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/40 ring-1 ring-inset ring-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                      <MessageSquareText className="h-8 w-8 drop-shadow-sm" />
                    </div>
                    {pendingFeedbacks > 0 && (
                      <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-bold text-white shadow-md shadow-brand-500/30">
                        {pendingFeedbacks} aguardando sua resposta
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-brand-500 transition-colors">Feedback</h2>
                  <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                    {sellerId ? "Leia o feedback do semestre e envie sua resposta por texto ou áudio." : "Envie o feedback do semestre aos operadores e veja as respostas."}
                  </p>
                  <div className="flex items-center mt-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-600 ring-1 ring-inset ring-brand-500/20 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-brand-500/30">
                      Acessar
                      <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Footer / Decorative splashes */}
      <div className="fixed bottom-0 left-0 -z-10 opacity-10 pointer-events-none">
        <svg width="300" height="300" viewBox="0 0 200 200">
          <path fill="#F37021" d="M44.7,-76.4C58.1,-69.2,69.2,-58.1,76.4,-44.7C83.7,-31.3,87.1,-15.7,85.6,-0.9C84,14,77.5,27.9,69,40.1C60.5,52.3,50,62.8,37.8,70.5C25.6,78.2,12.8,83.1,-0.5,83.9C-13.7,84.7,-27.5,81.4,-40,74.1C-52.6,66.8,-64,55.5,-72.1,42.4C-80.2,29.3,-85,14.7,-84.3,0.4C-83.6,-13.9,-77.4,-27.7,-68.4,-39.4C-59.4,-51.1,-47.6,-60.7,-34.7,-68.3C-21.8,-75.9,-7.9,-81.4,7.4,-82.7C22.7,-83.9,31.3,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
        </svg>
      </div>
    </div>
    </AppLayout>
  );
}
