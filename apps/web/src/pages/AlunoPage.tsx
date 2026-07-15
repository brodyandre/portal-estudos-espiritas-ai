import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { StudentAccessGate } from "../components/access/StudentAccessGate";
import { FlowStepCard } from "../components/display/FlowStepCard";
import { UserMeetingsPanel } from "../components/meetings/UserMeetingsPanel";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { SectionTitle } from "../components/ui/SectionTitle";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextInput } from "../components/ui/TextInput";
import type {
  DemoFlowStep,
  DemoGroup,
  DemoProgressResponse,
  DemoQuestion,
  GroupSlug,
} from "../mocks";
import { groups as demoGroups } from "../mocks";
import { useUserStudyMeetings } from "../hooks/useUserStudyMeetings";
import { collectServiceNotice } from "../services/api";
import {
  askStudyAssistant,
  getInitialAssistantReply,
  type AssistantReply,
} from "../services/agentService";
import {
  listKnowledgeFilesByGroup,
  type KnowledgeSupportFile,
} from "../services/knowledgeService";
import { listMaterials } from "../services/materialsService";
import { buildProgressHighlights, getProgress } from "../services/progressService";
import { createQuestion, listQuestions } from "../services/questionsService";
import { listStudies } from "../services/studiesService";
import {
  getStudentAccessStatusFromSearch,
  readStudentAccessStatus,
  writeStudentAccessStatus,
  type StudentAccessStatus,
} from "../services/studentAccessService";
import { listSummaries } from "../services/summariesService";
import { appConfig } from "../config/appMode";

type AssistantFeedback = "helpful" | "not-helpful" | null;

const studentSteps: DemoFlowStep[] = [
  {
    step: 1,
    title: "Escolhem o livro ou grupo.",
    description: "Comecam pelo grupo que desejam acompanhar nesta semana.",
  },
  {
    step: 2,
    title: "Acessam a próxima aula pelo Meet.",
    description: "Entram rapidamente no encontro certo no horario combinado.",
  },
  {
    step: 3,
    title: "Consultam resumos e materiais.",
    description: "Retomam o tema com leitura curta, clara e organizada.",
  },
  {
    step: 4,
    title: "Perguntam ao assistente suas dúvidas.",
    description: "Recebem um apoio simples para revisar o estudo com calma.",
  },
  {
    step: 5,
    title: "Acompanham seu progresso.",
    description: "Percebem sua constância, presença e próximos passos do estudo.",
  },
];

const groupCardIds: Record<DemoGroup["slug"], string> = {
  emmanuel: "grupo-emmanuel",
  "a-caminho-da-luz": "grupo-a-caminho-da-luz",
};

