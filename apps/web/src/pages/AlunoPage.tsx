import { useMemo, useState } from "react";

import { FlowStepCard } from "../components/display/FlowStepCard";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusTag } from "../components/ui/StatusTag";
import { TextInput } from "../components/ui/TextInput";
import {
  createMockQuestion,
  groups,
  listMockMaterials,
  listMockQuestions,
  listMockSummaries,
  progress,
  studentHighlights,
  type DemoFlowStep,
  type DemoGroup,
  type DemoQuestion,
} from "../data/demo";

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

const buildAssistantReply = (question: string, group: DemoGroup, summaryTitle: string) => {
  const normalizedQuestion = question.toLowerCase();

  if (normalizedQuestion.includes("meet") || normalizedQuestion.includes("aula")) {
    return {
      answer: `A proxima aula do grupo ${group.name} sera em ${group.nextLesson.scheduledLabel}. Use o botao do Meet para entrar alguns minutos antes e chegar com tranquilidade.`,
      source: group.nextLesson.title,
    };
  }

  if (normalizedQuestion.includes("resumo") || normalizedQuestion.includes("ultimo")) {
    return {
      answer: `Uma boa revisao agora e retomar o resumo "${summaryTitle}" e anotar uma ideia principal para levar ao encontro.`,
      source: summaryTitle,
    };
  }

  return {
    answer: `Para o grupo ${group.name}, vale revisar o tema "${group.nextLesson.title}" e separar uma pergunta curta para a aula. Se a duvida continuar importante, leve-a ao professor para revisao.`,
    source: group.nextLesson.title,
  };
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
  const [activeGroupSlug, setActiveGroupSlug] = useState<DemoGroup["slug"]>("emmanuel");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState(
    "Escreva uma duvida curta para receber um apoio inicial de estudo.",
  );
  const [assistantSource, setAssistantSource] = useState("Materiais demonstrativos");
  const [assistantFeedback, setAssistantFeedback] = useState<AssistantFeedback>(null);
  const [teacherNotice, setTeacherNotice] = useState<string | null>(null);
  const [studentQuestions, setStudentQuestions] = useState(() => listMockQuestions());

  const activeGroup = groups.find((group) => group.slug === activeGroupSlug) ?? groups[0];
  const activeMaterials = useMemo(
    () => listMockMaterials({ groupSlug: activeGroup.slug }),
    [activeGroup.slug],
  );
  const activeSummary = useMemo(
    () => listMockSummaries(activeGroup.slug)[0] ?? null,
    [activeGroup.slug],
  );
  const filteredQuestions = studentQuestions.filter(
    (question) => question.groupSlug === activeGroup.slug,
  );
  const activeProgress = progress.items.find((item) => item.groupSlug === activeGroup.slug) ?? null;
  const recommendedReading =
    activeMaterials.find((material) => material.kind === "Leitura")?.title ??
    "Leitura demonstrativa da semana";

  const handleAssistantSubmit = (nextQuestion?: string) => {
    const content = (nextQuestion ?? assistantInput).trim();

    if (!content) {
      return;
    }

    const reply = buildAssistantReply(
      content,
      activeGroup,
      activeSummary?.title ?? "Resumo demonstrativo",
    );

    setAssistantInput(content);
    setAssistantAnswer(reply.answer);
    setAssistantSource(reply.source);
    setAssistantFeedback(null);
    setTeacherNotice(null);
  };

  const handleSendQuestionToTeacher = () => {
    if (!assistantInput.trim()) {
      return;
    }

    const created = createMockQuestion({
      groupSlug: activeGroup.slug,
      lessonId: activeGroup.nextLesson.id,
      authorName: progress.overview.studentName,
      question: assistantInput,
      visibility: "teacher",
    });

    setStudentQuestions((current) => [created, ...current]);
    setTeacherNotice(`Sua duvida foi enviada ao professor do grupo ${activeGroup.name}.`);
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

      <section className="student-page__groups-section page-section">
        <div className="group-grid">
          {groups.map((group) => {
            const isActive = group.slug === activeGroup.slug;

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
                    <dd>
                      {listMockMaterials({ groupSlug: group.slug, kind: "Leitura" })[0]?.title ??
                        "Leitura demonstrativa"}
                    </dd>
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
      </section>

      <section className="student-page__steps-section page-section">
        <h2>Como usar</h2>
        <div className="steps-grid">
          {studentSteps.map((step) => (
            <FlowStepCard key={step.step} step={step} />
          ))}
        </div>
      </section>

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
              <Button onClick={() => handleAssistantSubmit()}>Enviar</Button>
            </div>

            <AlertBox title="Resposta demonstrativa" tone="info">
              {assistantAnswer}
            </AlertBox>

            <p className="assistant-card__source">Fonte principal: {assistantSource}</p>

            <div className="button-row">
              <Button onClick={() => setAssistantFeedback("helpful")} variant="secondary">
                Foi util
              </Button>
              <Button onClick={() => setAssistantFeedback("not-helpful")} variant="ghost">
                Nao foi util
              </Button>
              <Button onClick={handleSendQuestionToTeacher} variant="secondary">
                Enviar duvida ao professor
              </Button>
            </div>

            {assistantFeedback ? (
              <p className="student-panel__note">
                Feedback registrado: {assistantFeedback === "helpful" ? "foi util" : "nao foi util"}.
              </p>
            ) : null}
            {teacherNotice ? <p className="student-panel__note">{teacherNotice}</p> : null}
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
              {studentHighlights.map((highlight) => (
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
    </div>
  );
};
