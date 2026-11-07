import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlertTriangle, Timer } from "lucide-react";
import { DashboardPanels, type DashboardPanel } from "./DashboardPanels";

afterEach(cleanup);

const idleReport = vi.fn(() => <div>Lista de clientes sem atendimento</div>);
const responseReport = vi.fn(() => <div>Tabela de atraso por vendedor</div>);

const panels: DashboardPanel[] = [
  {
    key: "sem-atendimento", title: "Clientes sem atendimento", description: "Quem está esperando.",
    icon: AlertTriangle, alert: true, summary: <span>3 graves</span>, content: idleReport,
  },
  { key: "atraso-resposta", title: "Atraso de resposta por vendedor", description: "Tempo de resposta.", icon: Timer, content: responseReport },
];

function Location() {
  return <span data-testid="search">{useLocation().search}</span>;
}

const renderAt = (url = "/crm-dashboard") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <DashboardPanels panels={panels} />
      <Location />
    </MemoryRouter>,
  );

describe("DashboardPanels", () => {
  it("shows the cards with their summary without loading any report", () => {
    idleReport.mockClear(); responseReport.mockClear();
    renderAt();
    expect(screen.getByRole("button", { name: /Clientes sem atendimento/ })).toHaveTextContent("3 graves");
    expect(screen.getByRole("button", { name: /Atraso de resposta/ })).toBeInTheDocument();
    expect(idleReport).not.toHaveBeenCalled();
    expect(responseReport).not.toHaveBeenCalled();
  });

  it("opens the full report in a popup and records it in the URL", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /Atraso de resposta/ }));
    expect(screen.getByRole("dialog", { name: "Atraso de resposta por vendedor" })).toHaveTextContent("Tabela de atraso por vendedor");
    expect(screen.getByTestId("search")).toHaveTextContent("?painel=atraso-resposta");
  });

  it("opens directly from a link and closes back to the dashboard", () => {
    renderAt("/crm-dashboard?painel=sem-atendimento");
    expect(screen.getByRole("dialog")).toHaveTextContent("Lista de clientes sem atendimento");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("search")).toBeEmptyDOMElement();
  });

  it("ignores an unknown panel in the URL", () => {
    renderAt("/crm-dashboard?painel=nao-existe");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
