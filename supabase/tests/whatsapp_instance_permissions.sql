-- Regression: warning settings are readable while provider credentials remain private.
SELECT 1 / CASE WHEN
  has_column_privilege('authenticated', 'public.whatsapp_instances', 'silence_alert_hours', 'SELECT')
  AND has_column_privilege('authenticated', 'public.whatsapp_instances', 'silence_alerted_at', 'SELECT')
  THEN 1 ELSE 0 END AS warning_settings_readable;

SELECT 1 / CASE WHEN
  NOT has_column_privilege('authenticated', 'public.whatsapp_instances', 'api_token', 'SELECT')
  AND NOT has_column_privilege('authenticated', 'public.whatsapp_instances', 'api_url', 'SELECT')
  THEN 1 ELSE 0 END AS provider_credentials_private;