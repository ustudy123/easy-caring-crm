CREATE OR REPLACE FUNCTION public.get_user_seller_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT store_id FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$function$;