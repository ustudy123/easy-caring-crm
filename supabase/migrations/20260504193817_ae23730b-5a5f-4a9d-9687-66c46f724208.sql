CREATE OR REPLACE FUNCTION public.get_user_seller_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT s.id FROM public.sellers s WHERE s.user_id = _user_id LIMIT 1),
    (SELECT p.id FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1)
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT s.store_id FROM public.sellers s WHERE s.user_id = _user_id LIMIT 1),
    (SELECT p.store_id FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1)
  )
$function$;