-- Regra de telefone BR mais estrita: além do tamanho (10–11 local / 12–13 com
-- DDI 55), o dígito logo após o DDD deve ser 2–9 — número BR nunca começa com
-- 0 ou 1 após o DDD. Isso barra ids "sintéticos" (ex.: de mensagens de grupo)
-- que por acaso têm 10/11 dígitos, como "2403544184". Substitui a função usada
-- pelos triggers de leads/clients/whatsapp_messages.
CREATE OR REPLACE FUNCTION public.is_valid_br_phone(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text; local_n text;
BEGIN
  d := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  IF (length(d) = 12 OR length(d) = 13) AND left(d, 2) = '55' THEN
    local_n := substr(d, 3);
  ELSE
    local_n := d;
  END IF;
  RETURN (length(local_n) IN (10, 11)) AND substr(local_n, 3, 1) ~ '[2-9]';
END; $$;
