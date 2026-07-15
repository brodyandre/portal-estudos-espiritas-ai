import { describe, expect, it } from "vitest";

import { parseUpcomingUserStudyMeetingsQuery } from "../src/modules/me/study-meetings.query";

const expectInvalidQuery = (query: Record<string, unknown>) => {
  expect(() => parseUpcomingUserStudyMeetingsQuery(query)).toThrow(
    expect.objectContaining({
      code: "INVALID_USER_STUDY_MEETINGS_QUERY",
      statusCode: 400,
    }),
  );
};

describe("user study meetings query parser", () => {
  it("usa limite padrao quando ausente", () => {
    expect(parseUpcomingUserStudyMeetingsQuery({})).toEqual({ limit: 3 });
  });

  it("aceita limite minimo e maximo", () => {
    expect(parseUpcomingUserStudyMeetingsQuery({ limit: "1" })).toEqual({ limit: 1 });
    expect(parseUpcomingUserStudyMeetingsQuery({ limit: "10" })).toEqual({ limit: 10 });
  });

  it.each([
    ["abaixo do minimo", { limit: "0" }],
    ["acima do maximo", { limit: "11" }],
    ["decimal", { limit: "1.5" }],
    ["string invalida", { limit: "abc" }],
    ["vazio", { limit: "" }],
    ["array", { limit: ["1", "2"] }],
    ["query inesperada", { groupId: "emmanuel" }],
  ])("rejeita query invalida: %s", (_caseName, query) => {
    expectInvalidQuery(query);
  });
});
