import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FlowStepCard } from "../components/display/FlowStepCard";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { SectionTitle } from "../components/ui/SectionTitle";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextArea } from "../components/ui/TextArea";
import { TextInput } from "../components/ui/TextInput";
import type { DemoFlowStep, DemoGroup, DemoQuestion } from "../mocks";
import type {
  Enrollment,
  EnrollmentGroupInterest,
  EnrollmentStatus,
  StudentAccessInfo,
} from "../types/enrollment";
import { collectServiceNotice } from "../services/api";
import {
  generateGroupMessageDraft,
  generateLessonPlanDraft,
  generateReflectionQuestionsDraft,
  generateReviewPointsDraft,
  generateSummaryDraft,
  type TeacherAssistInput,
} from "../services/agentService";
import {
  listKnowledgeFilesByGroup,
  type KnowledgeSupportFile,
} from "../services/knowledgeService";
import {
  listEnrollments,
  updateEnrollmentStatus,
} from "../services/enrollmentsService";
import { listMaterials } from "../services/materialsService";
import { listQuestions } from "../services/questionsService";
import { syncStudentAccessFromEnrollmentStatus } from "../services/studentAccessService";
import { listStudies } from "../services/studiesService";
import { listSummaries } from "../services/summariesService";
import {
  buildEnrollmentMessage,
  buildLoginUrl,
  buildPortalUrl,
  getEnrollmentMessageStatus,
} from "../utils/enrollmentMessages";
import { buildWhatsAppUrl, getWhatsAppPhoneLabel } from "../utils/whatsapp";
import { DEMO_MODE_NOTICE, PUBLIC_MEET_NOTICE, appConfig } from "../config/appMode";

type ReviewState = "draft" | "approved" | "published";
type PreviewKind = "outline" | "questions" | "summary" | "message" | "review";
type GenerationAction = PreviewKind | null;

interface PreviewContent {
  outline: string;
  questions: string;
  summary: string;
  message: string;
  review: string;
}

interface TeacherWorkspace {
  selectedBook: string;
  themeChapter: string;
  meetLink: string;
  selectedSupportFileIds: string[];
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

const teacherSupportSectionIds = {
  support: "professor-base-apoio",
  enrollments: "professor-interessados",
  questions: "professor-duvidas",
  preview: "professor-resumos",
  approval: "professor-configuracoes",
} as const;

const enrollmentStatusOptions: Array<{ label: string; value: EnrollmentStatus | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Pendentes", value: "pending" },
  { label: "Aprovados", value: "approved" },
  { label: "Marcar para conversar", value: "needs_contact" },
  { label: "Recusados", value: "rejected" },
];

const enrollmentGroupOptions: Array<{
  label: string;
  value: EnrollmentGroupInterest | "all";
}> = [
  { label: "Todos os grupos", value: "all" },
  { label: "Emmanuel", value: "Emmanuel" },
  { label: "A Caminho da Luz", value: "A Caminho da Luz" },
  { label: "Ainda não sei", value: "Ainda não sei" },
];

const enrollmentStatusPriority: Record<EnrollmentStatus, number> = {
  pending: 0,
  needs_contact: 1,
  approved: 2,
  rejected: 3,
};

const sensitiveTopicRules = [
  {
    label: "sofrimento",
    terms: ["sofrimento", "dor", "luto", "desanimo"],
  },
  {
    label: "mediunidade",
    terms: ["mediunidade", "mediunico"],
  },
  {
    label: "reencarnacao",
    terms: ["reencarnacao", "reencarnar"],
  },
  {
    label: "instituicoes religiosas",
    terms: ["instituicoes religiosas", "igreja", "religioes", "religiosa"],
  },
  {
    label: "Capela",
    terms: ["capela"],
  },
  {
    label: "racas adamicas",
    terms: ["racas adamicas", "racas adamic", "adamic"],
  },
  {
    label: "guerras",
    terms: ["guerra", "guerras", "conflitos historicos"],
  },
  {
    label: "futuro",
    terms: ["futuro", "humanidade"],
  },
  {
    label: "conflitos pessoais",
    terms: ["conflitos pessoais", "conflito familiar", "familia", "relacao dificil"],
  },
] as const;

const getStorageKey = (groupSlug: DemoGroup["slug"]) => {
  return `portal-estudos:teacher-workspace:${groupSlug}`;
};

const normalizeText = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
};

const uniqueStrings = (items: string[]) => {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
};

