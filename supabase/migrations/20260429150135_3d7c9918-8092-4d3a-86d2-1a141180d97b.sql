-- Remove a função de vendedor duplicada do usuário admin
DELETE FROM public.user_roles 
WHERE user_id = '75e6e49d-0212-418a-a3e6-a09afa88be5f' 
AND role = 'vendedor';

-- Atualiza o perfil do admin para mostrar a role correta
UPDATE public.profiles 
SET role = 'admin' 
WHERE user_id = '75e6e49d-0212-418a-a3e6-a09afa88be5f';

-- Remove o registro de seller associado ao admin para não poluir as listas de vendedores
DELETE FROM public.sellers 
WHERE user_id = '75e6e49d-0212-418a-a3e6-a09afa88be5f';
