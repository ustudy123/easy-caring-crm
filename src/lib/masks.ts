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

/** DDDs brasileiros existentes (Anatel). */
const BR_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Valida telefone brasileiro: local (10/11 dígitos) ou com DDI 55 (12/13 dígitos).
 * O DDD precisa existir; com 11 dígitos o número é celular e começa com 9 após o
 * DDD; com 10 dígitos começa com 2–9 (fixo, ou celular sem o 9 — formato que o
 * WhatsApp ainda usa em números antigos). Barra ids internos do WhatsApp que
 * têm "cara" de telefone (ex.: 93405308818).
 */
export function isValidPhone(value: string): boolean {
  const digits = (value || "").replace(/\D/g, "");
  const local = (digits.length === 12 || digits.length === 13) && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
  if (!BR_DDDS.has(Number(local.slice(0, 2)))) return false;
  if (local.length === 11) return local[2] === "9";
  if (local.length === 10) return /[2-9]/.test(local[2]);
  return false;
}

/** Valida e-mail básico */
export function isValidEmail(value: string): boolean {
  if (!value) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
