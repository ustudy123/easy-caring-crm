/**
 * Aplica máscara de telefone brasileiro, tratando o DDI 55 quando presente:
 *  - com 55: +55 (11) 99999-9999
 *  - sem 55: (11) 99999-9999 ou (11) 9999-9999
 */
export function maskPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  let ddi = "";
  // Detecta DDI 55 do Brasil (12 ou 13 dígitos começando com 55)
  if (digits.length > 11 && digits.startsWith("55")) {
    ddi = "+55 ";
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length === 0) return ddi.trim();
  if (digits.length <= 2) return `${ddi}(${digits}`;
  if (digits.length <= 6) return `${ddi}(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `${ddi}(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `${ddi}(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Remove máscara, retornando apenas dígitos */
export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normaliza para o padrão canônico do sistema: dígitos com DDI 55 (igual ao WhatsApp).
 * Ex.: "(44) 98842-8198" -> "5544988428198"; "44988428198" -> "5544988428198".
 * Números que já têm 55 são mantidos. Fora do padrão BR, retorna só os dígitos.
 */
export function normalizePhoneBR(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Valida telefone brasileiro: local (10/11 dígitos) ou com DDI 55 (12/13 dígitos) */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return true;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return true;
  return false;
}

/** Valida e-mail básico */
export function isValidEmail(value: string): boolean {
  if (!value) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
