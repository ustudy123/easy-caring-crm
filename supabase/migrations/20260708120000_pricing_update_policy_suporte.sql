-- Corrige a RLS de UPDATE de pricing_support_requests.
--
-- Problema: a política ativa (de 20260512163143) só permitia admin/gerente
-- atualizarem. O time de SUPORTE — que é justamente quem processa e responde
-- as solicitações de orçamento (mover coluna + anexar PDF + escrever resposta)
-- — tinha seus UPDATEs bloqueados pela RLS. Como o PostgREST NÃO retorna erro
-- quando um UPDATE afeta 0 linhas por RLS, a UI otimista mostrava "salvo/movido"
-- sem nada ser gravado no banco, e o vendedor via os dados desatualizados.
-- O mesmo buraco quebrava silenciosamente o "Editar solicitação" do vendedor.
--
-- Correção: admin, gerente e suporte podem atualizar qualquer solicitação;
-- o vendedor criador pode atualizar a própria (created_by = auth.uid()).

-- Remove políticas de UPDATE antigas (nome atual + legado)
DROP POLICY IF EXISTS "Managers and admins can update pricing requests" ON public.pricing_support_requests;
DROP POLICY IF EXISTS "Managers/Admins can update pricing requests" ON public.pricing_support_requests;

CREATE POLICY "Support team and owner can update pricing requests"
ON public.pricing_support_requests FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'suporte'::app_role)
  OR created_by = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'suporte'::app_role)
  OR created_by = auth.uid()
);
