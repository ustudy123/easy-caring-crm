-- Primeiro, verificamos se o Lucas já existe na tabela de sellers pelo nome ou user_id
-- Se não existir, inserimos o registro necessário
INSERT INTO public.sellers (name, role, store_id, user_id)
SELECT 'Lucas', 'vendedor', 'b7369414-9afe-4870-974e-45aa58173b8c', '75e6e49d-0212-418a-a3e6-a09afa88be5f'
WHERE NOT EXISTS (
    SELECT 1 FROM public.sellers WHERE user_id = '75e6e49d-0212-418a-a3e6-a09afa88be5f'
);

-- Garantir que o perfil também esteja com o store_id correto (embora já pareça estar)
UPDATE public.profiles 
SET store_id = 'b7369414-9afe-4870-974e-45aa58173b8c'
WHERE user_id = '75e6e49d-0212-418a-a3e6-a09afa88be5f';
