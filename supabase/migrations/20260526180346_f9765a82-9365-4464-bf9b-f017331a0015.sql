CREATE OR REPLACE FUNCTION public.get_random_seller_by_city(_city text)
RETURNS SETOF public.sellers
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.*
  FROM public.sellers s
  JOIN public.stores st ON st.id = s.store_id
  WHERE s.status = 'active'
    AND COALESCE(s.is_active, true) = true
    AND COALESCE(s.is_available, true) = true
    AND st.city IS NOT NULL
    AND LOWER(TRIM(st.city)) = LOWER(TRIM(_city))
  ORDER BY random()
  LIMIT 1;
END;
$function$;