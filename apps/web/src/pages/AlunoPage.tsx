import { useEffect, useMemo, useState } from "react";

import { FlowStepCard } from "../components/display/FlowStepCard";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { StatusTag } from "../components/ui/StatusTag";
import { TextInput } from "../components/ui/TextInput";
import type {
  DemoFlowStep,
  DemoGroup,
  DemoProgressResponse,
  DemoQuestion,
} from "../mocks";
import { collectServiceNotice } from "../services/api";
import {
  askStudyAssistant,
  getInitialAssistantReply,
  type AssistantReply,
} from "../services/agentService";
import { listMaterials } from "../services/materialsService";
import { buildProgressHighlights, getProgress } from "../services/progressService";
import { createQuestion, listQuestions } from "../services/questionsService";
import { listStudies } from "../services/studiesService";
import { listSummaries } from "../services/summariesService";

type AssistantFeedback = "helpful" | "not-helpful" | null;

const studentSteps: DemoFlowStep[] = [
  {
    step: 1,
    title: "Escolhem o livro ou grupo.",
    description: "Comecam pelo grupo que desejam acompanhar nesta semana.",
  },
  {
    step: 2,
    title: "Acessam a proxima aula pelo Meet.",
    description: "Entram rapidamente no encontro certo no horario combinado.",
  },
  {
    step: 3,
    title: "Consultam resumos e materiais.",
    description: "Retomam o tema com leitura curta, clara e organizada.",
  },
  {
    step: 4,
    title: "Perguntam ao assistente suas duvidas.",
    description: "Recebem um apoio simples para revisar o estudo com calma.",
  },
  {
    step: 5,
    title: "Acompanham seu progresso.",
    description: "Percebem sua constancia, presenca e proximos passos do estudo.",
  },
];

const groupCardIds: Record<DemoGroup["slug"], string> = {
  emmanuel: "grupo-emmanuel",
  "a-caminho-da-luz": "grupo-a-caminho-da-luz",
};

const questionSuggestions = [
  "Como entro na proxima aula?",
  "Qual leitura devo revisar hoje?",
  "Pode resumir o ultimo encontro?",
];

const getQuestionStatus = (status: DemoQuestion["status"]) => {
  if (status === "answered") {
    return { tone: "answered" as const, label: "Respondida" };
  }

  if (status === "reviewing") {
    return { tone: "attention" as const, label: "Em revisao" };
  }

  return { tone: "upcoming" as const, label: "Nova" };
};

