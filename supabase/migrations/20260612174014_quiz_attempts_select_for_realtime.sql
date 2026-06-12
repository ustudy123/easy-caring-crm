-- Para o ranking atualizar em tempo real PARA TODOS, cada cliente precisa
-- receber os eventos de realtime de tentativas de outros usuários — e o
-- realtime do Supabase respeita a RLS. A policy existente (FOR ALL com
-- auth.uid() = user_id) só entrega as próprias linhas. Esta policy adicional
-- libera apenas o SELECT para autenticados (leitura de pontuações não é
-- sensível); INSERT/UPDATE/DELETE continuam restritos ao dono pela policy
-- existente. Como políticas do mesmo comando são combinadas com OR, o SELECT
-- passa a valer para todos os autenticados.

DROP POLICY IF EXISTS "Authenticated can read all attempts for ranking" ON public.quiz_attempts;
CREATE POLICY "Authenticated can read all attempts for ranking"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (true);
