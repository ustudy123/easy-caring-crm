
-- Seed the initial admin role for the existing user
INSERT INTO public.user_roles (user_id, role)
SELECT '75e6e49d-0212-418a-a3e6-a09afa88be5f', 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '75e6e49d-0212-418a-a3e6-a09afa88be5f' AND role = 'admin'
);
