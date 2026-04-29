-- 1. Remove duplicate messages, keeping only one for each message_id
DELETE FROM public.whatsapp_messages
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at DESC) as row_num
        FROM public.whatsapp_messages
        WHERE message_id IS NOT NULL
    ) t
    WHERE t.row_num > 1
);

-- 2. Add unique constraint
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_id_key UNIQUE (message_id);
