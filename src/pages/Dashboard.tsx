import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Sparkles, ChevronRight, Paintbrush } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/AppLayout";

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
  const { isSuporte } = useRole();
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
      // O suporte não tem Kanban: entra direto na página de orçamentos dele.
      navigate(isSuporte ? '/suporte-orcamento' : '/kanban');
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
            Show das <span className="text-brand-500">Tintas</span>
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
              <motion.div key={mod.id} variants={item}>
                <Card 
                  className="group cursor-pointer overflow-hidden border-2 border-black/5 hover:border-brand-500/30 transition-all duration-300 rounded-3xl bg-white shadow-xl hover:shadow-2xl hover:shadow-brand-500/10 active:scale-[0.98]"
                  onClick={() => handleModuleClick(mod.id)}
                >
                  <CardContent className="p-8 relative">
                    {/* Background decorative elements */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-10 transition-colors group-hover:opacity-20 bg-brand-500" />
                    
                    <div className="flex flex-col h-full relative z-10">
                      <div className="p-4 rounded-2xl w-fit mb-6 transition-colors bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white">
                        <Icon className="h-8 w-8" />
                      </div>
                      
                      <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-brand-500 transition-colors">
                        {mod.name}
                      </h2>
                      
                      <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                        {mod.description}
                      </p>
                      
                      <div className="flex items-center text-sm font-bold mt-auto group-hover:gap-2 transition-all">
                        <span>Acessar módulo</span>
                        <ChevronRight className="h-4 w-4 text-brand-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
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
