import { summaries, type StudySummary } from "../../data/summaries";

export const listSummaries = (groupId?: string): StudySummary[] => {
  if (!groupId) {
    return summaries;
  }

  return summaries.filter((summary) => summary.groupId === groupId);
};
