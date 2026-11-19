import { useState, useEffect } from "react";
import { LayoutDashboard, Sparkles, Paintbrush, MessageSquareText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/AppLayout";
import { useUnreadFeedbacks } from "@/pages/Feedback";
import { HubModuleCard, type HubTheme } from "@/components/HubModuleCard";

interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const iconMap: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard: LayoutDashboard,
  Sparkles: Sparkles,
};

const moduleTheme: Record<string, HubTheme> = {
  crm: "crm",
  quiz: "quiz",
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
        className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl"
      >
        {loading ? (
          <>
            <Skeleton className="h-[220px] w-full rounded-3xl" />
            <Skeleton className="h-[220px] w-full rounded-3xl" />
            <Skeleton className="h-[220px] w-full rounded-3xl" />
          </>
        ) : (
          modules.map((mod) => {
            const Icon = iconMap[mod.icon] || LayoutDashboard;
            const theme = moduleTheme[mod.id] ?? "crm";

            return (
              <HubModuleCard
                key={mod.id}
                title={mod.name}
                description={mod.description}
                icon={Icon}
                theme={theme}
                onClick={() => handleModuleClick(mod.id)}
              />
            );
          })
        )}
        {!loading && showFeedback && (
          <HubModuleCard
            title="Feedback"
            description={
              sellerId
                ? "Leia o feedback do semestre e envie sua resposta por texto ou áudio."
                : "Envie o feedback do semestre aos operadores e veja as respostas."
            }
            icon={MessageSquareText}
            theme="feedback"
            actionLabel="Acessar"
            badge={pendingFeedbacks > 0 ? `${pendingFeedbacks} aguardando sua resposta` : undefined}
            onClick={() => navigate("/feedback")}
          />
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
