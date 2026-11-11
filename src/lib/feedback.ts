import type { Tables } from "@/integrations/supabase/types";

/** Feedback do semestre de um operador (Fase 9). */
export interface SellerFeedback {
  id: string;
  sellerId: string;
  periodLabel: string;
  storagePath: string;
  fileName: string | null;
  createdAt: string;
  viewedAt: string | null;
  responseText: string | null;
  responseAudioPath: string | null;
  respondedAt: string | null;
}

export function mapFeedback(row: Tables<"seller_feedbacks">): SellerFeedback {
  return {
    id: row.id,
    sellerId: row.seller_id,
    periodLabel: row.period_label,
    storagePath: row.storage_path,
    fileName: row.file_name,
    createdAt: row.created_at,
    viewedAt: row.viewed_at,
    responseText: row.response_text,
    responseAudioPath: row.response_audio_path,
    respondedAt: row.responded_at,
  };
}

export type FeedbackStatus = "novo" | "lido" | "respondido";

export const feedbackStatus = (f: Pick<SellerFeedback, "viewedAt" | "respondedAt">): FeedbackStatus =>
  f.respondedAt ? "respondido" : f.viewedAt ? "lido" : "novo";

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  novo: "Novo, ainda não lido",
  lido: "Lido, aguardando resposta",
  respondido: "Respondido",
};

/** Sugestão de período: o semestre que acabou de fechar ("2º semestre de 2026"). */
export function suggestedPeriod(now: Date = new Date()): string {
  const month = now.getMonth();
  if (month <= 1) return `2º semestre de ${now.getFullYear() - 1}`;
  return month <= 6 ? `1º semestre de ${now.getFullYear()}` : `2º semestre de ${now.getFullYear()}`;
}

export const feedbackPdfPath = (sellerId: string, id: string) => `${sellerId}/feedback/${id}.pdf`;
export const responseAudioPath = (sellerId: string, id: string, ext: string) => `${sellerId}/respostas/${id}-${Date.now()}.${ext}`;
export const postSaleAudioPath = (sellerId: string, leadId: string, ext: string) => `${sellerId}/posvenda/${leadId}-${Date.now()}.${ext}`;

/** Resposta válida: texto com algo escrito ou um áudio. */
export const canSendResponse = (text: string, audio: Blob | null) => text.trim().length > 0 || !!audio;
