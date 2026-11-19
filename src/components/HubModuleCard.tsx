import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type HubTheme = "crm" | "quiz" | "feedback";

export const HUB_CARD_ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface HubModuleCardProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  theme: HubTheme;
  actionLabel?: string;
  badge?: string;
  onClick: () => void;
}

const THEME_STYLES: Record<
  HubTheme,
  {
    card: string;
    topLine: string;
    glowA: string;
    glowB: string;
    iconWrap: string;
    title: string;
    pill: string;
    badge: string;
  }
> = {
  crm: {
    card: "hover:border-brand-500/30 hover:shadow-module-crm",
    topLine: "via-brand-500/50",
    glowA: "bg-brand-500",
    glowB: "bg-brand-400",
    iconWrap: "from-brand-400 to-brand-600 shadow-brand-500/40",
    title: "group-hover:text-brand-500",
    pill: "bg-brand-50 text-brand-600 ring-brand-500/20 group-hover:bg-brand-500 group-hover:shadow-brand-500/30",
    badge: "bg-brand-500 shadow-brand-500/30",
  },
  quiz: {
    card: "hover:border-quiz-500/30 hover:shadow-module-quiz",
    topLine: "via-quiz-500/50",
    glowA: "bg-quiz-500",
    glowB: "bg-quiz-400",
    iconWrap: "from-quiz-400 to-quiz-600 shadow-quiz-500/40",
    title: "group-hover:text-quiz-500",
    pill: "bg-quiz-50 text-quiz-600 ring-quiz-500/20 group-hover:bg-quiz-500 group-hover:shadow-quiz-500/30",
    badge: "bg-quiz-500 shadow-quiz-500/30",
  },
  feedback: {
    card: "hover:border-feedback-500/30 hover:shadow-module-feedback",
    topLine: "via-feedback-500/50",
    glowA: "bg-feedback-500",
    glowB: "bg-feedback-400",
    iconWrap: "from-feedback-400 to-feedback-600 shadow-feedback-500/40",
    title: "group-hover:text-feedback-500",
    pill: "bg-feedback-50 text-feedback-600 ring-feedback-500/20 group-hover:bg-feedback-500 group-hover:shadow-feedback-500/30",
    badge: "bg-feedback-500 shadow-feedback-500/30",
  },
};

export function HubModuleCard({
  title,
  description,
  icon: Icon,
  theme,
  actionLabel = "Acessar módulo",
  badge,
  onClick,
}: HubModuleCardProps) {
  const t = THEME_STYLES[theme];
  return (
    <motion.div
      variants={HUB_CARD_ITEM}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card
        className={cn(
          "group h-full cursor-pointer overflow-hidden rounded-3xl border border-black/5 bg-white transition-all duration-300 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_-10px_rgba(15,23,42,0.15)] active:scale-[0.98]",
          t.card
        )}
        onClick={onClick}
      >
        <CardContent className="relative h-full p-8">
          {/* Top highlight for 3D edge */}
          <div
            className={cn(
              "absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
              t.topLine
            )}
          />
          {/* Background decorative elements */}
          <div
            className={cn(
              "absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-25",
              t.glowA
            )}
          />
          <div
            className={cn(
              "absolute -bottom-10 -left-10 h-28 w-28 rounded-full blur-3xl opacity-0 transition-opacity group-hover:opacity-15",
              t.glowB
            )}
          />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "mb-6 w-fit rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg ring-1 ring-inset ring-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
                  t.iconWrap
                )}
              >
                <Icon className="h-8 w-8 drop-shadow-sm" />
              </div>
              {badge && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-md",
                    t.badge
                  )}
                >
                  {badge}
                </span>
              )}
            </div>

            <h2
              className={cn(
                "mb-3 text-2xl font-bold text-foreground transition-colors",
                t.title
              )}
            >
              {title}
            </h2>

            <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>

            <div className="mt-auto flex items-center">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-inset transition-all duration-300 group-hover:text-white group-hover:shadow-md",
                  t.pill
                )}
              >
                {actionLabel}
                <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
