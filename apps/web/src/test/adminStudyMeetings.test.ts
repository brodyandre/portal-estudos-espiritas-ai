import { describe, expect, it } from "vitest";

import type { AdminStudyMeeting } from "../types/adminStudyMeetings";
import {
  canCancelAdminStudyMeeting,
  canEditAdminStudyMeeting,
  datetimeLocalToIso,
  getAdminStudyMeetingDerivedStatus,
  isoToDatetimeLocalValue,
} from "../utils/adminStudyMeetings";

const baseMeeting: AdminStudyMeeting = {
  id: "meeting-001",
  groupId: "emmanuel",
  title: "Aula semanal",
  description: null,
  startsAt: "2026-07-15T20:00:00.000Z",
  endsAt: "2026-07-15T21:00:00.000Z",
  canceledAt: null,
  cancellationReason: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

describe("adminStudyMeetings utils", () => {
  it("deriva status respeitando a precedência de cancelado", () => {
    expect(
      getAdminStudyMeetingDerivedStatus(
        {
          ...baseMeeting,
          canceledAt: "2026-07-14T10:00:00.000Z",
          cancellationReason: "Recesso",
        },
        new Date("2026-07-16T20:00:00.000Z"),
      ),
    ).toBe("canceled");
  });

  it("deriva status encerrado, em andamento e agendado", () => {
    expect(
      getAdminStudyMeetingDerivedStatus(
        baseMeeting,
        new Date("2026-07-15T21:00:00.000Z"),
      ),
    ).toBe("ended");
    expect(
      getAdminStudyMeetingDerivedStatus(
        baseMeeting,
        new Date("2026-07-15T20:30:00.000Z"),
      ),
    ).toBe("in_progress");
    expect(
      getAdminStudyMeetingDerivedStatus(
        baseMeeting,
        new Date("2026-07-15T19:59:59.000Z"),
      ),
    ).toBe("scheduled");
  });

  it("permite editar e cancelar apenas encontros agendados", () => {
    expect(canEditAdminStudyMeeting(baseMeeting, new Date("2026-07-15T19:00:00.000Z"))).toBe(true);
    expect(canCancelAdminStudyMeeting(baseMeeting, new Date("2026-07-15T19:00:00.000Z"))).toBe(true);
    expect(canEditAdminStudyMeeting(baseMeeting, new Date("2026-07-15T20:00:00.000Z"))).toBe(false);
    expect(canCancelAdminStudyMeeting(baseMeeting, new Date("2026-07-15T21:00:00.000Z"))).toBe(false);
  });

  it("converte datetime-local usando Date.toISOString", () => {
    const value = "2026-07-15T20:00";

    expect(datetimeLocalToIso(value)).toBe(new Date(value).toISOString());
  });

  it("rejeita datetime-local vazio ou inválido", () => {
    expect(() => datetimeLocalToIso("   ")).toThrow(RangeError);
    expect(() => datetimeLocalToIso("data-invalida")).toThrow(RangeError);
  });

  it("rejeita datas inválidas ao derivar status", () => {
    expect(() =>
      getAdminStudyMeetingDerivedStatus(
        {
          ...baseMeeting,
          startsAt: "data-invalida",
        },
        new Date("2026-07-15T19:00:00.000Z"),
      ),
    ).toThrow(RangeError);
    expect(() =>
      getAdminStudyMeetingDerivedStatus(
        baseMeeting,
        new Date("data-invalida"),
      ),
    ).toThrow(RangeError);
  });

  it("formata ISO para valor aceito por datetime-local", () => {
    expect(isoToDatetimeLocalValue("2026-07-15T20:05:30.000Z")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u,
    );
  });
});
