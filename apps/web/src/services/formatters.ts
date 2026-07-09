import type { DemoMaterial, DemoQuestion, DemoSummary } from "../mocks";

const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const capitalize = (value: string) => {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const formatMeetingDay = (value: string) => capitalize(value);

export const formatScheduledLabel = (value: string) => {
  const parts = fullDateFormatter.formatToParts(new Date(value));
  const weekday = capitalize(parts.find((part) => part.type === "weekday")?.value ?? "");
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";

  return `${weekday}, ${day} de ${month} de ${year}, ${hour}h`;
};

export const formatPublishedLabel = (value: string) => {
  const parts = shortDateFormatter.formatToParts(new Date(value));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = (parts.find((part) => part.type === "month")?.value ?? "").replace(/\./gu, "");
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const label = `${day} ${month.toLowerCase()} ${year}`.trim();

  return `Atualizado em ${label}`;
};

export const formatReadingTimeLabel = (minutes: number) => `Leitura de ${minutes} min`;

export const formatPercentLabel = (value: number) => `${Math.round(value * 100)}%`;

export const getLessonStatus = (scheduledAt: string): "proxima" | "hoje" => {
  const scheduledDate = new Date(scheduledAt);
  const today = new Date();

  const sameDay =
    scheduledDate.getFullYear() === today.getFullYear() &&
    scheduledDate.getMonth() === today.getMonth() &&
    scheduledDate.getDate() === today.getDate();

  return sameDay ? "hoje" : "proxima";
};

export const mapMaterialKind = (
  value: "reading" | "summary" | "guide" | "activity",
): DemoMaterial["kind"] => {
  if (value === "reading") {
    return "Leitura";
  }

  if (value === "summary") {
    return "Resumo";
  }

  if (value === "guide") {
    return "Orientacao";
  }

  return "Atividade";
};

export const buildLessonTitleLookup = (
  summaries: Pick<DemoSummary, "lessonId" | "lessonTitle">[],
  nextLessons: Array<{ id: string; title: string }>,
) => {
  const lookup = new Map<string, string>();

  for (const summary of summaries) {
    lookup.set(summary.lessonId, summary.lessonTitle);
  }

  for (const lesson of nextLessons) {
    lookup.set(lesson.id, lesson.title);
  }

  return lookup;
};

export const sortQuestionsByDate = (items: DemoQuestion[]) => {
  return [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};