const createDefaultWorkspace = (
  group: DemoGroup,
  summarySource: string,
  supportFiles: KnowledgeSupportFile[],
): TeacherWorkspace => {
  return {
    selectedBook: group.name,
    themeChapter: defaultThemes[group.slug],
    meetLink: group.meetUrl,
    selectedSupportFileIds: supportFiles.slice(0, 2).map((file) => file.id),
    preview: {
      outline: "",
      questions: "",
      summary: summarySource ? `Resumo inicial: ${summarySource}` : "",
      message: "",
      review: "",
    },
    reviewState: "draft",
    actionMessage: "Escolha o grupo, selecione a base de apoio e gere uma previa para revisar com calma.",
  };
};

const readWorkspace = (groupSlug: DemoGroup["slug"]): Partial<TeacherWorkspace> | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(groupSlug));
    return raw ? (JSON.parse(raw) as Partial<TeacherWorkspace>) : null;
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

const getEnrollmentStatusLabel = (status: EnrollmentStatus) => {
  if (status === "approved") {
    return { label: "Aprovado", tone: "published" as const };
  }

  if (status === "needs_contact") {
    return { label: "Conversar", tone: "attention" as const };
  }

  if (status === "rejected") {
    return { label: "Recusado", tone: "draft" as const };
  }

  return { label: "Pendente", tone: "upcoming" as const };
};

const mergeWorkspace = (
  defaultWorkspace: TeacherWorkspace,
  storedWorkspace: Partial<TeacherWorkspace> | null,
  supportFiles: KnowledgeSupportFile[],
): TeacherWorkspace => {
  if (!storedWorkspace) {
    return defaultWorkspace;
  }

  const allowedSupportIds = new Set(supportFiles.map((file) => file.id));
  const selectedSupportFileIds = (storedWorkspace.selectedSupportFileIds ?? []).filter((id) =>
    allowedSupportIds.has(id),
  );

  return {
    ...defaultWorkspace,
    ...storedWorkspace,
    selectedSupportFileIds:
      selectedSupportFileIds.length > 0
        ? selectedSupportFileIds
        : defaultWorkspace.selectedSupportFileIds,
    preview: {
      ...defaultWorkspace.preview,
      ...(storedWorkspace.preview ?? {}),
    },
  };
};

const detectSensitiveTopics = (
  themeChapter: string,
  supportFiles: KnowledgeSupportFile[],
) => {
  const themeText = normalizeText(themeChapter);
  const metadataTopics = supportFiles.flatMap((file) => file.sensitiveTopics);
  const ruleTopics = sensitiveTopicRules
    .filter((rule) => rule.terms.some((term) => themeText.includes(normalizeText(term))))
    .map((rule) => rule.label);

  return uniqueStrings([...metadataTopics, ...ruleTopics]);
};

