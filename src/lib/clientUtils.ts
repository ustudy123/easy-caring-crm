 import { Client } from "@/types/crm";
 
 /**
  * Checks if a name is a generic placeholder like "Cliente 5511999990005"
  */
 export function isGenericName(name: string): boolean {
   const nameLower = name.toLowerCase();
   // Matches "Cliente" followed by digits
   if (nameLower.startsWith("cliente") && /\d+/.test(nameLower)) return true;
   // Matches just phone numbers or mostly digits
   if (/^[\d\s\+\-\(\)]+$/.test(name)) return true;
   return false;
 }
 
 /**
  * Returns a more descriptive display name for a client when the name is generic
  */
 export function getDisplayClientName(client: Client | { name: string; phone: string; source?: string; notes?: string }): string {
   if (!isGenericName(client.name)) return client.name;
 
   // Try to extract context from source or notes
   if ('source' in client && client.source && client.source !== 'unknown') {
     return `Interesse via ${client.source} (${client.phone.slice(-4)})`;
   }
 
   if ('notes' in client && client.notes) {
     // Try to get first few words of notes if short, or specific patterns
     const firstLine = client.notes.split('\n')[0].trim();
     if (firstLine && firstLine.length < 30 && !isGenericName(firstLine)) {
       return `${firstLine} (${client.phone.slice(-4)})`;
     }
   }
 
   // Fallback to stylized phone
   return `Cliente ${client.phone}`;
 }