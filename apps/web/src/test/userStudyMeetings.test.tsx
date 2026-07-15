import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserMeetingsPanel } from "../components/meetings/UserMeetingsPanel";
import { ServiceRequestError } from "../services/userStudyMeetingsService";
import type { UserStudyMeeting, UserStudyMeetingsResult } from "../types/userStudyMeetings";
import {
  formatUserMeetingStart,
  formatUserMeetingTimeRange,
  getUserMeetingDurationMinutes,
} from "../utils/userStudyMeetings";

const createMeeting = (overrides: Partial<UserStudyMeeting> = {}): UserStudyMeeting => ({
  id: "meeting-001",
  title: "Encontro autenticado",
  description: "Agenda real do grupo autenticado.",
  startsAt: "2026-07-15T23:00:00.000Z",
  endsAt: "2026-07-16T00:00:00.000Z",
  status: "scheduled",
  meetUrl: "https://meet.google.com/abc-defg-hij",
  ...overrides,
});

const createResult = (
  overrides: Partial<UserStudyMeetingsResult> = {},
): UserStudyMeetingsResult => ({
  group: { id: "group-001", name: "Grupo autenticado", status: "active" },
  items: [createMeeting()],
  limit: 3,
  source: "api",
  notice: null,
  ...overrides,
});

describe("userStudyMeetings formatters", () => {
  it("formata data e horários no timezone America/Sao_Paulo", () => {
    expect(formatUserMeetingStart("2026-07-15T23:00:00.000Z")).toBe(
      "Quarta-feira 15 de julho às 20:00",
    );
    expect(
      formatUserMeetingTimeRange({
        startsAt: "2026-07-15T23:00:00.000Z",
        endsAt: "2026-07-16T00:00:00.000Z",
      }),
    ).toBe("20:00 - 21:00");
    expect(
      getUserMeetingDurationMinutes({
        startsAt: "2026-07-15T23:00:00.000Z",
        endsAt: "2026-07-16T00:00:00.000Z",
      }),
    ).toBe(60);
  });

  it("formata encontro atravessando meia-noite sem recalcular status", () => {
    expect(
      formatUserMeetingTimeRange({
        startsAt: "2026-07-16T02:30:00.000Z",
        endsAt: "2026-07-16T04:15:00.000Z",
      }),
    ).toBe("23:30 - 01:15");
    expect(
      getUserMeetingDurationMinutes({
        startsAt: "2026-07-16T02:30:00.000Z",
        endsAt: "2026-07-16T04:15:00.000Z",
      }),
    ).toBe(105);
  });

  it("usa fallback seguro para timestamps inválidos", () => {
    expect(() => formatUserMeetingStart("data-invalida")).not.toThrow();
    expect(formatUserMeetingStart("data-invalida")).toBe("Data indisponível");
    expect(
      formatUserMeetingTimeRange({
        startsAt: "data-invalida",
        endsAt: "2026-07-16T00:00:00.000Z",
      }),
    ).toBe("Data indisponível");
    expect(
      getUserMeetingDurationMinutes({
        startsAt: "data-invalida",
        endsAt: "2026-07-16T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      getUserMeetingDurationMinutes({
        startsAt: "2026-07-16T00:00:00.000Z",
        endsAt: "2026-07-16T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      getUserMeetingDurationMinutes({
        startsAt: "2026-07-16T01:00:00.000Z",
        endsAt: "2026-07-16T00:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("UserMeetingsPanel", () => {
  it("destaca o primeiro encontro e preserva a ordem dos demais", () => {
    render(
      <UserMeetingsPanel
        audience="student"
        data={createResult({
          items: [
            createMeeting({ id: "meeting-001", title: "Primeiro encontro", status: "ongoing" }),
            createMeeting({ id: "meeting-002", title: "Segundo encontro", status: "scheduled" }),
            createMeeting({ id: "meeting-003", title: "Terceiro encontro", status: "scheduled" }),
          ],
        })}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Grupo autenticado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Primeiro encontro" })).toBeInTheDocument();
    expect(screen.getByText("Em andamento")).toBeInTheDocument();
    expect(screen.getAllByText("Agendado")).toHaveLength(2);
    expect(
      screen.getByText("Segundo encontro").compareDocumentPosition(screen.getByText("Terceiro encontro")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("diferencia sem grupo, grupo inativo e lista vazia", () => {
    const { rerender } = render(
      <UserMeetingsPanel
        audience="student"
        data={createResult({ group: null, items: [] })}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Nenhum grupo vinculado")).toBeInTheDocument();

    rerender(
      <UserMeetingsPanel
        audience="student"
        data={createResult({
          group: { id: "group-001", name: "Grupo autenticado", status: "inactive" },
          items: [],
        })}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Grupo inativo")).toBeInTheDocument();

    rerender(
      <UserMeetingsPanel
        audience="student"
        data={createResult({ items: [] })}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Sem encontros próximos")).toBeInTheDocument();
  });

  it("trata loading, erro e retry com semântica acessível", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <UserMeetingsPanel
        audience="teacher"
        data={null}
        error={null}
        isLoading
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Carregando encontros do grupo").closest("[aria-busy='true']")).toBeInTheDocument();

    rerender(
      <UserMeetingsPanel
        audience="teacher"
        data={null}
        error={new ServiceRequestError({ kind: "api", code: "FORBIDDEN", message: "Acesso negado." })}
        isLoading={false}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Acesso não autorizado");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("exibe link somente quando meetUrl está presente", () => {
    const { rerender } = render(
      <UserMeetingsPanel
        audience="student"
        data={createResult()}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Entrar no Google Meet" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij",
    );

    rerender(
      <UserMeetingsPanel
        audience="student"
        data={createResult({ items: [createMeeting({ meetUrl: null })] })}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
    expect(screen.getByText("Link do encontro indisponível para esta visualização.")).toBeInTheDocument();
  });

  it("exibe aviso demonstrativo e fallback de data inválida", () => {
    render(
      <UserMeetingsPanel
        audience="student"
        data={createResult({
          items: [createMeeting({ startsAt: "data-invalida" })],
          notice: "Modo demonstrativo seguro.",
          source: "mock",
        })}
        error={null}
        isLoading={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Agenda demonstrativa")).toBeInTheDocument();
    expect(screen.getAllByText("Data indisponível").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 min")).not.toBeInTheDocument();
    expect(screen.queryByText("NaN min")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Encontro autenticado" })).toBeInTheDocument();
  });
});