const buildSensitiveGuidance = (topics: string[]) => {
  if (topics.length === 0) {
    return "Nenhum ponto sensivel foi destacado nesta selecao. Ainda assim, vale revisar a linguagem final com calma.";
  }

  return `Temas que pedem atencao nesta aula: ${topics.join(", ")}.`;
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
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [questions, setQuestions] = useState<DemoQuestion[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listMaterials>>["data"]>([]);
  const [summaries, setSummaries] = useState<Awaited<ReturnType<typeof listSummaries>>["data"]>([]);
  const [supportFiles, setSupportFiles] = useState<KnowledgeSupportFile[]>([]);
  const [groupSlug, setGroupSlug] = useState<DemoGroup["slug"]>("emmanuel");
  const [selectedBook, setSelectedBook] = useState("");
  const [themeChapter, setThemeChapter] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [selectedSupportFileIds, setSelectedSupportFileIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewContent>({
    outline: "",
    questions: "",
    summary: "",
    message: "",
    review: "",
  });
  const [reviewState, setReviewState] = useState<ReviewState>("draft");
  const [actionMessage, setActionMessage] = useState(
    "Escolha o grupo, selecione a base de apoio e gere uma previa para revisar com calma.",
  );
  const [activeAction, setActiveAction] = useState<GenerationAction>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<EnrollmentStatus | "all">("all");
  const [enrollmentGroupFilter, setEnrollmentGroupFilter] = useState<EnrollmentGroupInterest | "all">("all");
  const [teacherNotes, setTeacherNotes] = useState<Record<string, string>>({});
  const [messageOverrides, setMessageOverrides] = useState<Record<string, string>>({});
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | null>(null);
  const [enrollmentNotice, setEnrollmentNotice] = useState<string | null>(null);
  const [communicationNotice, setCommunicationNotice] = useState<string | null>(null);
  const [studentAccessByEnrollment, setStudentAccessByEnrollment] = useState<
    Record<string, StudentAccessInfo>
  >({});

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      setIsLoading(true);

      const [
        enrollmentsResult,
        studiesResult,
        questionsResult,
        materialsResult,
        summariesResult,
        emmanuelKnowledgeResult,
        caminhoKnowledgeResult,
      ] = await Promise.all([
        listEnrollments(),
        listStudies(),
        listQuestions(),
        listMaterials(),
        listSummaries(),
        listKnowledgeFilesByGroup("emmanuel"),
        listKnowledgeFilesByGroup("a-caminho-da-luz"),
      ]);

      if (!isActive) {
        return;
      }

      setEnrollments(enrollmentsResult.data);
      setGroups(studiesResult.data);
      setQuestions(questionsResult.data);
      setMaterials(materialsResult.data);
      setSummaries(summariesResult.data);
      setSupportFiles([
        ...emmanuelKnowledgeResult.data,
        ...caminhoKnowledgeResult.data,
      ]);
      setNotice(
        collectServiceNotice([
          enrollmentsResult,
          studiesResult,
          questionsResult,
          materialsResult,
          summariesResult,
          emmanuelKnowledgeResult,
          caminhoKnowledgeResult,
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
  const activeSupportFiles = useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return supportFiles.filter((file) => file.groupSlug === activeGroup.slug);
  }, [activeGroup, supportFiles]);
  const selectedSupportFiles = useMemo(() => {
    const selectedIds = new Set(selectedSupportFileIds);
    return activeSupportFiles.filter((file) => selectedIds.has(file.id));
  }, [activeSupportFiles, selectedSupportFileIds]);
  const sensitiveTopics = useMemo(() => {
    return detectSensitiveTopics(themeChapter, selectedSupportFiles);
  }, [selectedSupportFiles, themeChapter]);
  const filteredEnrollments = useMemo(() => {
    return [...enrollments]
      .filter((enrollment) => {
        if (enrollmentStatusFilter !== "all" && enrollment.status !== enrollmentStatusFilter) {
          return false;
        }

        if (enrollmentGroupFilter !== "all" && enrollment.groupInterest !== enrollmentGroupFilter) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const statusDifference =
          enrollmentStatusPriority[left.status] - enrollmentStatusPriority[right.status];

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [enrollments, enrollmentGroupFilter, enrollmentStatusFilter]);
  const pendingEnrollments = useMemo(() => {
    return enrollments.filter((enrollment) => enrollment.status === "pending");
  }, [enrollments]);
  const pendingEnrollmentCounts = useMemo(() => {
    return {
      total: pendingEnrollments.length,
      emmanuel: pendingEnrollments.filter((enrollment) => enrollment.groupInterest === "Emmanuel")
        .length,
      caminho: pendingEnrollments.filter(
        (enrollment) => enrollment.groupInterest === "A Caminho da Luz",
      ).length,
      undecided: pendingEnrollments.filter(
        (enrollment) => enrollment.groupInterest === "Ainda não sei",
      ).length,
    };
  }, [pendingEnrollments]);
  const requestedGroupSlug = searchParams.get("grupo");
  const portalUrl = buildPortalUrl(
    typeof window === "undefined"
      ? undefined
      : {
          origin: window.location.origin,
          pathname: window.location.pathname,
        },
  );

  const copyText = async (value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === "undefined") {
      throw new Error("clipboard-unavailable");
    }

    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "true");
    textArea.style.position = "absolute";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  };

  const handleCopyEnrollmentMessage = async (fullName: string, message: string) => {
    try {
      await copyText(message);
      setCommunicationNotice(`Mensagem pronta copiada para ${fullName}.`);
    } catch (_error) {
      setCommunicationNotice("Nao foi possivel copiar a mensagem agora.");
    }
  };

  const handleCopyEnrollmentEmail = async (fullName: string, email: string) => {
    try {
      await copyText(email);
      setCommunicationNotice(`E-mail copiado para contato com ${fullName}.`);
    } catch (_error) {
      setCommunicationNotice("Nao foi possivel copiar o e-mail agora.");
    }
  };

  const handleOpenWhatsApp = (phone: string, message: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const whatsappUrl = buildWhatsAppUrl(phone, message);
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setCommunicationNotice("WhatsApp aberto com a mensagem pronta para revisao e envio manual.");
  };

  useEffect(() => {
    if (!requestedGroupSlug) {
      return;
    }

    const normalizedRequestedGroup = requestedGroupSlug.trim().toLowerCase();

    if (
      normalizedRequestedGroup === "emmanuel" ||
      normalizedRequestedGroup === "a-caminho-da-luz"
    ) {
      setGroupSlug(normalizedRequestedGroup as DemoGroup["slug"]);
    }
  }, [requestedGroupSlug]);

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    const summarySource = activeSummary?.content ?? "Resumo demonstrativo da semana.";
    const defaultWorkspace = createDefaultWorkspace(activeGroup, summarySource, activeSupportFiles);
    const storedWorkspace = readWorkspace(activeGroup.slug);
    const nextWorkspace = mergeWorkspace(defaultWorkspace, storedWorkspace, activeSupportFiles);

    setSelectedBook(nextWorkspace.selectedBook);
    setThemeChapter(nextWorkspace.themeChapter);
    setMeetLink(nextWorkspace.meetLink);
    setSelectedSupportFileIds(nextWorkspace.selectedSupportFileIds);
    setPreview(nextWorkspace.preview);
    setReviewState(nextWorkspace.reviewState);
    setActionMessage(nextWorkspace.actionMessage);
  }, [activeGroup, activeSummary, activeSupportFiles]);

  const persistWorkspace = (nextWorkspace: TeacherWorkspace) => {
    if (!activeGroup) {
      return;
    }

    setSelectedBook(nextWorkspace.selectedBook);
    setThemeChapter(nextWorkspace.themeChapter);
    setMeetLink(nextWorkspace.meetLink);
    setSelectedSupportFileIds(nextWorkspace.selectedSupportFileIds);
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
      supportFiles: selectedSupportFiles,
      theme: themeChapter.trim() || activeGroup.nextLesson.title,
      bookTitle: selectedBook.trim() || activeGroup.name,
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
          : kind === "summary"
            ? await generateSummaryDraft(teacherInput)
            : kind === "message"
              ? await generateGroupMessageDraft(teacherInput)
              : await generateReviewPointsDraft(teacherInput);

    const nextPreview =
      kind === "outline"
        ? { ...preview, outline: result.data.content }
        : kind === "questions"
          ? { ...preview, questions: result.data.content }
          : kind === "summary"
            ? { ...preview, summary: result.data.content }
            : kind === "message"
              ? { ...preview, message: result.data.content }
              : { ...preview, review: result.data.content };

    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      selectedSupportFileIds,
      preview: nextPreview,
      reviewState: "draft",
      actionMessage: result.notice ?? result.data.reviewNote,
    });
    setActiveAction(null);
  };

  const handleToggleSupportFile = (fileId: string) => {
    const nextSelectedIds = selectedSupportFileIds.includes(fileId)
      ? selectedSupportFileIds.filter((currentId) => currentId !== fileId)
      : [...selectedSupportFileIds, fileId];

    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      selectedSupportFileIds: nextSelectedIds,
      preview,
      reviewState,
      actionMessage:
        nextSelectedIds.length > 0
          ? "Base de apoio atualizada. Agora voce pode gerar uma previa com os arquivos escolhidos."
          : "Nenhum arquivo de apoio selecionado. Se desejar, escolha pelo menos um material para orientar a aula.",
    });
  };

  const handleEdit = () => {
    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      selectedSupportFileIds,
      preview,
      reviewState: "draft",
      actionMessage: "Edicao liberada localmente. Ajuste o texto antes de aprovar.",
    });
  };

  const handleSaveDraft = () => {
    persistWorkspace({
      selectedBook,
      themeChapter,
      meetLink,
      selectedSupportFileIds,
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
      selectedSupportFileIds,
      preview,
      reviewState: "approved",
      actionMessage: "Conteudo aprovado localmente. O professor deve revisar antes de publicar.",
    });
  };

  const handleEnrollmentStatusUpdate = async (
    enrollmentId: string,
    status: Extract<EnrollmentStatus, "approved" | "rejected" | "needs_contact">,
  ) => {
    if (activeEnrollmentId) {
      return;
    }

    setActiveEnrollmentId(enrollmentId);

    const result = await updateEnrollmentStatus(enrollmentId, {
      status,
      teacherNote: teacherNotes[enrollmentId] ?? "",
    });

    if (result.data) {
      setEnrollments((current) =>
        current.map((item) => (item.id === enrollmentId ? result.data!.enrollment : item)),
      );
      syncStudentAccessFromEnrollmentStatus(result.data.enrollment.status);

      if (result.data.studentAccess) {
        setStudentAccessByEnrollment((current) => ({
          ...current,
          [enrollmentId]: result.data!.studentAccess!,
        }));

        const updatedEnrollment = result.data.enrollment;
        const loginUrl = buildLoginUrl(window.location);
        setMessageOverrides((current) => ({
          ...current,
          [enrollmentId]: buildEnrollmentMessage({
            enrollment: updatedEnrollment,
            studentAccess: result.data!.studentAccess,
            portalUrl: loginUrl,
            status: "approved",
          }),
        }));
      }
    }

    setEnrollmentNotice(result.notice);
    setActiveEnrollmentId(null);
  };

  return (
    <div className="teacher-page page-stack">
      <section className="teacher-hero" id="professor-inicio">
        <div>
          <Badge tone="sand">Área do professor</Badge>
          <h1>Educação Continuada</h1>
          <p className="teacher-hero__subtitle">Painel do Professor</p>
          <p className="teacher-hero__description">
            Organize a próxima aula, escolha materiais de apoio e revise cada texto antes de
            compartilhar com a turma.
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

      {appConfig.appMode === "demo" ? (
        <AlertBox title="Versão pública" tone="warning">
          {DEMO_MODE_NOTICE} {PUBLIC_MEET_NOTICE}
        </AlertBox>
      ) : null}

      <section className="page-section">
        <SectionTitle
          action={
            <Select
              id="teacher-group-select"
              label="Grupo ou livro"
              onChange={(event) => setGroupSlug(event.target.value as DemoGroup["slug"])}
              options={groups.map((group) => ({
                label: group.name,
                value: group.slug,
              }))}
              value={groupSlug}
            />
          }
          description="Escolha o grupo para trocar rapidamente a base de apoio, o tema da semana e a prévia da aula."
          title="Escolha o grupo ou livro"
        />

        {isLoading ? (
          <LoadingState
            description="Estamos reunindo grupos, dúvidas e materiais para montar o painel."
            title="Carregando painel do professor"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            description="Nenhum grupo foi encontrado para exibir agora."
            title="Sem grupos disponíveis"
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

                  <dl className="teacher-group-card__meta">
                    <div>
                      <dt>Encontro</dt>
                      <dd>
                        {group.meetingDay}, {group.meetingTime}
                      </dd>
                    </div>
                    <div>
                      <dt>Livro</dt>
                      <dd>{group.name}</dd>
                    </div>
                  </dl>

                  <div className="button-row">
                    <Button
                      onClick={() => setGroupSlug(group.slug)}
                      variant={isActive ? "primary" : "secondary"}
                    >
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
        O conteúdo abaixo é apenas um ponto de partida demonstrativo. O professor sempre revisa,
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
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Preparar próxima aula</p>
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
                  label="Grupo ou livro"
                  onChange={(event) => {
                    const nextSlug = event.target.value as DemoGroup["slug"];
                    setGroupSlug(nextSlug);
                    const nextGroup = groups.find((group) => group.slug === nextSlug);
                    if (nextGroup) {
                      setSelectedBook(nextGroup.name);
                    }
                  }}
                  options={groups.map((group) => ({
                    label: group.name,
                    value: group.slug,
                  }))}
                  value={activeGroup.slug}
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
                  <Button to={`/materiais/${activeGroup.slug}`} variant="secondary">
                    Abrir materiais do livro
                  </Button>
                </div>
              </Card>

              <Card className="teacher-panel" id={teacherSupportSectionIds.support} tone="soft">
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Base de apoio da aula</p>
                    <h2>Materiais do grupo selecionado</h2>
                  </div>
                  <div className="button-row">
                    <Badge tone="sand">{activeSupportFiles.length} arquivos</Badge>
                    <Button size="compact" to={`/materiais/${activeGroup.slug}`} variant="secondary">
                      Ver pagina do livro
                    </Button>
                  </div>
                </div>

                {activeSupportFiles.length > 0 ? (
                  <div className="teacher-support-list">
                    {activeSupportFiles.map((file) => {
                      const isSelected = selectedSupportFileIds.includes(file.id);

                      return (
                        <label
                          className={`teacher-support-item ${
                            isSelected ? "teacher-support-item--selected" : ""
                          }`}
                          htmlFor={`support-file-${file.id}`}
                          key={file.id}
                        >
                          <div className="teacher-support-item__select">
                            <input
                              checked={isSelected}
                              id={`support-file-${file.id}`}
                              onChange={() => handleToggleSupportFile(file.id)}
                              type="checkbox"
                            />
                            <div className="teacher-support-item__content">
                              <div className="teacher-support-item__header">
                                <strong>{file.title}</strong>
                                <Badge tone="sand">{file.typeLabel}</Badge>
                              </div>
                              <p className="teacher-panel__note">{file.summary}</p>
                            </div>
                          </div>

                          <div className="teacher-support-item__tags" aria-label="Tags do material">
                            {file.tags.slice(0, 5).map((tag) => (
                              <Badge key={`${file.id}-${tag}`} tone="neutral">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {file.sensitiveTopics.length > 0 ? (
                            <div className="teacher-support-item__topics">
                              <span className="teacher-support-item__topics-label">
                                Temas sensiveis:
                              </span>
                              <div className="teacher-support-item__tags">
                                {file.sensitiveTopics.map((topic) => (
                                  <Badge key={`${file.id}-${topic}`} tone="sand">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    description="Ainda nao encontramos materiais curtos para este grupo."
                    title="Sem base de apoio"
                  />
                )}
              </Card>
            </div>
          </section>

          <section className="page-section">
            <div className="two-column-grid">
              <Card className="teacher-panel" tone="default">
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Gerar apoio para aula</p>
                    <h2>Acoes de preparacao</h2>
                  </div>
                  <Badge tone="sand">
                    {selectedSupportFiles.length > 0
                      ? `${selectedSupportFiles.length} arquivos selecionados`
                      : "Selecione arquivos de apoio"}
                  </Badge>
                </div>

                <div className="teacher-action-grid">
                  <Button onClick={() => void handleGenerate("outline")}>
                    {activeAction === "outline" ? "Gerando..." : "Gerar roteiro da aula"}
                  </Button>
                  <Button onClick={() => void handleGenerate("questions")} variant="secondary">
                    {activeAction === "questions" ? "Gerando..." : "Gerar perguntas de reflexao"}
                  </Button>
                  <Button onClick={() => void handleGenerate("summary")} variant="secondary">
                    {activeAction === "summary" ? "Gerando..." : "Gerar resumo para participantes"}
                  </Button>
                  <Button onClick={() => void handleGenerate("message")} variant="secondary">
                    {activeAction === "message" ? "Gerando..." : "Gerar mensagem para o grupo"}
                  </Button>
                  <Button onClick={() => void handleGenerate("review")} variant="ghost">
                    {activeAction === "review" ? "Gerando..." : "Listar pontos que exigem revisão"}
                  </Button>
                </div>

                <div className="teacher-action-note">
                  <p>
                    Os textos podem ser simulados localmente quando o servidor não estiver
                    disponível.
                  </p>
                </div>
              </Card>

              <Card className="teacher-panel" tone="soft">
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Pontos sensiveis</p>
                    <h2>Temas que pedem cuidado</h2>
                  </div>
                  <Badge tone="sand">{sensitiveTopics.length}</Badge>
                </div>

                <AlertBox title="Revisao do professor" tone="warning">
                  O professor deve revisar antes de publicar.
                </AlertBox>

                <p className="teacher-panel__note">{buildSensitiveGuidance(sensitiveTopics)}</p>

                {sensitiveTopics.length > 0 ? (
                  <div className="teacher-sensitive-list">
                    {sensitiveTopics.map((topic) => (
                      <Badge key={topic} tone="sand">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>
          </section>

          <section className="page-section">
            <div className="two-column-grid">
              <Card className="teacher-panel" id={teacherSupportSectionIds.enrollments} tone="default">
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Novos interessados</p>
                    <h2>Cadastros para revisar</h2>
                  </div>
                  <Badge tone={pendingEnrollmentCounts.total > 0 ? "success" : "sand"}>
                    {pendingEnrollmentCounts.total > 0
                      ? `${pendingEnrollmentCounts.total} pendentes`
                      : `${filteredEnrollments.length} registros`}
                  </Badge>
                </div>

                <div className="teacher-enrollment-summary" role="status">
                  <div className="teacher-enrollment-summary__lead">
                    <p className="teacher-enrollment-summary__eyebrow">Resumo rapido</p>
                    <strong>{pendingEnrollmentCounts.total}</strong>
                    <span>solicitações aguardando revisão</span>
                  </div>

                  <div className="teacher-enrollment-summary__grid">
                    <div className="teacher-enrollment-summary__item">
                      <span className="teacher-enrollment-summary__label">Emmanuel</span>
                      <strong>{pendingEnrollmentCounts.emmanuel}</strong>
                    </div>
                    <div className="teacher-enrollment-summary__item">
                      <span className="teacher-enrollment-summary__label">A Caminho da Luz</span>
                      <strong>{pendingEnrollmentCounts.caminho}</strong>
                    </div>
                    <div className="teacher-enrollment-summary__item">
                      <span className="teacher-enrollment-summary__label">Ainda não sei</span>
                      <strong>{pendingEnrollmentCounts.undecided}</strong>
                    </div>
                  </div>
                </div>

                {pendingEnrollmentCounts.total > 0 ? (
                  <AlertBox title="Novas solicitacoes" tone="info">
                    Há novas solicitações aguardando revisão.
                  </AlertBox>
                ) : null}

                <AlertBox title="Revisao do acesso" tone="warning">
                  A aprovação libera o acesso à área do aluno e ao link da aula.
                </AlertBox>

                {enrollmentNotice ? (
                  <AlertBox title="Modo demonstrativo ativo" tone="info">
                    {enrollmentNotice}
                  </AlertBox>
                ) : null}

                {communicationNotice ? (
                  <AlertBox title="Comunicacao manual" tone="info">
                    {communicationNotice}
                  </AlertBox>
                ) : null}

                <div className="teacher-enrollment-filters">
                  <Select
                    id="teacher-enrollment-status-filter"
                    label="Filtrar por status"
                    onChange={(event) =>
                      setEnrollmentStatusFilter(event.target.value as EnrollmentStatus | "all")
                    }
                    options={enrollmentStatusOptions.map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    value={enrollmentStatusFilter}
                  />

                  <Select
                    id="teacher-enrollment-group-filter"
                    label="Filtrar por grupo"
                    onChange={(event) =>
                      setEnrollmentGroupFilter(
                        event.target.value as EnrollmentGroupInterest | "all",
                      )
                    }
                    options={enrollmentGroupOptions.map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    value={enrollmentGroupFilter}
                  />
                </div>

                {filteredEnrollments.length > 0 ? (
                  <div className="teacher-enrollment-list">
                    {filteredEnrollments.map((enrollment) => {
                      const enrollmentStatus = getEnrollmentStatusLabel(enrollment.status);
                      const teacherNote = teacherNotes[enrollment.id] ?? enrollment.teacherNote;
                      const messageStatus = getEnrollmentMessageStatus(enrollment.status);
                      const defaultMessage = buildEnrollmentMessage({
                        enrollment,
                        studentAccess: studentAccessByEnrollment[enrollment.id] ?? null,
                        portalUrl,
                        status: messageStatus,
                      });
                      const messageDraft = messageOverrides[enrollment.id] ?? defaultMessage;
                      const isUpdating = activeEnrollmentId === enrollment.id;
                      const studentAccess = studentAccessByEnrollment[enrollment.id] ?? null;
                      const cardClassName = [
                        "teacher-enrollment-item",
                        enrollment.status === "pending"
                          ? "teacher-enrollment-item--pending"
                          : enrollment.status === "needs_contact"
                            ? "teacher-enrollment-item--needs-contact"
                            : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <article className={cardClassName} key={enrollment.id}>
                          <div className="teacher-panel__header">
                            <div>
                              <strong>{enrollment.fullName}</strong>
                              <p className="teacher-panel__note">{enrollment.groupInterest}</p>
                            </div>
                            <StatusTag label={enrollmentStatus.label} tone={enrollmentStatus.tone} />
                          </div>

                          <dl className="teacher-enrollment-meta">
                            <div>
                              <dt>E-mail</dt>
                              <dd>{enrollment.email}</dd>
                            </div>
                            <div>
                              <dt>WhatsApp</dt>
                              <dd>{enrollment.whatsapp}</dd>
                            </div>
                            <div>
                              <dt>Ja participa</dt>
                              <dd>{enrollment.alreadyParticipates}</dd>
                            </div>
                            <div>
                              <dt>Data do cadastro</dt>
                              <dd>{new Date(enrollment.createdAt).toLocaleDateString("pt-BR")}</dd>
                            </div>
                          </dl>

                          <p className="teacher-panel__note">
                            {enrollment.message || "Sem mensagem adicional."}
                          </p>

                          <TextArea
                            helperText="Revise o texto com calma. No MVP, o envio pelo WhatsApp e manual."
                            id={`teacher-message-${enrollment.id}`}
                            label="Mensagem pronta para revisar"
                            onChange={(event) =>
                              setMessageOverrides((current) => ({
                                ...current,
                                [enrollment.id]: event.target.value,
                              }))
                            }
                            rows={5}
                            value={messageDraft}
                          />

                          <TextArea
                            id={`teacher-note-${enrollment.id}`}
                            label="Observacao do professor"
                            onChange={(event) =>
                              setTeacherNotes((current) => ({
                                ...current,
                                [enrollment.id]: event.target.value,
                              }))
                            }
                            rows={4}
                            value={teacherNote}
                          />

                          <div className="button-row">
                            <Button
                              aria-label={`Copiar mensagem pronta para ${enrollment.fullName}`}
                              onClick={() =>
                                void handleCopyEnrollmentMessage(enrollment.fullName, messageDraft)
                              }
                              size="compact"
                              variant="ghost"
                            >
                              Copiar mensagem
                            </Button>
                            <Button
                              aria-label={`Abrir WhatsApp para ${enrollment.fullName}`}
                              onClick={() => handleOpenWhatsApp(enrollment.whatsapp, messageDraft)}
                              size="compact"
                              variant="secondary"
                            >
                              Abrir WhatsApp
                            </Button>
                            <Button
                              aria-label={`Copiar e-mail de ${enrollment.fullName}`}
                              onClick={() =>
                                void handleCopyEnrollmentEmail(enrollment.fullName, enrollment.email)
                              }
                              size="compact"
                              variant="ghost"
                            >
                              Copiar e-mail
                            </Button>
                          </div>

                          <p className="teacher-panel__note">
                            WhatsApp pronto para envio manual em {getWhatsAppPhoneLabel(enrollment.whatsapp)}.
                          </p>

                          {studentAccess ? (
                            <AlertBox title="Acesso do aluno criado" tone="info">
                              <strong>E-mail:</strong> {studentAccess.email}
                              <br />
                              <strong>Senha temporária:</strong> {studentAccess.temporaryPassword}
                              <br />
                              Seu acesso ao portal foi criado. Use este e-mail e senha temporária
                              para entrar. Por segurança, troque a senha futuramente quando essa
                              função estiver disponível. O envio ao aluno continua manual.
                            </AlertBox>
                          ) : null}

                          <div className="button-row">
                            <Button
                              onClick={() => void handleEnrollmentStatusUpdate(enrollment.id, "approved")}
                              size="compact"
                              variant="secondary"
                            >
                              {isUpdating ? "Atualizando..." : "Aprovar"}
                            </Button>
                            <Button
                              onClick={() =>
                                void handleEnrollmentStatusUpdate(enrollment.id, "needs_contact")
                              }
                              size="compact"
                              variant="ghost"
                            >
                              Marcar para conversar
                            </Button>
                            <Button
                              onClick={() => void handleEnrollmentStatusUpdate(enrollment.id, "rejected")}
                              size="compact"
                              variant="ghost"
                            >
                              Recusar
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    description="Nenhum interessado corresponde aos filtros selecionados."
                    title="Sem cadastros nesta visualizacao"
                  />
                )}
              </Card>

              <Card className="teacher-panel" tone="soft">
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Fluxo demonstrativo</p>
                    <h2>Como o fallback se comporta</h2>
                  </div>
                  <Badge tone="sand">GitHub Pages</Badge>
                </div>

                <p className="teacher-panel__note">
                  Sem backend, a inscricao publica continua funcionando em modo demonstrativo. A
                  A revisão feita aqui atualiza o estado local e ajuda a simular o acesso do aluno.
                </p>
                <p className="teacher-panel__note">
                  Não use este modo como aprovação real. Para aprovar alunos de verdade, rode o
                  backend local.
                </p>
              </Card>
            </div>
          </section>

          <section className="page-section">
            <div className="two-column-grid">
              <Card className="teacher-panel" id={teacherSupportSectionIds.preview} tone="default">
                <div className="teacher-panel__header">
                  <div>
                    <p className="card-eyebrow">Previa editavel</p>
                    <h2>Conteudo da aula</h2>
                  </div>
                  <Badge tone="sand">Editavel</Badge>
                </div>

                <TextArea
                  id="preview-outline"
                  label="Roteiro da aula"
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
                  label="Perguntas de reflexao"
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
                  label="Resumo para participantes"
                  onChange={(event) =>
                    setPreview((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  rows={6}
                  value={preview.summary}
                />

                <TextArea
                  id="preview-message"
                  label="Mensagem para o grupo"
                  onChange={(event) =>
                    setPreview((current) => ({
                      ...current,
                      message: event.target.value,
                    }))
                  }
                  rows={6}
                  value={preview.message}
                />

                <TextArea
                  id="preview-review"
                  label="Pontos que exigem revisão"
                  onChange={(event) =>
                    setPreview((current) => ({
                      ...current,
                      review: event.target.value,
                    }))
                  }
                  rows={6}
                  value={preview.review}
                />
              </Card>

              <div className="teacher-side-stack">
                <Card className="teacher-panel" id={teacherSupportSectionIds.approval} tone="soft">
                  <div className="teacher-panel__header">
                    <h2>Aprovação do professor</h2>
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

                  <p aria-live="polite" className="teacher-panel__note">
                    {actionMessage}
                  </p>
                  <p className="teacher-panel__note">
                    Base de apoio selecionada: {selectedSupportFiles.length} arquivos. Materiais da
                    semana: {activeMaterials.length}. Resumos disponiveis: {activeSummary ? 1 : 0}.
                  </p>

                  <div className="button-row teacher-approval-actions">
                    <Button onClick={handleEdit} variant="ghost">
                      Editar
                    </Button>
                    <Button onClick={handleApprove} variant="secondary">
                      Aprovar
                    </Button>
                    <Button onClick={handleSaveDraft}>Salvar rascunho</Button>
                  </div>
                </Card>

                <Card className="teacher-panel" id={teacherSupportSectionIds.questions} tone="soft">
                  <div className="teacher-panel__header">
                    <h2>Dúvidas recebidas</h2>
                    <Badge tone="sand">{activeQuestions.length}</Badge>
                  </div>
                  <div className="stack-list">
                    {activeQuestions.slice(0, 4).map((question) => {
                      const status = getQuestionStatus(question.status);

                      return (
                        <article className="stack-list__item" key={question.id}>
                          <div className="teacher-panel__header">
                            <strong>{question.authorName}</strong>
                            <StatusTag label={status.label} tone={status.tone} />
                          </div>
                          <p className="teacher-panel__note">{question.question}</p>
                        </article>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
