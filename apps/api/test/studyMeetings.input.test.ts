import { describe, expect, it } from "vitest";

import {
  parseCancelStudyMeetingBody,
  parseCreateStudyMeetingBody,
  parseUpdateStudyMeetingBody,
} from "../src/modules/study-meetings/study-meetings.input";
import {
  parseStudyMeetingRouteParam,
  parseStudyMeetingsListQuery,
} from "../src/modules/study-meetings/study-meetings.query";
import {
  STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH,
  STUDY_MEETING_ID_MAX_LENGTH,
  STUDY_MEETING_TITLE_MAX_LENGTH,
} from "../src/modules/study-meetings/study-meetings.types";

const expectCode = (callback: () => unknown, code: string) => {
  expect(callback).toThrow(expect.objectContaining({ code }));
};

describe("study meetings HTTP input parsers", () => {
  it("normaliza params e rejeita valores repetidos, vazios e longos", () => {
    expect(parseStudyMeetingRouteParam("  emmanuel  ", "groupId")).toBe("emmanuel");
    expect(parseStudyMeetingRouteParam("x".repeat(STUDY_MEETING_ID_MAX_LENGTH), "meetingId")).toHaveLength(
      STUDY_MEETING_ID_MAX_LENGTH,
    );

    expectCode(() => parseStudyMeetingRouteParam(["emmanuel"], "groupId"), "INVALID_STUDY_MEETING_INPUT");
    expectCode(() => parseStudyMeetingRouteParam({ id: "emmanuel" }, "groupId"), "INVALID_STUDY_MEETING_INPUT");
    expectCode(() => parseStudyMeetingRouteParam("   ", "groupId"), "INVALID_STUDY_MEETING_INPUT");
    expectCode(
      () => parseStudyMeetingRouteParam("x".repeat(STUDY_MEETING_ID_MAX_LENGTH + 1), "meetingId"),
      "INVALID_STUDY_MEETING_INPUT",
    );
  });

  it("parseia query de listagem com defaults, limites e rejeicoes estritas", () => {
    expect(parseStudyMeetingsListQuery("emmanuel", {})).toEqual({
      groupId: "emmanuel",
      page: 1,
      pageSize: 10,
      sortOrder: "asc",
      includeCanceled: false,
    });
    expect(
      parseStudyMeetingsListQuery("emmanuel", {
        page: "2",
        pageSize: "50",
        sortOrder: "desc",
        includeCanceled: "true",
      }),
    ).toEqual({
      groupId: "emmanuel",
      page: 2,
      pageSize: 50,
      sortOrder: "desc",
      includeCanceled: true,
    });
    expect(parseStudyMeetingsListQuery("emmanuel", { includeCanceled: "false" }).includeCanceled).toBe(false);

    for (const query of [
      { page: "0" },
      { page: "1.5" },
      { page: "" },
      { page: ["1"] },
      { pageSize: "51" },
      { sortOrder: "DESC" },
      { includeCanceled: "1" },
      { search: "aula" },
    ]) {
      expectCode(() => parseStudyMeetingsListQuery("emmanuel", query), "INVALID_STUDY_MEETING_LIST_INPUT");
    }
  });

  it("parseia body de criacao e exige ISO 8601 com timezone", () => {
    expect(
      parseCreateStudyMeetingBody("emmanuel", {
        title: "  Aula semanal  ",
        description: null,
        startsAt: "2026-07-15T17:00:00-03:00",
        endsAt: "2026-07-15T21:30:00Z",
      }),
    ).toEqual({
      groupId: "emmanuel",
      title: "Aula semanal",
      description: null,
      startsAt: "2026-07-15T20:00:00.000Z",
      endsAt: "2026-07-15T21:30:00.000Z",
    });
    expect(
      parseCreateStudyMeetingBody("emmanuel", {
        title: "T".repeat(STUDY_MEETING_TITLE_MAX_LENGTH),
        startsAt: "2026-07-15T20:00:00Z",
        endsAt: "2026-07-15T21:00:00Z",
      }).title,
    ).toHaveLength(STUDY_MEETING_TITLE_MAX_LENGTH);

    for (const body of [
      undefined,
      null,
      [],
      {},
      { title: "Aula", startsAt: "2026-07-15T20:00:00Z" },
      { title: "", startsAt: "2026-07-15T20:00:00Z", endsAt: "2026-07-15T21:00:00Z" },
      {
        title: "T".repeat(STUDY_MEETING_TITLE_MAX_LENGTH + 1),
        startsAt: "2026-07-15T20:00:00Z",
        endsAt: "2026-07-15T21:00:00Z",
      },
      { title: "Aula", startsAt: "2026-07-15T20:00:00", endsAt: "2026-07-15T21:00:00Z" },
      { title: "Aula", startsAt: "07/15/2026", endsAt: "2026-07-15T21:00:00Z" },
      { title: "Aula", startsAt: "2026-07-15T20:00:00Z", endsAt: "invalida" },
      { title: "Aula", startsAt: "2026-07-15T20:00:00Z", endsAt: "2026-07-15T21:00:00Z", meetUrl: "x" },
      { title: "Aula", startsAt: "2026-07-15T20:00:00Z", endsAt: "2026-07-15T21:00:00Z", canceledAt: "x" },
    ]) {
      expectCode(() => parseCreateStudyMeetingBody("emmanuel", body), "INVALID_STUDY_MEETING_INPUT");
    }
  });

  it("parseia body de atualizacao preservando ausente versus null", () => {
    expect(parseUpdateStudyMeetingBody("emmanuel", "meeting-1", { description: null })).toEqual({
      groupId: "emmanuel",
      meetingId: "meeting-1",
      description: null,
    });
    expect(
      parseUpdateStudyMeetingBody("emmanuel", "meeting-1", {
        startsAt: "2026-07-15T17:00:00-03:00",
        endsAt: "2026-07-15T22:00:00Z",
      }),
    ).toEqual({
      groupId: "emmanuel",
      meetingId: "meeting-1",
      startsAt: "2026-07-15T20:00:00.000Z",
      endsAt: "2026-07-15T22:00:00.000Z",
    });

    for (const body of [
      undefined,
      null,
      [],
      {},
      { title: null },
      { startsAt: null },
      { endsAt: "2026-07-15T20:00:00" },
      { groupId: "outro" },
      { status: "canceled" },
    ]) {
      expectCode(() => parseUpdateStudyMeetingBody("emmanuel", "meeting-1", body), "INVALID_STUDY_MEETING_UPDATE_INPUT");
    }
  });

  it("parseia body de cancelamento com trim, limite e chave unica", () => {
    expect(
      parseCancelStudyMeetingBody("emmanuel", "meeting-1", {
        cancellationReason: "  Recesso  ",
      }),
    ).toEqual({
      groupId: "emmanuel",
      meetingId: "meeting-1",
      cancellationReason: "Recesso",
    });
    expect(
      parseCancelStudyMeetingBody("emmanuel", "meeting-1", {
        cancellationReason: "M".repeat(STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH),
      }).cancellationReason,
    ).toHaveLength(STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH);

    for (const body of [
      undefined,
      null,
      [],
      {},
      { cancellationReason: "" },
      { cancellationReason: " " },
      { cancellationReason: null },
      { cancellationReason: "M".repeat(STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH + 1) },
      { cancellationReason: "Recesso", canceledAt: "2026-07-15T20:00:00Z" },
    ]) {
      expectCode(() => parseCancelStudyMeetingBody("emmanuel", "meeting-1", body), "INVALID_STUDY_MEETING_CANCEL_INPUT");
    }
  });
});