const BellIcon = () => {
  return (
    <svg aria-hidden="true" className="student-icon-svg" viewBox="0 0 24 24">
      <path
        d="M12 3a4 4 0 0 0-4 4v1.2c0 .8-.2 1.6-.6 2.3L6.2 13c-.4.8-.6 1.6-.6 2.5V17h12.8v-1.5c0-.9-.2-1.7-.6-2.5l-1.2-2.5a5.5 5.5 0 0 1-.6-2.3V7a4 4 0 0 0-4-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
};

export const AlunoPage = () => {
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listMaterials>>["data"]>([]);
  const [summaries, setSummaries] = useState<Awaited<ReturnType<typeof listSummaries>>["data"]>([]);
  const [questions, setQuestions] = useState<DemoQuestion[]>([]);
  const [progress, setProgress] = useState<DemoProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeGroupSlug, setActiveGroupSlug] = useState<DemoGroup["slug"]>("emmanuel");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<AssistantReply>(getInitialAssistantReply());
  const [assistantFeedback, setAssistantFeedback] = useState<AssistantFeedback>(null);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState("");
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [isSendingTeacherQuestion, setIsSendingTeacherQuestion] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      setIsLoading(true);

      const [studiesResult, materialsResult, summariesResult, questionsResult, progressResult] =
        await Promise.all([
          listStudies(),
          listMaterials(),
          listSummaries(),
          listQuestions(),
          getProgress(),
        ]);

      if (!isActive) {
        return;
      }

      setGroups(studiesResult.data);
      setMaterials(materialsResult.data);
      setSummaries(summariesResult.data);
      setQuestions(questionsResult.data);
      setProgress(progressResult.data);
      setNotice(
        collectServiceNotice([
          studiesResult,
          materialsResult,
          summariesResult,
          questionsResult,
          progressResult,
        ]),
      );
      setActiveGroupSlug((currentSlug) => {
        return studiesResult.data.some((group) => group.slug === currentSlug)
          ? currentSlug
          : (studiesResult.data[0]?.slug ?? currentSlug);
      });
      setIsLoading(false);
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const activeGroup = groups.find((group) => group.slug === activeGroupSlug) ?? groups[0] ?? null;
  const activeMaterials = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return materials.filter((material) => material.groupSlug === activeGroup.slug);
  }, [activeGroup, materials]);
  const activeSummary = useMemo(() => {
    if (!activeGroup) {
      return null;
    }

    return summaries.find((summary) => summary.groupSlug === activeGroup.slug) ?? null;
  }, [activeGroup, summaries]);
  const filteredQuestions = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return questions.filter((question) => question.groupSlug === activeGroup.slug);
  }, [activeGroup, questions]);
  const activeProgress = progress?.items.find((item) => item.groupSlug === activeGroup?.slug) ?? null;
  const progressHighlights = progress ? buildProgressHighlights(progress) : [];
  const recommendedReading =
    activeMaterials.find((material) => material.kind === "Leitura")?.title ??
    "Leitura demonstrativa da semana";

  useEffect(() => {
    setAssistantResponse(getInitialAssistantReply());
    setAssistantFeedback(null);
    setAssistantMessage(null);
    setLastSubmittedQuestion("");
  }, [activeGroupSlug]);

  const handleAssistantSubmit = async (nextQuestion?: string) => {
    const content = (nextQuestion ?? assistantInput).trim();

    if (!content || isAssistantLoading || !activeGroup) {
      return;
    }

    setAssistantInput(content);
    setIsAssistantLoading(true);
    setAssistantFeedback(null);
    setAssistantMessage(null);
    setLastSubmittedQuestion(content);

    const result = await askStudyAssistant({
      question: content,
      group: activeGroup,
      materials: activeMaterials,
      summary: activeSummary,
    });

    setAssistantResponse(result.data);
    setAssistantMessage(
      result.notice ??
        (result.data.usedFallback
          ? "A resposta foi preparada em modo demonstrativo. Se precisar aprofundar, envie a duvida ao professor."
          : null),
    );
    setIsAssistantLoading(false);
  };

  const handleSendQuestionToTeacher = async () => {
    if (!activeGroup || !progress || !lastSubmittedQuestion.trim() || isSendingTeacherQuestion) {
      return;
    }

    setIsSendingTeacherQuestion(true);

    const result = await createQuestion({
      groupId: activeGroup.slug,
      lessonId: activeGroup.nextLesson.id,
      authorName: progress.overview.studentName,
      question: lastSubmittedQuestion,
      visibility: "teacher",
    });

    setQuestions((current) => [result.data, ...current]);
    setAssistantMessage(
      result.notice ?? "Sua duvida foi enviada ao professor para revisao no proximo encontro.",
    );
    setIsSendingTeacherQuestion(false);
  };

  return (
    <div className="student-page page-stack">
      <div id="aluno-inicio" />

      <section className="student-hero">
        <div className="student-hero__intro">
          <Badge tone="sand">Area do aluno</Badge>
          <h1>Portal dos Estudos Espiritas Online</h1>
          <p className="student-hero__subtitle">Painel do Aluno</p>
          <p className="student-hero__description">
            Acompanhe a proxima aula, revise materiais, registre duvidas e veja seu progresso em um
            fluxo simples e acolhedor.
          </p>
        </div>

        <div className="student-hero__actions">
          <button className="student-icon-button" type="button">
            <BellIcon />
          </button>
          <div className="student-avatar-pill">
            <span className="student-avatar-pill__icon" aria-hidden="true">
              A
            </span>
            <span className="student-avatar-pill__label">Aluno</span>
          </div>
        </div>
      </section>

      {notice ? (
        <AlertBox title="Modo demonstrativo ativo" tone="info">
          {notice}
        </AlertBox>
      ) : null}

      <section className="student-page__groups-section page-section">
        {isLoading ? (
          <LoadingState
            description="Estamos reunindo grupos, materiais e progresso para montar seu painel."
            title="Carregando painel do aluno"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            description="Nenhum grupo foi encontrado para exibir agora."
            title="Sem grupos disponiveis"
          />
        ) : (
          <div className="group-grid">
            {groups.map((group) => {
              const isActive = activeGroup?.slug === group.slug;
              const readingTitle =
                materials.find(
                  (material) => material.groupSlug === group.slug && material.kind === "Leitura",
                )?.title ?? "Leitura demonstrativa";

              return (
                <Card
                  className={`student-group-card ${
                    isActive ? "student-group-card--active" : ""
                  }`}
                  id={groupCardIds[group.slug]}
                  key={group.slug}
                  tone={isActive ? "brand" : "default"}
                >
                  <div className="student-group-card__top">
                    <Badge tone="brand">{group.participantCount} participantes</Badge>
                    <StatusTag
                      label={isActive ? "Em destaque" : undefined}
                      tone={group.nextLesson.status === "hoje" ? "active" : "upcoming"}
                    />
                  </div>

                  <div className="student-group-card__body">
                    <h2>{group.name}</h2>
                    <p>{group.description}</p>
                  </div>

                  <dl className="group-card__meta">
                    <div>
                      <dt>Encontro</dt>
                      <dd>
                        {group.meetingDay}, {group.meetingTime}
                      </dd>
                    </div>
                    <div>
                      <dt>Tema</dt>
                      <dd>{group.nextLesson.title}</dd>
                    </div>
                    <div>
                      <dt>Leitura</dt>
                      <dd>{readingTitle}</dd>
                    </div>
                  </dl>

                  <div className="button-row">
                    <Button href={group.meetUrl} rel="noreferrer" target="_blank">
                      Entrar no Google Meet
                    </Button>
                    <Button
                      onClick={() => setActiveGroupSlug(group.slug)}
                      variant={isActive ? "primary" : "secondary"}
                    >
                      {isActive ? "Grupo selecionado" : "Ver este grupo"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="student-page__steps-section page-section">
        <h2>Como usar</h2>
        <div className="steps-grid">
          {studentSteps.map((step) => (
            <FlowStepCard key={step.step} step={step} />
          ))}
        </div>
      </section>

      {isLoading || !activeGroup ? null : (
        <>
          <section className="student-page__dashboard-section page-section">
            <div className="two-column-grid">
              <Card tone="brand">
                <div className="student-panel__header">
                  <div>
                    <p className="card-eyebrow">Proxima aula</p>
                    <h2>{activeGroup.nextLesson.title}</h2>
                  </div>
                  <StatusTag tone="upcoming" />
                </div>
                <p className="student-panel__note">
                  {activeGroup.name} • {activeGroup.nextLesson.scheduledLabel}
                </p>
                <p className="student-panel__note">Leitura recomendada: {recommendedReading}</p>
                <div className="button-row">
                  <Button href={activeGroup.meetUrl} rel="noreferrer" target="_blank">
                    Entrar no Google Meet
                  </Button>
                </div>
              </Card>

              <Card tone="default">
                <div className="student-panel__header">
                  <div>
                    <p className="card-eyebrow">Pergunte ao assistente</p>
                    <h2>Apoio inicial para estudar</h2>
                  </div>
                  <Badge tone="sand">Revisavel</Badge>
                </div>

                <TextInput
                  id="assistant-question"
                  label="Sua duvida"
                  onChange={(event) => setAssistantInput(event.target.value)}
                  placeholder="Exemplo: como revisar melhor a aula desta semana?"
                  value={assistantInput}
                />

                <div className="button-row">
                  {questionSuggestions.map((suggestion) => (
                    <Button key={suggestion} onClick={() => handleAssistantSubmit(suggestion)} variant="ghost">
                      {suggestion}
                    </Button>
                  ))}
                </div>

                <div className="button-row">
                  <Button onClick={() => void handleAssistantSubmit()}>
                    {isAssistantLoading ? "Enviando..." : "Enviar"}
                  </Button>
                </div>

                <AlertBox title="Resposta demonstrativa" tone="info">
                  {assistantResponse.answer}
                </AlertBox>

                <p className="assistant-card__source">{assistantResponse.supportNotice}</p>
                <div className="button-row">
                  {assistantResponse.sources.map((source) => (
                    <Badge key={source} tone="sand">
                      {source}
                    </Badge>
                  ))}
                </div>

                <div className="button-row">
                  <Button onClick={() => setAssistantFeedback("helpful")} variant="secondary">
                    Foi util
                  </Button>
                  <Button onClick={() => setAssistantFeedback("not-helpful")} variant="ghost">
                    Nao foi util
                  </Button>
                  <Button onClick={() => void handleSendQuestionToTeacher()} variant="secondary">
                    {isSendingTeacherQuestion ? "Enviando..." : "Enviar duvida ao professor"}
                  </Button>
                </div>

                {assistantFeedback ? (
                  <p className="student-panel__note">
                    Feedback registrado: {assistantFeedback === "helpful" ? "foi util" : "nao foi util"}.
                  </p>
                ) : null}
                {assistantMessage ? <p className="student-panel__note">{assistantMessage}</p> : null}
              </Card>
            </div>
          </section>

          <section className="page-section">
            <div className="three-column-grid">
              <Card tone="soft">
                <div className="student-panel__header">
                  <h2>Resumo da ultima aula</h2>
                  <Badge tone="sand">{activeSummary?.readingTimeLabel ?? "Leitura breve"}</Badge>
                </div>
                <p className="student-panel__note">
                  {activeSummary?.content ?? "Resumo demonstrativo disponivel para revisao."}
                </p>
              </Card>

              <Card id="materiais-da-semana" tone="soft">
                <div className="student-panel__header">
                  <h2>Materiais da semana</h2>
                  <Badge tone="sand">{activeMaterials.length} itens</Badge>
                </div>
                <div className="page-stack">
                  {activeMaterials.map((material) => (
                    <div key={material.id}>
                      <strong>{material.title}</strong>
                      <p className="student-panel__note">{material.description}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card id="duvidas-enviadas" tone="soft">
                <div className="student-panel__header">
                  <h2>Minhas duvidas enviadas</h2>
                  <Badge tone="sand">{filteredQuestions.length}</Badge>
                </div>
                <div className="page-stack">
                  {filteredQuestions.slice(0, 3).map((question) => {
                    const status = getQuestionStatus(question.status);

                    return (
                      <div key={question.id}>
                        <div className="student-panel__header">
                          <strong>{question.question}</strong>
                          <StatusTag label={status.label} tone={status.tone} />
                        </div>
                        <p className="student-panel__note">{question.lessonTitle}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </section>

          <section className="page-section" id="meu-progresso">
            <div className="two-column-grid">
              <Card tone="default">
                <div className="student-panel__header">
                  <h2>Meu progresso</h2>
                  <Badge tone="success">Demonstrativo</Badge>
                </div>
                <div className="page-stack">
                  {progressHighlights.map((highlight) => (
                    <div className="student-progress-row" key={highlight.label}>
                      <strong>{highlight.label}</strong>
                      <p>{highlight.value}</p>
                      <p>{highlight.note}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card tone="default">
                <div className="student-panel__header">
                  <h2>Meu foco nesta semana</h2>
                  <StatusTag tone="active" />
                </div>
                <p className="student-panel__note">{activeProgress?.encouragement}</p>
                <p className="student-panel__note">{activeProgress?.nextGoal}</p>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
