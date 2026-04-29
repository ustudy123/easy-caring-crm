UPDATE public.profiles 
SET store_id = 'b7369414-9afe-4870-974e-45aa58173b8c' 
WHERE display_name = 'Lucas' AND store_id IS NULL;

-- Also update user_roles just in case
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'vendedor'::app_role 
FROM public.profiles 
WHERE display_name = 'Lucas'
ON CONFLICT DO NOTHING;
