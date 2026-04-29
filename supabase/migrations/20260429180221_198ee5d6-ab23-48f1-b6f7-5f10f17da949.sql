-- 1. Remove duplicate clients, keeping only the most recently created one
DELETE FROM public.clients
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at DESC) as row_num
        FROM public.clients
        WHERE phone IS NOT NULL AND phone != ''
    ) t
    WHERE t.row_num > 1
);

-- 2. Add unique constraint to phone column
ALTER TABLE public.clients ADD CONSTRAINT clients_phone_key UNIQUE (phone);
