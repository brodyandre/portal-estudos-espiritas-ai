import { useEffect, useMemo, useState } from "react";

import { FlowStepCard } from "../components/display/FlowStepCard";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextArea } from "../components/ui/TextArea";
import { TextInput } from "../components/ui/TextInput";
import type { DemoFlowStep, DemoGroup, DemoQuestion } from "../mocks";
import { collectServiceNotice } from "../services/api";
import {
  generateLessonPlanDraft,
  generateReflectionQuestionsDraft,
  generateSummaryDraft,
  type TeacherAssistInput,
} from "../services/agentService";
import { listMaterials } from "../services/materialsService";
import { listQuestions } from "../services/questionsService";
import { listStudies } from "../services/studiesService";
import { listSummaries } from "../services/summariesService";

type ReviewState = "draft" | "approved" | "published";
type PreviewKind = "outline" | "questions" | "summary";
type GenerationAction = PreviewKind | null;

interface PreviewContent {
  outline: string;
  questions: string;
  summary: string;
}

interface TeacherWorkspace {
  selectedBook: string;
  themeChapter: string;
  meetLink: string;
  preview: PreviewContent;
  reviewState: ReviewState;
  actionMessage: string;
}

const teacherSteps: DemoFlowStep[] = [
  {
    step: 1,
    title: "Escolhem o grupo e o tema da semana.",
    description: "Comecam pelo grupo ativo e alinham o foco principal do encontro.",
  },
  {
    step: 2,
    title: "Inserem o link do Google Meet.",
    description: "Registram o acesso para compartilhar no horario certo com a turma.",
  },
  {
    step: 3,
    title: "Pedem sugestoes de roteiro e perguntas.",
    description: "Criam um ponto de partida simples para ganhar tempo na preparacao.",
  },
  {
    step: 4,
    title: "Revisam e aprovam.",
    description: "Conferem o conteudo com calma antes de qualquer publicacao.",
  },
  {
    step: 5,
    title: "Publicam.",
    description: "Compartilham apenas o que estiver claro, fraterno e revisado.",
  },
];

const defaultThemes: Record<DemoGroup["slug"], string> = {
  emmanuel: "Constancia no estudo e presenca atenta",
  "a-caminho-da-luz": "Convivio fraterno e responsabilidade na aula",
};

const groupCardIds: Record<DemoGroup["slug"], string> = {
  emmanuel: "professor-grupo-emmanuel",
  "a-caminho-da-luz": "professor-grupo-a-caminho-da-luz",
};

const getStorageKey = (groupSlug: DemoGroup["slug"]) => {
  return `portal-estudos:teacher-workspace:${groupSlug}`;
};

const createDefaultWorkspace = (group: DemoGroup, summarySource: string): TeacherWorkspace => {
  return {
    selectedBook: group.bookTitle,
    themeChapter: defaultThemes[group.slug],
    meetLink: group.meetUrl,
    preview: {
      outline: "",
      questions: "",
      summary: summarySource ? `Resumo inicial: ${summarySource}` : "",
    },
    reviewState: "draft",
    actionMessage: "Escolha o grupo, ajuste o tema e gere uma previa para revisar com calma.",
  };
};

const readWorkspace = (groupSlug: DemoGroup["slug"]): TeacherWorkspace | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(groupSlug));
    return raw ? (JSON.parse(raw) as TeacherWorkspace) : null;
  } catch (_error) {
    return null;
  }
};

const writeWorkspace = (groupSlug: DemoGroup["slug"], workspace: TeacherWorkspace) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(groupSlug), JSON.stringify(workspace));
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
    <svg aria-hidden="true" className="teacher-icon-svg" viewBox="0 0 24 24">
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

