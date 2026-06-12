// Exportação genérica de dados tabulares para CSV (compatível com Excel pt-BR).

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Normaliza quebras de linha e escapa aspas
  s = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
  // Envolve em aspas se contiver separador, aspas ou ponto-e-vírgula
  if (/[",;]/.test(s)) s = `"${s}"`;
  return s;
}

/**
 * Gera e baixa um CSV a partir de uma lista de objetos.
 * @param rows  lista de registros
 * @param columns  pares [chave, rótulo] definindo as colunas e a ordem
 * @param filename  nome base do arquivo (sem extensão)
 */
export function exportToCsv<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T | string; label: string; format?: (row: T) => unknown }[],
  filename: string,
) {
  const sep = ";"; // ponto-e-vírgula abre direto no Excel em pt-BR
  const header = columns.map((c) => escapeCell(c.label)).join(sep);
  const body = rows
    .map((row) =>
      columns
        .map((c) => escapeCell(c.format ? c.format(row) : row[c.key as string]))
        .join(sep),
    )
    .join("\n");

  // BOM para o Excel reconhecer UTF-8 (acentos)
  const csv = "\uFEFF" + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
