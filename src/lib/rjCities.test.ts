import { describe, expect, it } from "vitest";
import { RJ_CITIES, searchRjCities } from "./rjCities";

describe("RJ cities", () => {
  it("has the 92 municipalities, sorted and without duplicates", () => {
    expect(RJ_CITIES).toHaveLength(92);
    expect(new Set(RJ_CITIES).size).toBe(92);
    expect([...RJ_CITIES]).toEqual([...RJ_CITIES].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("finds cities by part of the name, ignoring accents and case", () => {
    expect(searchRjCities("niter")).toEqual(["Niterói"]);
    expect(searchRjCities("MACAE")).toEqual(["Macaé"]);
    expect(searchRjCities("sao g")).toEqual(["São Gonçalo"]);
    expect(searchRjCities("rio d")).toEqual(["Rio das Flores", "Rio das Ostras", "Rio de Janeiro"]);
    expect(searchRjCities("")).toHaveLength(92);
  });
});
