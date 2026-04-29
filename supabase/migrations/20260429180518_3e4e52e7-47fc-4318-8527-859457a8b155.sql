DELETE FROM public.leads
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY client_phone ORDER BY created_at DESC) as row_num
        FROM public.leads
        WHERE client_phone IS NOT NULL
    ) t
    WHERE t.row_num > 1
);
