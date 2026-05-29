DELETE FROM whatsapp_messages WHERE phone='5521988887777' OR message_id='test-webhook-verify-001';
DELETE FROM leads WHERE client_phone='5521988887777';
DELETE FROM redirection_history WHERE client_id IN (SELECT id FROM clients WHERE phone='5521988887777');
DELETE FROM clients WHERE phone='5521988887777';