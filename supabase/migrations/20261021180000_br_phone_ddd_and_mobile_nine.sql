-- Regra de telefone BR ainda mais estrita (mesma de isValidPhone em src/lib/masks.ts
-- e do whatsapp-webhook): DDD precisa existir; com 11 dígitos o número é celular e
-- começa com 9 após o DDD; com 10, começa com 2–9 (fixo ou celular antigo sem o 9,
-- formato que o WhatsApp ainda entrega). Barra ids internos do WhatsApp com "cara"
-- de telefone, como "93405308818", que viravam lead "Cliente 93405308818".
-- Substitui a função usada pelos triggers de leads/clients/whatsapp_messages.
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
  IF left(local_n, 2) NOT IN (
    '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
    '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
    '51','53','54','55','61','62','63','64','65','66','67','68','69',
    '71','73','74','75','77','79','81','82','83','84','85','86','87','88','89',
    '91','92','93','94','95','96','97','98','99'
  ) THEN
    RETURN false;
  END IF;
  RETURN (length(local_n) = 11 AND substr(local_n, 3, 1) = '9')
      OR (length(local_n) = 10 AND substr(local_n, 3, 1) ~ '[2-9]');
END; $$;
