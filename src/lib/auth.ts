// Login por apelido: a autenticação do Supabase é baseada em e-mail, então
// geramos um e-mail "interno" determinístico a partir do apelido. O vendedor
// nunca precisa de e-mail real — usa apelido + senha. Cadastro e login usam
// esta mesma função para que o e-mail gerado seja sempre o mesmo.

export const INTERNAL_EMAIL_DOMAIN = "taeco.interno";

// Normaliza o apelido em um slug estável (sem acento, minúsculo, só alfanumérico).
export function apelidoToSlug(apelido: string): string {
  return apelido
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ""); // mantém apenas letras e números
}

export function apelidoToEmail(apelido: string): string {
  return `${apelidoToSlug(apelido)}@${INTERNAL_EMAIL_DOMAIN}`;
}

// Resolve o identificador digitado no login para um e-mail:
// - se já parece um e-mail (tem "@"), usa como está (compatível com contas antigas/admin);
// - senão, trata como apelido e gera o e-mail interno.
export function resolveLoginEmail(identifier: string): string {
  const value = identifier.trim();
  return value.includes("@") ? value.toLowerCase() : apelidoToEmail(value);
}

export function isInternalEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}
