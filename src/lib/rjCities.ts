// Municípios do Estado do Rio de Janeiro (92), para o campo "Cidade" do card do
// cliente da equipe externa. Lista fixa: muda só com criação/desmembramento de
// município.
export const RJ_CITIES = [
  "Angra dos Reis", "Aperibé", "Araruama", "Areal", "Armação dos Búzios", "Arraial do Cabo",
  "Barra do Piraí", "Barra Mansa", "Belford Roxo", "Bom Jardim", "Bom Jesus do Itabapoana",
  "Cabo Frio", "Cachoeiras de Macacu", "Cambuci", "Campos dos Goytacazes", "Cantagalo",
  "Carapebus", "Cardoso Moreira", "Carmo", "Casimiro de Abreu", "Comendador Levy Gasparian",
  "Conceição de Macabu", "Cordeiro", "Duas Barras", "Duque de Caxias",
  "Engenheiro Paulo de Frontin", "Guapimirim", "Iguaba Grande", "Itaboraí", "Itaguaí", "Italva",
  "Itaocara", "Itaperuna", "Itatiaia", "Japeri", "Laje do Muriaé", "Macaé", "Macuco", "Magé",
  "Mangaratiba", "Maricá", "Mendes", "Mesquita", "Miguel Pereira", "Miracema", "Natividade",
  "Nilópolis", "Niterói", "Nova Friburgo", "Nova Iguaçu", "Paracambi", "Paraíba do Sul", "Paraty",
  "Paty do Alferes", "Petrópolis", "Pinheiral", "Piraí", "Porciúncula", "Porto Real", "Quatis",
  "Queimados", "Quissamã", "Resende", "Rio Bonito", "Rio Claro", "Rio das Flores", "Rio das Ostras",
  "Rio de Janeiro", "Santa Maria Madalena", "Santo Antônio de Pádua", "São Fidélis",
  "São Francisco de Itabapoana", "São Gonçalo", "São João da Barra", "São João de Meriti",
  "São José de Ubá", "São José do Vale do Rio Preto", "São Pedro da Aldeia", "São Sebastião do Alto",
  "Sapucaia", "Saquarema", "Seropédica", "Silva Jardim", "Sumidouro", "Tanguá", "Teresópolis",
  "Trajano de Moraes", "Três Rios", "Valença", "Varre-Sai", "Vassouras", "Volta Redonda",
] as const;

/** Sem acentos e em minúsculas ("São Gonçalo" → "sao goncalo"), para buscar como se digita. */
export const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const normalize = stripAccents;

/** Filtra por parte do nome, sem diferenciar acentos/maiúsculas ("sao g" → São Gonçalo). */
export function searchRjCities(query: string): string[] {
  const q = normalize(query.trim());
  if (!q) return [...RJ_CITIES];
  return RJ_CITIES.filter((c) => normalize(c).includes(q));
}
