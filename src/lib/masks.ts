/**
 * Aplica máscara de telefone brasileiro: (11) 99999-9999 ou (11) 9999-9999
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Remove máscara, retornando apenas dígitos */
export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida telefone brasileiro (10 ou 11 dígitos) */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

/** Valida e-mail básico */
export function isValidEmail(value: string): boolean {
  if (!value) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
