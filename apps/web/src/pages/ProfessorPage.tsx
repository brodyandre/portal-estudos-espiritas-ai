import { useEffect, useMemo, useState } from "react";

import { FlowStepCard } from "../components/display/FlowStepCard";
import { ActionTile } from "../components/ui/ActionTile";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextArea } from "../components/ui/TextArea";
import { TextInput } from "../components/ui/TextInput";
import {
  groups,
  listMockMaterials,
  listMockQuestions,
  listMockSummaries,
  type DemoFlowStep,
  type DemoGroup,
  type DemoQuestion,
} from "../data/demo";

type ReviewState = "draft" | "approved" | "published";
type PreviewKind = "outline" | "questions" | "summary";

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

const buildPreview = (group: DemoGroup, theme: string, meetLink: string): PreviewContent => {
  const cleanTheme = theme.trim() || group.nextLesson.title;
  const summarySource = listMockSummaries(group.slug)[0]?.content ?? "Resumo demonstrativo da semana.";

  return {
    outline: [
      `1. Acolhimento breve do grupo ${group.name}.`,
      `2. Retomar o tema "${cleanTheme}" com leitura curta.`,
      "3. Abrir espaco para duas perguntas simples.",
      "4. Fechar com um convite pratico para a semana.",
      `5. Confirmar o Google Meet: ${meetLink.trim() || group.meetUrl}.`,
    ].join("\n"),
    questions: [
      "1. Que atitude simples ajuda a manter o estudo vivo durante a semana?",
      "2. Como acolher melhor as duvidas dos participantes novos?",
      "3. O que cada pessoa pode levar como exercicio pratico para o proximo encontro?",
    ].join("\n"),
    summary: `Resumo inicial: ${summarySource}`,
  };
};

const getStorageKey = (groupSlug: DemoGroup["slug"]) => {
  return `portal-estudos:teacher-workspace:${groupSlug}`;
};