export const ProfessorPage = () => {
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [questions, setQuestions] = useState<DemoQuestion[]>([]);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listMaterials>>["data"]>([]);
  const [summaries, setSummaries] = useState<Awaited<ReturnType<typeof listSummaries>>["data"]>([]);
  const [groupSlug, setGroupSlug] = useState<DemoGroup["slug"]>("emmanuel");
  const [selectedBook, setSelectedBook] = useState("");
  const [themeChapter, setThemeChapter] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [preview, setPreview] = useState<PreviewContent>({
    outline: "",
    questions: "",
    summary: "",
  });
  const [reviewState, setReviewState] = useState<ReviewState>("draft");
  const [actionMessage, setActionMessage] = useState(
    "Escolha o grupo, ajuste o tema e gere uma previa para revisar com calma.",
  );
  const [activeAction, setActiveAction] = useState<GenerationAction>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      setIsLoading(true);

      const [studiesResult, questionsResult, materialsResult, summariesResult] =
        await Promise.all([
          listStudies(),
          listQuestions(),
          listMaterials(),
          listSummaries(),
        ]);

      if (!isActive) {
        return;
      }

      setGroups(studiesResult.data);
      setQuestions(questionsResult.data);
      setMaterials(materialsResult.data);
      setSummaries(summariesResult.data);
      setNotice(
        collectServiceNotice([
          studiesResult,
          questionsResult,
          materialsResult,
          summariesResult,
        ]),
      );
      setGroupSlug((currentSlug) => {
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

  const activeGroup = groups.find((group) => group.slug === groupSlug) ?? groups[0] ?? null;
  const activeQuestions = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return questions.filter((question) => question.groupSlug === activeGroup.slug);
  }, [activeGroup, questions]);
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

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    const summarySource = activeSummary?.content ?? "Resumo demonstrativo da semana.";
    const stored = readWorkspace(activeGroup.slug);
    const nextWorkspace = stored ?? createDefaultWorkspace(activeGroup, summarySource);

    setSelectedBook(nextWorkspace.selectedBook);
    setThemeChapter(nextWorkspace.themeChapter);
    setMeetLink(nextWorkspace.meetLink);
    setPreview(nextWorkspace.preview);
    setReviewState(nextWorkspace.reviewState);
    setActionMessage(nextWorkspace.actionMessage);
  }, [activeGroup, activeSummary]);

  const persistWorkspace = (nextWorkspace: TeacherWorkspace) => {
    if (!activeGroup) {
      return;
    }

    setSelectedBook(nextWorkspace.selectedBook);
    setThemeChapter(nextWorkspace.themeChapter);
    setMeetLink(nextWorkspace.meetLink);
    setPreview(nextWorkspace.preview);
    setReviewState(nextWorkspace.reviewState);
    setActionMessage(nextWorkspace.actionMessage);
    writeWorkspace(activeGroup.slug, nextWorkspace);
  };

  const buildTeacherInput = (): TeacherAssistInput | null => {
    if (!activeGroup) {
      return null;
    }

    return {
      group: activeGroup,
      materials: activeMaterials,
      summary: activeSummary,
      theme: themeChapter.trim() || activeGroup.nextLesson.title,
      bookTitle: selectedBook.trim() || activeGroup.bookTitle,
      meetLink: meetLink.trim() || activeGroup.meetUrl,
    };
  };

  const handleGenerate = async (kind: PreviewKind) => {
    const teacherInput = buildTeacherInput();

    if (!teacherInput || activeAction) {
      return;
    }

    setActiveAction(kind);

    const result =
      kind === "outline"
        ? await generateLessonPlanDraft(teacherInput)
        : kind === "questions"
          ? await generateReflectionQuestionsDraft(teacherInput)
          : await generateSummaryDraft(teacherInput);

    const nextPreview =
      kind === "outline"
        ? { ...preview, outline: result.data.content }
        : kind === "questions"
          ? { ...preview, questions: result.data.content }
          : { ...preview, summary: result.data.content };

    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      preview: nextPreview,
      reviewState: "draft",
      actionMessage: result.notice ?? result.data.reviewNote,
    });
    setActiveAction(null);
  };

  const handleSaveDraft = () => {
    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      preview,
      reviewState: "draft",
      actionMessage: "Rascunho salvo localmente para continuar depois.",
    });
  };

  const handleApprove = () => {
    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      preview,
      reviewState: "approved",
      actionMessage: "Conteudo aprovado localmente. Ainda revise antes de publicar.",
    });
  };

  const handlePublish = () => {
    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      preview,
      reviewState: "published",
      actionMessage: "Publicacao simulada localmente. O professor continua responsavel pela revisao final.",
    });
  };

  return (
    <div className="teacher-page page-stack">
      <section className="teacher-hero" id="professor-inicio">
        <div>
          <Badge tone="sand">Area do professor</Badge>
          <h1>Portal dos Estudos Espiritas Online</h1>
          <p className="teacher-hero__subtitle">Painel do Professor</p>
          <p className="teacher-hero__description">
            Organize a proxima aula, gere um rascunho inicial e publique apenas depois da revisao
            humana.
          </p>
        </div>

        <div className="teacher-hero__actions">
          <button aria-label="Ver avisos do professor" className="teacher-icon-button" type="button">
            <BellIcon />
          </button>
          <div className="teacher-avatar-pill">
            <span aria-hidden="true" className="teacher-avatar-pill__icon">
              P
            </span>
            <span className="teacher-avatar-pill__label">Professor</span>
          </div>
        </div>
      </section>

      {notice ? (
        <AlertBox title="Modo demonstrativo ativo" tone="info">
          {notice}
        </AlertBox>
      ) : null}

      <section className="page-section">
        {isLoading ? (
          <LoadingState
            description="Estamos reunindo grupos, duvidas e materiais para montar o painel."
            title="Carregando painel do professor"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            description="Nenhum grupo foi encontrado para exibir agora."
            title="Sem grupos disponiveis"
          />
        ) : (
          <div className="group-grid">
            {groups.map((group) => {
              const isActive = group.slug === activeGroup?.slug;

              return (
                <Card
                  className={`teacher-group-card ${
                    isActive ? "teacher-group-card--active" : ""
                  }`}
                  id={groupCardIds[group.slug]}
                  key={group.slug}
                  tone={isActive ? "brand" : "default"}
                >
                  <div className="teacher-group-card__top">
                    <Badge tone="brand">{group.participantCount} participantes</Badge>
                    <StatusTag label={isActive ? "Grupo ativo" : undefined} tone="upcoming" />
                  </div>

                  <div className="teacher-group-card__body">
                    <h2>{group.name}</h2>
                    <p className="teacher-panel__note">{group.nextLesson.title}</p>
                  </div>
                  <div className="button-row">
                    <Button onClick={() => setGroupSlug(group.slug)} variant={isActive ? "primary" : "secondary"}>
                      {isActive ? "Grupo selecionado" : "Escolher grupo"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="page-section">
        <h2>Fluxo do professor</h2>
        <div className="steps-grid">
          {teacherSteps.map((step) => (
            <FlowStepCard key={step.step} step={step} />
          ))}
        </div>
      </section>

      <AlertBox title="Revise antes de publicar." tone="warning">
        O conteudo abaixo e apenas um ponto de partida demonstrativo. O professor sempre revisa,
        ajusta e aprova antes de compartilhar com a turma.
      </AlertBox>

      {isLoading || !activeGroup ? null : (
        <>
          <section className="page-section">
            <div className="two-column-grid">
              <Card
                aria-busy={activeAction !== null}
                className="teacher-panel"
                id="professor-preparar-aula"
                tone="default"
              >
                <div className="student-panel__header">
                  <div>
                    <p className="card-eyebrow">Preparar proxima aula</p>
                    <h2>Grupo, tema e Meet</h2>
                  </div>
                  <StatusTag
                    tone={
                      reviewState === "published"
                        ? "published"
                        : reviewState === "approved"
                          ? "active"
                          : "draft"
                    }
                  />
                </div>

                <Select
                  id="teacher-book"
                  label="Livro"
                  onChange={(event) => setSelectedBook(event.target.value)}
                  options={groups.map((group) => ({
                    label: group.bookTitle,
                    value: group.bookTitle,
                  }))}
                  value={selectedBook}
                />

                <TextInput
                  id="teacher-theme"
                  label="Tema ou capitulo"
                  onChange={(event) => setThemeChapter(event.target.value)}
                  value={themeChapter}
                />

                <TextInput
                  id="teacher-meet"
                  label="Link do Google Meet"
                  onChange={(event) => setMeetLink(event.target.value)}
                  value={meetLink}
                />

                <div className="button-row">
                  <Button onClick={() => void handleGenerate("outline")}>
                    {activeAction === "outline" ? "Gerando..." : "Gerar roteiro"}
                  </Button>
                  <Button onClick={() => void handleGenerate("questions")} variant="secondary">
                    {activeAction === "questions" ? "Gerando..." : "Criar perguntas"}
                  </Button>
                  <Button onClick={() => void handleGenerate("summary")} variant="ghost">
                    {activeAction === "summary" ? "Gerando..." : "Gerar resumo"}
                  </Button>
                  <Button onClick={handlePublish} variant="secondary">
                    Publicar
                  </Button>
                </div>
              </Card>

              <Card className="teacher-panel" id="professor-duvidas" tone="soft">
                <div className="student-panel__header">
                  <h2>Duvidas recebidas</h2>
                  <Badge tone="sand">{activeQuestions.length}</Badge>
                </div>
                <div className="stack-list">
                  {activeQuestions.slice(0, 4).map((question) => {
                    const status = getQuestionStatus(question.status);

                    return (
                      <article className="stack-list__item" key={question.id}>
                        <div className="student-panel__header">
                          <strong>{question.authorName}</strong>
                          <StatusTag label={status.label} tone={status.tone} />
                        </div>
                        <p className="student-panel__note">{question.question}</p>
                      </article>
                    );
                  })}
                </div>
              </Card>
            </div>
          </section>

          <section className="page-section">
            <div className="two-column-grid">
              <Card className="teacher-panel" id="professor-resumos" tone="default">
                <div className="student-panel__header">
                  <h2>Previa do conteudo</h2>
                  <Badge tone="sand">Editavel</Badge>
                </div>

                <TextArea
                  id="preview-outline"
                  label="Roteiro"
                  onChange={(event) =>
                    setPreview((current) => ({
                      ...current,
                      outline: event.target.value,
                    }))
                  }
                  rows={7}
                  value={preview.outline}
                />

                <TextArea
                  id="preview-questions"
                  label="Perguntas"
                  onChange={(event) =>
                    setPreview((current) => ({
                      ...current,
                      questions: event.target.value,
                    }))
                  }
                  rows={6}
                  value={preview.questions}
                />

                <TextArea
                  id="preview-summary"
                  label="Resumo"
                  onChange={(event) =>
                    setPreview((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  rows={6}
                  value={preview.summary}
                />
              </Card>

              <Card className="teacher-panel" id="professor-configuracoes" tone="soft">
                <div className="student-panel__header">
                  <h2>Aprovacao do professor</h2>
                  <StatusTag
                    tone={
                      reviewState === "published"
                        ? "published"
                        : reviewState === "approved"
                          ? "active"
                          : "draft"
                    }
                  />
                </div>

                <p aria-live="polite" className="student-panel__note">
                  {actionMessage}
                </p>
                <p className="student-panel__note">
                  Materiais de apoio: {activeMaterials.length} itens cadastrados. Resumos disponiveis:{" "}
                  {activeSummary ? 1 : 0}.
                </p>

                <div className="button-row teacher-approval-actions">
                  <Button onClick={handleSaveDraft} variant="ghost">
                    Salvar rascunho
                  </Button>
                  <Button onClick={handleApprove} variant="secondary">
                    Aprovar
                  </Button>
                  <Button onClick={handlePublish}>Publicar</Button>
                </div>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