const quickQuestionSuggestions: Record<GroupSlug, string[]> = {
  emmanuel: [
    "Como continuar estudando mesmo desanimado?",
    "O que significa esforco proprio?",
    "Como viver o Evangelho na pratica?",
    "Como lidar com duvidas sobre mediunidade?",
  ],
  "a-caminho-da-luz": [
    "O livro e historico ou espiritual?",
    "O que significa Capela?",
    "Como entender racas adamicas com prudencia?",
    "Qual o papel do Evangelho no futuro da humanidade?",
  ],
};

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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialAccessStatus = appConfig.canUseStudentPrivateArea
    ? (getStudentAccessStatusFromSearch(searchParams) ?? readStudentAccessStatus())
    : "visitor";
  const [studentAccessStatus, setStudentAccessStatus] = useState<StudentAccessStatus>(initialAccessStatus);
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listMaterials>>["data"]>([]);
  const [summaries, setSummaries] = useState<Awaited<ReturnType<typeof listSummaries>>["data"]>([]);
  const [questions, setQuestions] = useState<DemoQuestion[]>([]);
  const [supportFiles, setSupportFiles] = useState<KnowledgeSupportFile[]>([]);
  const [progress, setProgress] = useState<DemoProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeGroupSlug, setActiveGroupSlug] = useState<DemoGroup["slug"]>("emmanuel");
  const [selectedSupportFileId, setSelectedSupportFileId] = useState<string | null>(null);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<AssistantReply>(getInitialAssistantReply());
  const [assistantFeedback, setAssistantFeedback] = useState<AssistantFeedback>(null);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState("");
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [isSendingTeacherQuestion, setIsSendingTeacherQuestion] = useState(false);
  const userMeetings = useUserStudyMeetings({
    enabled: studentAccessStatus === "approved",
    limit: 3,
  });

  useEffect(() => {
    if (user?.role === "student" || user?.role === "teacher" || user?.role === "admin") {
      setStudentAccessStatus("approved");
      return;
    }

    if (!appConfig.canUseStudentPrivateArea) {
      return;
    }

    const nextStatus = getStudentAccessStatusFromSearch(searchParams);

    if (!nextStatus) {
      return;
    }

    writeStudentAccessStatus(nextStatus);
    setStudentAccessStatus(nextStatus);
  }, [searchParams, user?.role]);

  useEffect(() => {
    if (studentAccessStatus !== "approved") {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const loadDashboard = async () => {
      setIsLoading(true);

      const [
        studiesResult,
        materialsResult,
        summariesResult,
        questionsResult,
        progressResult,
        emmanuelKnowledgeResult,
        caminhoKnowledgeResult,
      ] = await Promise.all([
        listStudies(),
        listMaterials(),
        listSummaries(),
        listQuestions(),
        getProgress(),
        listKnowledgeFilesByGroup("emmanuel"),
        listKnowledgeFilesByGroup("a-caminho-da-luz"),
      ]);

      if (!isActive) {
        return;
      }

      setGroups(studiesResult.data);
      setMaterials(materialsResult.data);
      setSummaries(summariesResult.data);
      setQuestions(questionsResult.data);
      setSupportFiles([
        ...emmanuelKnowledgeResult.data,
        ...caminhoKnowledgeResult.data,
      ]);
      setProgress(progressResult.data);
      setNotice(
        collectServiceNotice([
          studiesResult,
          materialsResult,
          summariesResult,
          questionsResult,
          progressResult,
          emmanuelKnowledgeResult,
          caminhoKnowledgeResult,
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
  }, [studentAccessStatus]);

  const availableGroups = groups.length > 0 ? groups : demoGroups;
  const activeGroup =
    groups.find((group) => group.slug === activeGroupSlug) ??
    availableGroups.find((group) => group.slug === activeGroupSlug) ??
    availableGroups[0] ??
    null;
  const activeMaterials = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return materials.filter((material) => material.groupSlug === activeGroup.slug);
  }, [activeGroup, materials]);
  const activeSupportFiles = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return supportFiles.filter((file) => file.groupSlug === activeGroup.slug);
  }, [activeGroup, supportFiles]);
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
  const activeSupportFile =
    activeSupportFiles.find((file) => file.id === selectedSupportFileId) ?? activeSupportFiles[0] ?? null;
  const activeQuickQuestions = activeGroup
    ? quickQuestionSuggestions[activeGroup.slug]
    : quickQuestionSuggestions.emmanuel;
  const requestedGroupSlug = searchParams.get("grupo");

  useEffect(() => {
    if (studentAccessStatus !== "approved") {
      return;
    }

    if (!requestedGroupSlug) {
      return;
    }

    const normalizedRequestedGroup = requestedGroupSlug.trim().toLowerCase();

    if (
      normalizedRequestedGroup === "emmanuel" ||
      normalizedRequestedGroup === "a-caminho-da-luz"
    ) {
      setActiveGroupSlug(normalizedRequestedGroup as DemoGroup["slug"]);
    }
  }, [requestedGroupSlug, studentAccessStatus]);

  useEffect(() => {
    setAssistantResponse(getInitialAssistantReply());
    setAssistantFeedback(null);
    setAssistantMessage(null);
    setLastSubmittedQuestion("");
  }, [activeGroupSlug]);

  useEffect(() => {
    setSelectedSupportFileId((currentId) => {
      return activeSupportFiles.some((file) => file.id === currentId)
        ? currentId
        : (activeSupportFiles[0]?.id ?? null);
    });
  }, [activeSupportFiles]);

  if (studentAccessStatus !== "approved") {
    return <StudentAccessGate status={studentAccessStatus} />;
  }

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
      supportFiles: activeSupportFiles,
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
      <section className="student-hero" id="aluno-inicio">
        <div className="student-hero__intro">
          <Badge tone="sand">Área do aluno</Badge>
          <h1>Educação Continuada</h1>
          <p className="student-hero__subtitle">Painel do Aluno</p>
          <p className="student-hero__description">
            Acompanhe a próxima aula, revise materiais, registre dúvidas e veja seu progresso em um
            fluxo simples e acolhedor.
          </p>
        </div>

        <div className="student-hero__actions">
          <button aria-label="Ver avisos do aluno" className="student-icon-button" type="button">
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

      <section className="student-page__meetings-section page-section">
        <SectionTitle
          description="Agenda carregada pelo vínculo autenticado. A seleção de livro abaixo continua servindo apenas para materiais e dúvidas."
          title="Encontros do seu grupo"
        />
        <UserMeetingsPanel
          audience="student"
          data={userMeetings.data}
          error={userMeetings.error}
          isLoading={userMeetings.isLoading}
          onRetry={userMeetings.refetch}
        />
      </section>

      <section className="student-page__groups-section page-section">
        <SectionTitle
          action={
            <Select
              id="student-group-select"
              label="Livro ou grupo"
              onChange={(event) => setActiveGroupSlug(event.target.value as DemoGroup["slug"])}
              options={availableGroups.map((group) => ({
                label: group.name,
                value: group.slug,
              }))}
              value={activeGroupSlug}
            />
          }
          description="Escolha o livro que deseja acompanhar para atualizar os materiais de apoio e as perguntas sugeridas."
          title="Escolha o grupo ou livro"
        />

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
                    <div>
                      <dt>Livro</dt>
                      <dd>{group.name}</dd>
                    </div>
                  </dl>

                  <div className="button-row">
                    <p className="student-panel__note">
                      A agenda e o Meet real aparecem no bloco Encontros do seu grupo.
                    </p>
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
              <Card className="student-panel student-panel--upcoming" id="aluno-proxima-aula" tone="brand">
                <div className="student-panel__header">
                  <div>
                    <p className="card-eyebrow">Próxima aula</p>
                    <h2>{activeGroup.nextLesson.title}</h2>
                  </div>
                  <StatusTag tone="upcoming" />
                </div>
                <p className="student-panel__note">
                  {activeGroup.name} • {activeGroup.nextLesson.scheduledLabel}
                </p>
                <p className="student-panel__note">Leitura recomendada: {recommendedReading}</p>
                <div className="button-row">
                  <p className="student-panel__note">
                    Use o bloco Encontros do seu grupo para acessar o Meet real.
                  </p>
                  <Button to={`/materiais/${activeGroup.slug}`} variant="secondary">
                    Ver materiais do livro
                  </Button>
                </div>
              </Card>

              <Card
                aria-busy={isAssistantLoading}
                className="student-panel student-panel--assistant"
                id="aluno-duvidas"
                tone="default"
              >
                <div className="student-panel__header">
                  <div>
                    <p className="card-eyebrow">Pergunte ao assistente</p>
                    <h2>Apoio inicial para estudar</h2>
                  </div>
                  <Badge tone="sand">{activeGroup.name}</Badge>
                </div>

                <div className="assistant-card__chips" aria-label="Sugestoes de perguntas" role="list">
                  {activeQuickQuestions.map((suggestion) => (
                    <button
                      className="assistant-chip"
                      key={suggestion}
                      onClick={() => void handleAssistantSubmit(suggestion)}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <div className="assistant-card__composer">
                  <TextInput
                    id="assistant-question"
                    label="Sua duvida"
                    onChange={(event) => setAssistantInput(event.target.value)}
                    placeholder={`Exemplo: o que vale revisar melhor no grupo ${activeGroup.name}?`}
                    value={assistantInput}
                  />
                  <Button onClick={() => void handleAssistantSubmit()}>
                    {isAssistantLoading ? "Enviando..." : "Enviar"}
                  </Button>
                </div>

                <div aria-live="polite" className="assistant-card__response">
                  <strong>
                    {assistantResponse.groupLabel
                      ? `Resposta para ${assistantResponse.groupLabel}`
                      : "Resposta demonstrativa"}
                  </strong>
                  <p>{assistantResponse.answer}</p>
                  <AlertBox className="assistant-card__alert" title="Uso responsavel" tone="warning">
                    Resposta baseada nos materiais cadastrados. Em temas sensíveis, converse com o professor.
                  </AlertBox>
                  {assistantResponse.teacherFollowUp ? (
                    <p className="assistant-card__helper">{assistantResponse.teacherFollowUp}</p>
                  ) : (
                    <p className="assistant-card__helper">{assistantResponse.supportNotice}</p>
                  )}
                  {assistantResponse.warnings.length > 0 ? (
                    <div className="assistant-card__warnings">
                      {assistantResponse.warnings.slice(0, 2).map((warning) => (
                        <p className="assistant-card__source" key={warning}>
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="assistant-card__sources">
                  <p className="assistant-card__sources-label">Fontes usadas</p>
                  <div className="button-row">
                    {assistantResponse.sources.map((source) => (
                      <Badge key={source} tone="sand">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="assistant-card__feedback">
                  <div className="button-row">
                    <Button onClick={() => setAssistantFeedback("helpful")} variant="secondary">
                      Foi util
                    </Button>
                    <Button onClick={() => setAssistantFeedback("not-helpful")} variant="ghost">
                      Não foi útil
                    </Button>
                    <Button onClick={() => void handleSendQuestionToTeacher()} variant="secondary">
                      {isSendingTeacherQuestion ? "Enviando..." : "Enviar dúvida ao professor"}
                    </Button>
                  </div>

                  {assistantFeedback ? (
                    <p className="student-panel__note">
                      Feedback registrado: {assistantFeedback === "helpful" ? "foi útil" : "não foi útil"}.
                    </p>
                  ) : null}
                  {assistantMessage ? (
                    <p aria-live="polite" className="student-panel__note">
                      {assistantMessage}
                    </p>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>

          <section className="student-page__resources-section page-section">
            <div className="student-resources-layout">
              <Card className="student-panel student-panel--support" id="materiais-da-semana" tone="soft">
                <div className="student-panel__header">
                  <div>
                    <h2>Materiais de apoio</h2>
                    <p className="student-panel__note">
                      Arquivos curtos do livro selecionado para preparar sua leitura, sua pergunta
                      e a conversa do encontro.
                    </p>
                  </div>
                  <div className="button-row">
                    <Badge tone="sand">{activeSupportFiles.length} arquivos</Badge>
                    <Button size="compact" to={`/materiais/${activeGroup.slug}`} variant="secondary">
                      Abrir pagina do livro
                    </Button>
                  </div>
                </div>
                {activeSupportFiles.length > 0 ? (
                  <div className="student-support-list">
                    {activeSupportFiles.map((file) => {
                      const isActiveSupportFile = activeSupportFile?.id === file.id;

                      return (
                        <article
                          className={`student-support-item ${
                            isActiveSupportFile ? "student-support-item--active" : ""
                          }`}
                          key={file.id}
                        >
                          <div className="student-support-item__header">
                            <div>
                              <strong>{file.title}</strong>
                              <p className="stack-list__meta">{file.typeLabel}</p>
                            </div>
                            <Badge tone="sand">{file.typeLabel}</Badge>
                          </div>

                          <div className="student-support-item__tags" aria-label="Palavras de apoio">
                            {file.tags.slice(0, 5).map((tag) => (
                              <Badge key={`${file.id}-${tag}`} tone="neutral">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {isActiveSupportFile ? (
                            <div aria-live="polite" className="student-support-item__preview">
                              <p>{file.summary}</p>
                              {file.teacherReviewRecommended ? (
                                <AlertBox title="Revisao recomendada" tone="warning">
                                  Este ponto merece conversa com o professor antes de virar
                                  conclusao do grupo.
                                </AlertBox>
                              ) : (
                                <p className="assistant-card__helper">
                                  Use este resumo como apoio para sua leitura e para preparar sua
                                  pergunta.
                                </p>
                              )}
                            </div>
                          ) : null}

                          <Button
                            onClick={() => setSelectedSupportFileId(file.id)}
                            size="compact"
                            variant={isActiveSupportFile ? "primary" : "secondary"}
                          >
                            {isActiveSupportFile ? "Resumo aberto" : file.actionLabel}
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    description="Os materiais do livro selecionado ainda não foram carregados."
                    title="Sem materiais de apoio"
                  />
                )}
              </Card>

              <div className="student-resources-stack">
                <Card className="student-panel" id="duvidas-enviadas" tone="soft">
                  <div className="student-panel__header">
                    <h2>Minhas dúvidas enviadas</h2>
                    <Badge tone="sand">{filteredQuestions.length}</Badge>
                  </div>
                  <div className="stack-list">
                    {filteredQuestions.slice(0, 3).map((question) => {
                      const status = getQuestionStatus(question.status);

                      return (
                        <article className="stack-list__item" key={question.id}>
                          <div className="student-panel__header">
                            <strong>{question.question}</strong>
                            <StatusTag label={status.label} tone={status.tone} />
                          </div>
                          <p className="student-panel__note">{question.lessonTitle}</p>
                        </article>
                      );
                    })}
                  </div>
                </Card>

                <Card className="student-panel" id="aluno-resumo" tone="soft">
                  <div className="student-panel__header">
                    <h2>Resumo da ultima aula</h2>
                    <Badge tone="sand">{activeSummary?.readingTimeLabel ?? "Leitura breve"}</Badge>
                  </div>
                  <p className="student-panel__note">
                    {activeSummary?.content ?? "Resumo demonstrativo disponível para revisão."}
                  </p>
                  {activeSummary?.takeaways.length ? (
                    <ul className="bullet-list">
                      {activeSummary.takeaways.map((takeaway) => (
                        <li key={takeaway}>{takeaway}</li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </div>
            </div>
          </section>

          <section className="student-page__progress-section page-section" id="meu-progresso">
            <div className="two-column-grid">
              <Card className="student-panel" tone="default">
                <div className="student-panel__header">
                  <h2>Meu progresso</h2>
                  <Badge tone="success">Demonstrativo</Badge>
                </div>
                <div className="student-progress-list">
                  {progressHighlights.map((highlight) => (
                    <div className="student-progress-row" key={highlight.label}>
                      <div className="student-progress-row__top">
                        <strong>{highlight.label}</strong>
                        <span>{highlight.value}</span>
                      </div>
                      <p>{highlight.note}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="student-panel" tone="default">
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