const createDefaultWorkspace = (group: DemoGroup): TeacherWorkspace => {
  return {
    selectedBook: group.bookTitle,
    themeChapter: defaultThemes[group.slug],
    meetLink: group.meetUrl,
    preview: buildPreview(group, defaultThemes[group.slug], group.meetUrl),
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

  const activeGroup = groups.find((group) => group.slug === groupSlug) ?? groups[0];
  const questions = useMemo(() => listMockQuestions({ groupSlug }), [groupSlug]);
  const materials = useMemo(() => listMockMaterials({ groupSlug }), [groupSlug]);
  const summaries = useMemo(() => listMockSummaries(groupSlug), [groupSlug]);

  useEffect(() => {
    const stored = readWorkspace(groupSlug);
    const nextWorkspace = stored ?? createDefaultWorkspace(activeGroup);

    setSelectedBook(nextWorkspace.selectedBook);
    setThemeChapter(nextWorkspace.themeChapter);
    setMeetLink(nextWorkspace.meetLink);
    setPreview(nextWorkspace.preview);
    setReviewState(nextWorkspace.reviewState);
    setActionMessage(nextWorkspace.actionMessage);
  }, [activeGroup, groupSlug]);

  const persistWorkspace = (nextWorkspace: TeacherWorkspace) => {
    setSelectedBook(nextWorkspace.selectedBook);
    setThemeChapter(nextWorkspace.themeChapter);
    setMeetLink(nextWorkspace.meetLink);
    setPreview(nextWorkspace.preview);
    setReviewState(nextWorkspace.reviewState);
    setActionMessage(nextWorkspace.actionMessage);
    writeWorkspace(groupSlug, nextWorkspace);
  };

  const handleGenerate = (kind: PreviewKind) => {
    const generated = buildPreview(activeGroup, themeChapter, meetLink);
    const nextPreview =
      kind === "outline"
        ? { ...preview, outline: generated.outline }
        : kind === "questions"
          ? { ...preview, questions: generated.questions }
          : { ...preview, summary: generated.summary };

    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      preview: nextPreview,
      reviewState: "draft",
      actionMessage: "Previa atualizada. Revise antes de aprovar e publicar.",
    });
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
      <div id="professor-inicio" />

      <section className="teacher-hero">
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
          <button className="teacher-icon-button" type="button">
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

      <section className="page-section">
        <div className="group-grid">
          {groups.map((group) => {
            const isActive = group.slug === groupSlug;

            return (
              <Card
                className={isActive ? "student-group-card student-group-card--active" : "student-group-card"}
                id={groupCardIds[group.slug]}
                key={group.slug}
                tone={isActive ? "brand" : "default"}
              >
                <div className="student-group-card__top">
                  <Badge tone="brand">{group.participantCount} participantes</Badge>
                  <StatusTag label={isActive ? "Grupo ativo" : undefined} tone="upcoming" />
                </div>

                <h2>{group.name}</h2>
                <p className="student-panel__note">{group.nextLesson.title}</p>
                <div className="button-row">
                  <Button onClick={() => setGroupSlug(group.slug)} variant={isActive ? "primary" : "secondary"}>
                    {isActive ? "Grupo selecionado" : "Escolher grupo"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
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

      <section className="page-section">
        <div className="two-column-grid">
          <Card tone="default">
            <div className="student-panel__header">
              <div>
                <p className="card-eyebrow">Preparar proxima aula</p>
                <h2>Grupo, tema e Meet</h2>
              </div>
              <StatusTag tone={reviewState === "published" ? "published" : reviewState === "approved" ? "active" : "draft"} />
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

            <div className="three-column-grid">
              <ActionTile
                actionLabel="Gerar"
                className="action-tile--compact"
                description="Monte um roteiro inicial curto."
                eyebrow="Acoes"
                title="Gerar roteiro"
                tone="soft"
              />
              <ActionTile
                actionLabel="Gerar"
                className="action-tile--compact"
                description="Liste perguntas simples para a aula."
                title="Criar perguntas"
                tone="soft"
              />
              <ActionTile
                actionLabel="Gerar"
                className="action-tile--compact"
                description="Prepare um resumo inicial demonstrativo."
                title="Gerar resumo"
                tone="soft"
              />
            </div>

            <div className="button-row">
              <Button onClick={() => handleGenerate("outline")}>Gerar roteiro</Button>
              <Button onClick={() => handleGenerate("questions")} variant="secondary">
                Criar perguntas
              </Button>
              <Button onClick={() => handleGenerate("summary")} variant="ghost">
                Gerar resumo
              </Button>
              <Button onClick={handlePublish} variant="secondary">
                Publicar
              </Button>
            </div>
          </Card>

          <Card id="professor-duvidas" tone="soft">
            <div className="student-panel__header">
              <h2>Duvidas recebidas</h2>
              <Badge tone="sand">{questions.length}</Badge>
            </div>
            <div className="page-stack">
              {questions.slice(0, 4).map((question) => {
                const status = getQuestionStatus(question.status);

                return (
                  <div key={question.id}>
                    <div className="student-panel__header">
                      <strong>{question.authorName}</strong>
                      <StatusTag label={status.label} tone={status.tone} />
                    </div>
                    <p className="student-panel__note">{question.question}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </section>

      <section className="page-section">
        <div className="two-column-grid">
          <Card id="professor-resumos" tone="default">
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

          <Card id="professor-configuracoes" tone="soft">
            <div className="student-panel__header">
              <h2>Aprovacao do professor</h2>
              <StatusTag
                tone={reviewState === "published" ? "published" : reviewState === "approved" ? "active" : "draft"}
              />
            </div>

            <p className="student-panel__note">{actionMessage}</p>
            <p className="student-panel__note">
              Materiais de apoio: {materials.length} itens cadastrados. Resumos disponiveis: {summaries.length}.
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
    </div>
  );
};
