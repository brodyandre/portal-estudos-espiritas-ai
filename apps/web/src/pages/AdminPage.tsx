import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { ProfileHeader } from "../components/display/ProfileHeader";
import { ActionTile } from "../components/ui/ActionTile";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextArea } from "../components/ui/TextArea";
import { TextInput } from "../components/ui/TextInput";
import { appConfig, DEMO_MODE_NOTICE } from "../config/appMode";
import { getAvailableMockUsers } from "../mocks/currentUser";
import { listAdminAuditEvents } from "../services/adminAuditService";
import { getAdminSettings, saveAdminSettings } from "../services/adminSettingsService";
import { readStudentAccessStatus } from "../services/studentAccessService";
import { listEnrollments } from "../services/enrollmentsService";
import { collectServiceNotice, type ServiceResult } from "../services/api";
import {
  getAdminGroupMeetPreview,
  getAdminGroupMeetVisibilityLabel,
  listAdminGroups,
  toggleAdminGroupStatus,
  updateAdminGroup,
} from "../services/adminGroupsService";
import {
  listAdminAuditEntries,
  listAdminUsers,
  resetAdminUserPassword,
  runAdminUserAction,
} from "../services/adminUsersService";
import { listKnowledgeFilesByGroup } from "../services/knowledgeService";
import { listMaterials } from "../services/materialsService";
import { listStudies } from "../services/studiesService";
import type { AdminGroup, AdminGroupUpdateInput } from "../types/adminGroups";
import type { AdminPublicationMode, AdminSettings } from "../types/adminSettings";
import type { AdminAuditActorRole, AdminAuditEvent } from "../types/adminAudit";
import type {
  AdminAuditLogEntry,
  AdminPasswordResetResult,
  AdminManagedRole,
  AdminManagedUser,
} from "../types/adminUsers";

type AdminSection =
  | "dashboard"
  | "usuarios"
  | "grupos"
  | "configuracoes"
  | "auditoria";

interface AdminPageProps {
  section: AdminSection;
}

interface AdminSectionContent {
  id: string;
  badge: string;
  title: string;
  description: string;
  helper: string;
  highlights: string[];
  notes: string[];
}

interface AdminDashboardData {
  pendingEnrollments: number;
  approvedStudents: number;
  totalTeachers: number;
  activeGroups: number;
  publishedMaterials: number;
  sensitiveReviews: number;
  backendStatus: "online" | "fallback";
  notice: string | null;
}

interface AdminUsersState {
  users: AdminManagedUser[];
  auditEntries: AdminAuditLogEntry[];
  notice: string | null;
  backendStatus: "online" | "fallback";
}

interface AdminGroupsState {
  groups: AdminGroup[];
  notice: string | null;
  backendStatus: "online" | "fallback";
}

interface AdminSettingsState {
  settings: AdminSettings;
  notice: string | null;
  backendStatus: "online" | "fallback";
}

interface AdminAuditState {
  events: AdminAuditEvent[];
  notice: string | null;
  backendStatus: "online" | "fallback";
}

interface AdminPasswordResetModalState {
  targetUser: AdminManagedUser | null;
  result: AdminPasswordResetResult | null;
  errorMessage: string | null;
  notice: string | null;
  copyMessage: string | null;
  isSubmitting: boolean;
}

const sectionContent: Record<Exclude<AdminSection, "dashboard">, AdminSectionContent> = {
  usuarios: {
    id: "admin-usuarios",
    badge: "Pessoas e perfis",
    title: "Gestão de usuários",
    description:
      "Revise os perfis simulados, acompanhe a situação de acesso e prepare a futura separação entre visitante, aluno, professor e admin.",
    helper: "Nesta fase, os perfis são demonstrativos e servem para validar UX e organização de permissões.",
    highlights: ["Visitantes em avaliação", "Alunos aprovados", "Professores revisores", "Administração local"],
    notes: [
      "Não publique dados reais de pessoas no frontend estático.",
      "A autenticação real ficará para a próxima etapa do projeto.",
    ],
  },
  grupos: {
    id: "admin-grupos",
    badge: "Agenda e operação",
    title: "Gestão de grupos",
    description:
      "Organize horários, capacidade, foco dos encontros e materiais de apoio de Emmanuel e A Caminho da Luz.",
    helper: "A ideia aqui é centralizar ajustes de operação sem misturar isso com a rotina do professor.",
    highlights: ["Emmanuel na segunda", "A Caminho da Luz na quarta", "Meet protegido no modo público", "Materiais separados por grupo"],
    notes: [
      "Mantenha o link da aula restrito ao ambiente local e a perfis autorizados.",
      "Evite publicar detalhes operacionais sensíveis na versão pública.",
    ],
  },
  configuracoes: {
    id: "admin-configuracoes",
    badge: "Ambiente e regras",
    title: "Configurações do sistema",
    description:
      "Confira os limites do modo demonstrativo, o uso do backend local e as regras de exibição segura do portal.",
    helper: "Aqui ficam os pontos mais administrativos, como ambiente, visibilidade do Meet e dependência do backend local.",
    highlights: ["Modo demo ativo no Pages", "Backend local em localhost", "Sem dados reais no frontend público", "Meet oculto em ambiente público"],
    notes: [
      "O GitHub Pages publica somente a interface estática.",
      "Recursos privados e administrativos completos dependem do backend local.",
    ],
  },
  auditoria: {
    id: "admin-auditoria",
    badge: "Acompanhamento",
    title: "Auditoria demonstrativa",
    description:
      "Visualize um histórico simples de decisões importantes para apoiar governança, revisão e evolução futura do projeto.",
    helper: "Esta trilha ainda é demonstrativa e prepara o caminho para uma auditoria persistente em etapas futuras.",
    highlights: ["Revisões de interessados", "Mudanças de status", "Publicações aprovadas", "Ajustes de conteúdo"],
    notes: [
      "No MVP atual, não existe auditoria persistente no backend.",
      "Uma versão futura deve registrar eventos com autenticação real e trilha segura.",
    ],
  },
};

const sectionMeta: Record<AdminSection, { description: string; helper: string; badge: string }> = {
  dashboard: {
    badge: "Resumo geral",
    description:
      "Acompanhe os pontos principais do portal em um painel simples, com leitura rápida e sem expor dados pessoais sensíveis.",
    helper: "Este painel resume inscrições, grupos, materiais, revisões e o status atual do backend local.",
  },
  usuarios: {
    badge: sectionContent.usuarios.badge,
    description: sectionContent.usuarios.description,
    helper: sectionContent.usuarios.helper,
  },
  grupos: {
    badge: sectionContent.grupos.badge,
    description: sectionContent.grupos.description,
    helper: sectionContent.grupos.helper,
  },
  configuracoes: {
    badge: sectionContent.configuracoes.badge,
    description: sectionContent.configuracoes.description,
    helper: sectionContent.configuracoes.helper,
  },
  auditoria: {
    badge: sectionContent.auditoria.badge,
    description: sectionContent.auditoria.description,
    helper: sectionContent.auditoria.helper,
  },
};

const quickActions = [
  {
    eyebrow: "Ação rápida",
    title: "Ver interessados",
    description: "Abra a revisão de inscrições para acompanhar quem aguarda aprovação.",
    meta: "Sem mostrar e-mail ou WhatsApp no dashboard inicial.",
    actionLabel: "Abrir revisão",
    to: "/professor",
  },
  {
    eyebrow: "Ação rápida",
    title: "Gerenciar usuários",
    description: "Consulte perfis, status de acesso e a organização demonstrativa dos papéis.",
    meta: "Área administrativa demonstrativa.",
    actionLabel: "Abrir usuários",
    to: "/admin/usuarios",
  },
  {
    eyebrow: "Ação rápida",
    title: "Gerenciar grupos",
    description: "Revise agenda, grupos ativos e organização dos encontros online.",
    meta: "Sem expor link real da aula.",
    actionLabel: "Abrir grupos",
    to: "/admin/grupos",
  },
  {
    eyebrow: "Ação rápida",
    title: "Gerenciar conteúdos",
    description: "Acompanhe materiais publicados e pontos que pedem revisão humana.",
    meta: "Base de apoio e publicações revisáveis.",
    actionLabel: "Abrir conteúdos",
    to: "/admin/conteudos",
  },
  {
    eyebrow: "Ação rápida",
    title: "Ver configurações",
    description: "Confira modo local, fallback demonstrativo e regras de exibição segura.",
    meta: "Controle do ambiente atual.",
    actionLabel: "Abrir configurações",
    to: "/admin/configuracoes",
  },
];

const statusLabelByKey = {
  pendingEnrollments: "Inscrições pendentes",
  approvedStudents: "Alunos ativos",
  totalTeachers: "Professores",
  activeGroups: "Grupos de estudo",
  publishedMaterials: "Materiais publicados",
  sensitiveReviews: "Revisões sensíveis",
} as const;

const createDashboardCardData = (data: AdminDashboardData) => [
  {
    key: "pendingEnrollments",
    title: statusLabelByKey.pendingEnrollments,
    value: data.pendingEnrollments,
    tone: data.pendingEnrollments > 0 ? ("sand" as const) : ("soft" as const),
    helper: data.pendingEnrollments > 0 ? "Há inscrições aguardando revisão." : "Nenhuma inscrição pendente agora.",
  },
  {
    key: "approvedStudents",
    title: statusLabelByKey.approvedStudents,
    value: data.approvedStudents,
    tone: "default" as const,
    helper: "Total demonstrativo de alunos aprovados no fluxo atual.",
  },
  {
    key: "totalTeachers",
    title: statusLabelByKey.totalTeachers,
    value: data.totalTeachers,
    tone: "default" as const,
    helper: "Perfis de professor disponíveis no ambiente demonstrativo.",
  },
  {
    key: "activeGroups",
    title: statusLabelByKey.activeGroups,
    value: data.activeGroups,
    tone: "default" as const,
    helper: "Grupos com encontros e materiais ativos.",
  },
  {
    key: "publishedMaterials",
    title: statusLabelByKey.publishedMaterials,
    value: data.publishedMaterials,
    tone: "soft" as const,
    helper: "Soma de materiais da semana e arquivos de apoio cadastrados.",
  },
  {
    key: "sensitiveReviews",
    title: statusLabelByKey.sensitiveReviews,
    value: data.sensitiveReviews,
    tone: data.sensitiveReviews > 0 ? ("brand" as const) : ("soft" as const),
    helper: "Itens que pedem revisão humana antes de publicar.",
  },
];

const countTeachers = () => {
  return getAvailableMockUsers().filter((user) => user.role === "teacher").length;
};

const countBackendStatus = (results: Array<ServiceResult<unknown>>) => {
  return results.every((result) => result.source === "api") ? "online" : "fallback";
};

const renderBackendStatusLabel = (status: AdminDashboardData["backendStatus"]) => {
  return status === "online" ? "online" : "fallback demonstrativo";
};

const userRoleOptions = [
  { label: "Todos os perfis", value: "all" },
  { label: "Aluno", value: "student" },
  { label: "Professor", value: "teacher" },
  { label: "Admin", value: "admin" },
] as const;

const userStatusOptions = [
  { label: "Todos os status", value: "all" },
  { label: "Pendente", value: "pending" },
  { label: "Ativo", value: "active" },
  { label: "Inativo", value: "inactive" },
  { label: "Recusado", value: "rejected" },
] as const;

const groupLinkOptions = [
  { label: "Sem grupo definido", value: "none" },
  { label: "Emmanuel", value: "emmanuel" },
  { label: "A Caminho da Luz", value: "a-caminho-da-luz" },
] as const;

const publicationModeOptions = [
  { label: "Demonstrativo", value: "demonstrativo" },
  { label: "Local", value: "local" },
  { label: "Produção futura", value: "producao_futura" },
] as const;

const adminActorRoleLabel: Record<AdminAuditActorRole, string> = {
  student: "Aluno",
  teacher: "Professor",
  admin: "Admin",
};

const roleLabel: Record<AdminManagedRole, string> = {
  student: "Aluno",
  teacher: "Professor",
  admin: "Admin",
};

const statusLabel: Record<AdminManagedUser["status"], string> = {
  pending: "Pendente",
  active: "Ativo",
  inactive: "Inativo",
  rejected: "Recusado",
};

const statusToneByUserStatus: Record<
  AdminManagedUser["status"],
  "draft" | "published" | "attention"
> = {
  pending: "draft",
  active: "published",
  inactive: "attention",
  rejected: "attention",
};

const formatAdminDate = (value: string) => {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

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

export const AdminPage = ({ section }: AdminPageProps) => {
  const { user: authenticatedUser } = useAuth();
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(section === "dashboard");
  const [usersState, setUsersState] = useState<AdminUsersState | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(section === "usuarios");
  const [groupsState, setGroupsState] = useState<AdminGroupsState | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(section === "grupos");
  const [settingsState, setSettingsState] = useState<AdminSettingsState | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(section === "configuracoes");
  const [auditState, setAuditState] = useState<AdminAuditState | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(section === "auditoria");
  const [roleFilter, setRoleFilter] = useState<(typeof userRoleOptions)[number]["value"]>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof userStatusOptions)[number]["value"]>("all");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AdminManagedRole>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [adminGroupDrafts, setAdminGroupDrafts] = useState<Record<string, AdminGroupUpdateInput>>({});
  const [adminSettingsDraft, setAdminSettingsDraft] = useState<AdminSettings | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [passwordResetModal, setPasswordResetModal] = useState<AdminPasswordResetModalState>({
    targetUser: null,
    result: null,
    errorMessage: null,
    notice: null,
    copyMessage: null,
    isSubmitting: false,
  });

  useEffect(() => {
    if (section !== "dashboard") {
      return;
    }

    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoadingDashboard(true);

      const [enrollmentsResult, studiesResult, weeklyMaterialsResult, emmanuelFilesResult, aclFilesResult] =
        await Promise.all([
          listEnrollments(),
          listStudies(),
          listMaterials(),
          listKnowledgeFilesByGroup("emmanuel"),
          listKnowledgeFilesByGroup("a-caminho-da-luz"),
        ]);

      if (!isMounted) {
        return;
      }

      const enrollments = enrollmentsResult.data;
      const studies = studiesResult.data;
      const weeklyMaterials = weeklyMaterialsResult.data;
      const knowledgeFiles = [...emmanuelFilesResult.data, ...aclFilesResult.data];
      const serviceResults = [
        enrollmentsResult,
        studiesResult,
        weeklyMaterialsResult,
        emmanuelFilesResult,
        aclFilesResult,
      ];

      setDashboardData({
        pendingEnrollments: enrollments.filter((item) => item.status === "pending").length,
        approvedStudents: enrollments.filter((item) => item.status === "approved").length,
        totalTeachers: countTeachers(),
        activeGroups: studies.length,
        publishedMaterials: weeklyMaterials.length + knowledgeFiles.length,
        sensitiveReviews: knowledgeFiles.filter((item) => item.teacherReviewRecommended).length,
        backendStatus: countBackendStatus(serviceResults),
        notice: collectServiceNotice(serviceResults),
      });
      setIsLoadingDashboard(false);
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [section]);

  useEffect(() => {
    if (section !== "usuarios") {
      return;
    }

    let isMounted = true;

    const loadUsers = async () => {
      setIsLoadingUsers(true);

      const [usersResult, auditResult] = await Promise.all([
        listAdminUsers(),
        listAdminAuditEntries(),
      ]);

      if (!isMounted) {
        return;
      }

      const users = usersResult.data;
      const serviceResults = [usersResult, auditResult];

      setUsersState({
        users,
        auditEntries: auditResult.data,
        notice: collectServiceNotice(serviceResults),
        backendStatus: countBackendStatus(serviceResults),
      });
      setRoleDrafts(
        Object.fromEntries(users.map((user) => [user.id, user.role])) as Record<string, AdminManagedRole>,
      );
      setGroupDrafts(
        Object.fromEntries(
          users.map((user) => [user.id, user.groupSlug ?? "none"]),
        ) as Record<string, string>,
      );
      setNoteDrafts(
        Object.fromEntries(users.map((user) => [user.id, user.adminNote])) as Record<string, string>,
      );
      setIsLoadingUsers(false);
    };

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, [section]);

  useEffect(() => {
    if (section !== "auditoria") {
      return;
    }

    let isMounted = true;

    const loadAudit = async () => {
      setIsLoadingAudit(true);

      const auditResult = await listAdminAuditEvents();

      if (!isMounted) {
        return;
      }

      setAuditState({
        events: auditResult.data,
        notice: auditResult.notice,
        backendStatus: auditResult.source === "api" ? "online" : "fallback",
      });
      setIsLoadingAudit(false);
    };

    void loadAudit();

    return () => {
      isMounted = false;
    };
  }, [section]);

  useEffect(() => {
    if (section !== "configuracoes") {
      return;
    }

    let isMounted = true;

    const loadSettings = async () => {
      setIsLoadingSettings(true);

      const settingsResult = await getAdminSettings();

      if (!isMounted) {
        return;
      }

      setSettingsState({
        settings: settingsResult.data,
        notice: settingsResult.notice,
        backendStatus: settingsResult.source === "api" ? "online" : "fallback",
      });
      setAdminSettingsDraft(settingsResult.data);
      setIsLoadingSettings(false);
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [section]);

  useEffect(() => {
    if (section !== "grupos") {
      return;
    }

    let isMounted = true;

    const loadGroups = async () => {
      setIsLoadingGroups(true);

      const groupsResult = await listAdminGroups();

      if (!isMounted) {
        return;
      }

      setGroupsState({
        groups: groupsResult.data,
        notice: groupsResult.notice,
        backendStatus: groupsResult.source === "api" ? "online" : "fallback",
      });
      setAdminGroupDrafts(
        Object.fromEntries(
          groupsResult.data.map((group) => [
            group.id,
            {
              name: group.name,
              bookTitle: group.bookTitle,
              teacherName: group.teacherName,
              meetingDay: group.meetingDay,
              meetingTime: group.meetingTime,
              welcomeMessage: group.welcomeMessage,
            },
          ]),
        ) as Record<string, AdminGroupUpdateInput>,
      );
      setIsLoadingGroups(false);
    };

    void loadGroups();

    return () => {
      isMounted = false;
    };
  }, [section]);

  const currentMeta = sectionMeta[section];

  const profileMeta = useMemo(() => {
    if (section === "dashboard" && dashboardData) {
      return [
        { label: "Pendências", value: String(dashboardData.pendingEnrollments) },
        { label: "Grupos ativos", value: String(dashboardData.activeGroups) },
        { label: "Backend", value: renderBackendStatusLabel(dashboardData.backendStatus) },
      ];
    }

    if (section === "usuarios" && usersState) {
      return [
        { label: "Usuários", value: String(usersState.users.length) },
        {
          label: "Ativos",
          value: String(usersState.users.filter((user) => user.status === "active").length),
        },
        { label: "Backend", value: renderBackendStatusLabel(usersState.backendStatus) },
      ];
    }

    if (section === "grupos" && groupsState) {
      return [
        { label: "Grupos", value: String(groupsState.groups.length) },
        {
          label: "Ativos",
          value: String(groupsState.groups.filter((group) => group.status === "active").length),
        },
        { label: "Backend", value: renderBackendStatusLabel(groupsState.backendStatus) },
      ];
    }

    if (section === "configuracoes" && settingsState) {
      return [
        { label: "Portal", value: settingsState.settings.portalName },
        {
          label: "Publicação",
          value:
            settingsState.settings.publicationMode === "producao_futura"
              ? "produção futura"
              : settingsState.settings.publicationMode,
        },
        { label: "Backend", value: renderBackendStatusLabel(settingsState.backendStatus) },
      ];
    }

    if (section === "auditoria" && auditState) {
      return [
        { label: "Eventos", value: String(auditState.events.length) },
        {
          label: "Atores",
          value: String(new Set(auditState.events.map((event) => event.actorName)).size),
        },
        { label: "Backend", value: renderBackendStatusLabel(auditState.backendStatus) },
      ];
    }

    return [
      { label: "Perfis ativos", value: "4" },
      { label: "Grupos", value: "2" },
      { label: "Área", value: "Admin" },
    ];
  }, [auditState, dashboardData, groupsState, section, settingsState, usersState]);

  const filteredUsers =
    usersState?.users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }

      if (statusFilter !== "all" && user.status !== statusFilter) {
        return false;
      }

      return true;
    }) ?? [];

  const handleAdminGroupDraftChange = (
    groupId: string,
    field: keyof AdminGroupUpdateInput,
    value: string,
  ) => {
    setAdminGroupDrafts((current) => ({
      ...current,
      [groupId]: {
        ...current[groupId],
        [field]: value,
      },
    }));
  };

  const handleAdminUserAction = async (
    user: AdminManagedUser,
    action:
      | { type: "activate" }
      | { type: "deactivate" }
      | { type: "change_role"; role: AdminManagedRole }
      | { type: "link_group"; groupValue: string }
      | { type: "add_note"; note: string },
  ) => {
    const payload =
      action.type === "link_group"
        ? action.groupValue === "emmanuel"
          ? { type: "link_group" as const, groupName: "Emmanuel", groupSlug: "emmanuel" as const }
          : action.groupValue === "a-caminho-da-luz"
            ? {
                type: "link_group" as const,
                groupName: "A Caminho da Luz",
                groupSlug: "a-caminho-da-luz" as const,
              }
            : {
                type: "link_group" as const,
                groupName: "Sem grupo definido",
                groupSlug: null,
              }
        : action.type === "add_note"
          ? { type: "add_note" as const, note: action.note }
          : action.type === "change_role"
            ? { type: "change_role" as const, role: action.role }
            : action.type === "activate"
              ? { type: "activate" as const }
              : { type: "deactivate" as const };

    const result = await runAdminUserAction(user.id, payload);

    setUsersState((currentState) => {
      if (!currentState || !result.data.user) {
        return currentState;
      }

      const nextUsers = currentState.users.map((currentUser) =>
        currentUser.id === user.id ? result.data.user ?? currentUser : currentUser,
      );

      const nextAuditEntries = result.data.auditEntry
        ? [result.data.auditEntry, ...currentState.auditEntries].slice(0, 6)
        : currentState.auditEntries;

      return {
        ...currentState,
        users: nextUsers,
        auditEntries: nextAuditEntries,
        notice: result.notice ?? currentState.notice,
        backendStatus: result.source === "api" ? currentState.backendStatus : "fallback",
      };
    });

    if (payload.type === "change_role") {
      setRoleDrafts((current) => ({
        ...current,
        [user.id]: payload.role,
      }));
    }

    if (payload.type === "link_group") {
      setGroupDrafts((current) => ({
        ...current,
        [user.id]: payload.groupSlug ?? "none",
      }));
    }

    if (payload.type === "add_note") {
      setNoteDrafts((current) => ({
        ...current,
        [user.id]: payload.note,
      }));
    }

    if (result.data.auditEntry) {
      setActionMessage(result.data.auditEntry.summary);
    }
  };

  const openPasswordResetModal = (targetUser: AdminManagedUser) => {
    setPasswordResetModal({
      targetUser,
      result: null,
      errorMessage: null,
      notice: null,
      copyMessage: null,
      isSubmitting: false,
    });
  };

  const closePasswordResetModal = () => {
    setPasswordResetModal({
      targetUser: null,
      result: null,
      errorMessage: null,
      notice: null,
      copyMessage: null,
      isSubmitting: false,
    });
  };

  const handleConfirmPasswordReset = async () => {
    const targetUser = passwordResetModal.targetUser;

    if (!targetUser) {
      return;
    }

    setPasswordResetModal((current) => ({
      ...current,
      isSubmitting: true,
      errorMessage: null,
      copyMessage: null,
    }));

    try {
      const result = await resetAdminUserPassword(targetUser.id);

      setUsersState((currentState) => {
        if (!currentState || !result.data.user) {
          return currentState;
        }

        return {
          ...currentState,
          users: currentState.users.map((currentUser) =>
            currentUser.id === targetUser.id ? result.data.user ?? currentUser : currentUser,
          ),
          notice: result.notice ?? currentState.notice,
          backendStatus: result.source === "api" ? currentState.backendStatus : "fallback",
        };
      });

      setPasswordResetModal((current) => ({
        ...current,
        result: result.data,
        notice: result.notice,
        isSubmitting: false,
      }));
      setActionMessage(`Senha temporária redefinida para ${targetUser.fullName}.`);
    } catch (error) {
      setPasswordResetModal((current) => ({
        ...current,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Nao foi possivel redefinir a senha temporaria agora.",
        isSubmitting: false,
      }));
    }
  };

  const handleCopyTemporaryPassword = async () => {
    const temporaryPassword = passwordResetModal.result?.temporaryPassword;

    if (!temporaryPassword) {
      return;
    }

    try {
      await copyText(temporaryPassword);
      setPasswordResetModal((current) => ({
        ...current,
        copyMessage: "Senha temporária copiada com sucesso.",
      }));
    } catch (_error) {
      setPasswordResetModal((current) => ({
        ...current,
        copyMessage: "Nao foi possivel copiar a senha temporaria agora.",
      }));
    }
  };

  const handleSaveGroup = async (group: AdminGroup) => {
    const input = adminGroupDrafts[group.id];

    if (!input) {
      return;
    }

    const result = await updateAdminGroup(group.id, input);

    if (!result.data) {
      return;
    }

    setGroupsState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        groups: currentState.groups.map((currentGroup) =>
          currentGroup.id === group.id ? result.data ?? currentGroup : currentGroup,
        ),
        notice: result.notice ?? currentState.notice,
        backendStatus: result.source === "api" ? currentState.backendStatus : "fallback",
      };
    });

    setActionMessage(`Grupo ${result.data.name} atualizado com sucesso.`);
  };

  const handleToggleGroupStatus = async (group: AdminGroup) => {
    const nextStatus = group.status === "active" ? "inactive" : "active";
    const result = await toggleAdminGroupStatus(group.id, nextStatus);

    if (!result.data) {
      return;
    }

    setGroupsState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        groups: currentState.groups.map((currentGroup) =>
          currentGroup.id === group.id ? result.data ?? currentGroup : currentGroup,
        ),
        notice: result.notice ?? currentState.notice,
        backendStatus: result.source === "api" ? currentState.backendStatus : "fallback",
      };
    });

    setActionMessage(
      nextStatus === "active"
        ? `Grupo ${group.name} ativado para novos encontros.`
        : `Grupo ${group.name} inativado nesta configuração demonstrativa.`,
    );
  };

  const handleCopyInviteMessage = async (group: AdminGroup) => {
    const input = adminGroupDrafts[group.id];
    if (!input) {
      return;
    }

    const invitationMessage = `${input.welcomeMessage}\n\nGrupo: ${input.name}\nLivro base: ${input.bookTitle}\nProfessor responsável: ${input.teacherName}\nEncontro: ${input.meetingDay}, ${input.meetingTime}\nPortal do aluno: /#/aluno?grupo=${group.id}&access=approved`;

    try {
      await copyText(invitationMessage);
      setActionMessage(`Mensagem de convite copiada para o grupo ${group.name}.`);
    } catch (_error) {
      setActionMessage("Não foi possível copiar a mensagem de convite agora.");
    }
  };

  const handleSettingsDraftChange = <TKey extends keyof AdminSettings>(
    field: TKey,
    value: AdminSettings[TKey],
  ) => {
    setAdminSettingsDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleSaveSettings = async () => {
    if (!adminSettingsDraft) {
      return;
    }

    const result = await saveAdminSettings(adminSettingsDraft);

    setSettingsState({
      settings: result.data,
      notice: result.notice,
      backendStatus: result.source === "api" ? "online" : "fallback",
    });
    setAdminSettingsDraft(result.data);
    setActionMessage("Configurações demonstrativas salvas com sucesso.");
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Área administrativa"
        description={currentMeta.description}
        eyebrow="Administração"
        meta={profileMeta}
        title="Educação Continuada"
        actions={
          <div className="button-row">
            <Button to="/portal" variant="secondary">
              Ver portal
            </Button>
            <Button to="/professor">Abrir área do professor</Button>
          </div>
        }
      />

      {!appConfig.canUseAdminFeatures ? (
        <AlertBox title="Modo demonstrativo ativo" tone="info">
          {DEMO_MODE_NOTICE}
        </AlertBox>
      ) : null}

      {section === "dashboard" ? (
        <AdminDashboardSection data={dashboardData} isLoading={isLoadingDashboard} />
      ) : section === "usuarios" ? (
        <AdminUsersSection
          actionMessage={actionMessage}
          authenticatedAdminId={authenticatedUser?.role === "admin" ? authenticatedUser.id : null}
          canResetPasswords={authenticatedUser?.role === "admin"}
          filteredUsers={filteredUsers}
          groupDrafts={groupDrafts}
          isLoading={isLoadingUsers}
          noteDrafts={noteDrafts}
          onActivate={(user) => void handleAdminUserAction(user, { type: "activate" })}
          onDeactivate={(user) => void handleAdminUserAction(user, { type: "deactivate" })}
          onGroupDraftChange={(userId, value) =>
            setGroupDrafts((current) => ({
              ...current,
              [userId]: value,
            }))
          }
          onLinkGroup={(user) =>
            void handleAdminUserAction(user, {
              type: "link_group",
              groupValue: groupDrafts[user.id] ?? "none",
            })
          }
          onNoteDraftChange={(userId, value) =>
            setNoteDrafts((current) => ({
              ...current,
              [userId]: value,
            }))
          }
          onRoleDraftChange={(userId, value) =>
            setRoleDrafts((current) => ({
              ...current,
              [userId]: value as AdminManagedRole,
            }))
          }
          onSaveNote={(user) =>
            void handleAdminUserAction(user, {
              type: "add_note",
              note: noteDrafts[user.id] ?? "",
            })
          }
          onOpenPasswordResetModal={openPasswordResetModal}
          onUpdateRole={(user) =>
            void handleAdminUserAction(user, {
              type: "change_role",
              role: roleDrafts[user.id] ?? user.role,
            })
          }
          roleDrafts={roleDrafts}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
          usersState={usersState}
        />
      ) : section === "grupos" ? (
        <AdminGroupsSection
          actionMessage={actionMessage}
          groupDrafts={adminGroupDrafts}
          groupsState={groupsState}
          isLoading={isLoadingGroups}
          onCopyInviteMessage={(group) => void handleCopyInviteMessage(group)}
          onDraftChange={handleAdminGroupDraftChange}
          onSaveGroup={(group) => void handleSaveGroup(group)}
          onToggleStatus={(group) => void handleToggleGroupStatus(group)}
        />
      ) : section === "configuracoes" ? (
        <AdminSettingsSection
          actionMessage={actionMessage}
          draft={adminSettingsDraft}
          isLoading={isLoadingSettings}
          onDraftChange={handleSettingsDraftChange}
          onSave={handleSaveSettings}
          settingsState={settingsState}
        />
      ) : section === "auditoria" ? (
        <AdminAuditSection auditState={auditState} isLoading={isLoadingAudit} />
      ) : (
        <AdminInfoSection content={sectionContent[section]} />
      )}

      {passwordResetModal.targetUser ? (
        <div
          aria-label="Confirmar redefinição de senha"
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <Card className="admin-modal" tone="soft">
            <p className="card-eyebrow">Acesso temporário</p>
            <h2>Redefinir senha</h2>
            <p>
              Confirme a redefinição da senha de <strong>{passwordResetModal.targetUser.fullName}</strong>.
            </p>
            <p>
              <strong>E-mail:</strong> {passwordResetModal.targetUser.email}
            </p>

            <AlertBox title="Sessões anteriores serão encerradas" tone="warning">
              A nova senha temporária exigirá troca obrigatória no próximo acesso. Entregue essa
              credencial por um canal seguro.
            </AlertBox>

            {passwordResetModal.notice ? (
              <AlertBox title="Modo demonstrativo" tone="info">
                {passwordResetModal.notice}
              </AlertBox>
            ) : null}

            {passwordResetModal.errorMessage ? (
              <AlertBox title="Não foi possível redefinir a senha" tone="warning">
                {passwordResetModal.errorMessage}
              </AlertBox>
            ) : null}

            {passwordResetModal.result?.temporaryPassword ? (
              <AlertBox title="Senha temporária gerada" tone="success">
                <p>
                  <strong>Senha temporária:</strong> {passwordResetModal.result.temporaryPassword}
                </p>
                <p>Compartilhe a credencial por um canal seguro e somente uma vez.</p>
              </AlertBox>
            ) : null}

            {passwordResetModal.copyMessage ? (
              <AlertBox title="Cópia da senha" tone="info">
                {passwordResetModal.copyMessage}
              </AlertBox>
            ) : null}

            <div className="button-row">
              {!passwordResetModal.result ? (
                <Button
                  aria-label={`Confirmar redefinição de senha de ${passwordResetModal.targetUser.fullName}`}
                  disabled={passwordResetModal.isSubmitting}
                  onClick={() => void handleConfirmPasswordReset()}
                >
                  {passwordResetModal.isSubmitting ? "Redefinindo..." : "Confirmar redefinição"}
                </Button>
              ) : (
                <Button
                  aria-label="Copiar senha temporária"
                  onClick={() => void handleCopyTemporaryPassword()}
                >
                  Copiar senha
                </Button>
              )}
              <Button
                aria-label="Fechar modal de redefinição de senha"
                onClick={closePasswordResetModal}
                variant="secondary"
              >
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

interface AdminAuditSectionProps {
  auditState: AdminAuditState | null;
  isLoading: boolean;
}

const AdminAuditSection = ({ auditState, isLoading }: AdminAuditSectionProps) => {
  if (isLoading) {
    return (
      <LoadingState
        title="Carregando auditoria"
        description="Organizando eventos importantes do MVP para leitura administrativa."
      />
    );
  }

  if (!auditState) {
    return (
      <EmptyState
        title="Auditoria indisponível"
        description="Não foi possível carregar a trilha demonstrativa de auditoria agora."
      />
    );
  }

  return (
    <section className="page-section admin-overview" id="admin-auditoria">
      <SectionHeader
        badge="Acompanhamento"
        helper="Acompanhe ações importantes do MVP sem expor dados desnecessários nem conteúdo de mensagens privadas."
        title="Auditoria demonstrativa"
      />

      {auditState.notice ? (
        <AlertBox title="Modo demonstrativo de auditoria" tone="info">
          {auditState.notice}
        </AlertBox>
      ) : (
        <AlertBox title="Backend online" tone="success">
          Os eventos foram carregados pelo backend local.
        </AlertBox>
      )}

      <AlertBox title="Cuidados desta trilha" tone="warning">
        Esta visão não registra conteúdo de mensagens privadas nem dados sensíveis além do necessário.
        Em produção, a auditoria deve vir do backend.
      </AlertBox>

      <div className="page-stack">
        {auditState.events.map((event) => (
          <Card className="admin-audit-card" key={event.id}>
            <div className="admin-user-card__header">
              <div>
                <h3>{event.action}</h3>
                <p>{event.entity}</p>
              </div>
              <Badge tone={event.actorRole === "admin" ? "brand" : event.actorRole === "teacher" ? "sand" : "neutral"}>
                {adminActorRoleLabel[event.actorRole]}
              </Badge>
            </div>

            <dl className="admin-user-card__meta">
              <div>
                <dt>Data e hora</dt>
                <dd>{new Date(event.occurredAt).toLocaleString("pt-BR")}</dd>
              </div>
              <div>
                <dt>Ator</dt>
                <dd>{event.actorName}</dd>
              </div>
              <div>
                <dt>Perfil</dt>
                <dd>{adminActorRoleLabel[event.actorRole]}</dd>
              </div>
              <div>
                <dt>Observação</dt>
                <dd>{event.note}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </section>
  );
};

interface AdminSettingsSectionProps {
  settingsState: AdminSettingsState | null;
  draft: AdminSettings | null;
  isLoading: boolean;
  onDraftChange: <TKey extends keyof AdminSettings>(
    field: TKey,
    value: AdminSettings[TKey],
  ) => void;
  onSave: () => void;
  actionMessage: string | null;
}

const AdminSettingsSection = ({
  settingsState,
  draft,
  isLoading,
  onDraftChange,
  onSave,
  actionMessage,
}: AdminSettingsSectionProps) => {
  if (isLoading) {
    return (
      <LoadingState
        title="Carregando configurações"
        description="Organizando dados públicos do portal, mensagens padrão e modo de publicação."
      />
    );
  }

  if (!settingsState || !draft) {
    return (
      <EmptyState
        title="Configurações indisponíveis"
        description="Não foi possível carregar as configurações administrativas neste momento."
      />
    );
  }

  return (
    <section className="page-section admin-overview" id="admin-configuracoes">
      <SectionHeader
        badge="Ambiente e regras"
        helper="Revise nomes públicos, mensagens padrão e a forma de publicação sem guardar segredos no frontend."
        title="Configurações do sistema"
      />

      {settingsState.notice ? (
        <AlertBox title="Modo demonstrativo de configurações" tone="info">
          {settingsState.notice}
        </AlertBox>
      ) : (
        <AlertBox title="Backend online" tone="success">
          As configurações foram carregadas pelo backend local.
        </AlertBox>
      )}

      <AlertBox title="Aviso de segurança" tone="warning">
        Configurações sensíveis devem ficar no backend em produção.
      </AlertBox>

      {actionMessage ? (
        <AlertBox title="Última ação registrada" tone="success">
          {actionMessage}
        </AlertBox>
      ) : null}

      <Card className="admin-settings-card">
        <div className="teacher-form-grid">
          <TextInput
            id="admin-settings-institution-name"
            label="Nome da instituição"
            onChange={(event) => onDraftChange("institutionName", event.target.value)}
            value={draft.institutionName}
          />
          <TextInput
            id="admin-settings-portal-name"
            label="Nome do portal"
            onChange={(event) => onDraftChange("portalName", event.target.value)}
            value={draft.portalName}
          />
          <TextInput
            id="admin-settings-public-url"
            label="URL pública do GitHub Pages"
            onChange={(event) => onDraftChange("publicPagesUrl", event.target.value)}
            value={draft.publicPagesUrl}
          />
          <TextInput
            id="admin-settings-qr-url"
            label="URL recomendada para QR Code"
            onChange={(event) => onDraftChange("recommendedQrCodeUrl", event.target.value)}
            value={draft.recommendedQrCodeUrl}
          />
          <Select
            id="admin-settings-publication-mode"
            label="Modo de publicação"
            onChange={(event) =>
              onDraftChange("publicationMode", event.target.value as AdminPublicationMode)
            }
            options={publicationModeOptions.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            value={draft.publicationMode}
          />
        </div>

        <TextArea
          id="admin-settings-enrollment-message"
          label="Mensagem padrão de inscrição"
          onChange={(event) => onDraftChange("enrollmentMessage", event.target.value)}
          rows={3}
          value={draft.enrollmentMessage}
        />
        <TextArea
          id="admin-settings-approval-message"
          label="Mensagem padrão de aprovação"
          onChange={(event) => onDraftChange("approvalMessage", event.target.value)}
          rows={3}
          value={draft.approvalMessage}
        />
        <TextArea
          id="admin-settings-whatsapp-message"
          label="Mensagem padrão para WhatsApp"
          onChange={(event) => onDraftChange("whatsappMessage", event.target.value)}
          rows={4}
          value={draft.whatsappMessage}
        />

        <div className="admin-group-card__meta">
          <Badge tone="sand">Sem tokens</Badge>
          <Badge tone="neutral">Sem senhas</Badge>
          <Badge tone="brand">
            {draft.publicationMode === "producao_futura"
              ? "Produção futura planejada"
              : draft.publicationMode === "local"
                ? "Uso local autorizado"
                : "Fluxo demonstrativo"}
          </Badge>
        </div>

        <div className="button-row admin-group-card__actions">
          <Button aria-label="Salvar configurações do sistema" onClick={onSave}>
            Salvar configurações
          </Button>
        </div>
      </Card>
    </section>
  );
};

interface AdminUsersSectionProps {
  usersState: AdminUsersState | null;
  filteredUsers: AdminManagedUser[];
  isLoading: boolean;
  authenticatedAdminId: string | null;
  canResetPasswords: boolean;
  roleFilter: (typeof userRoleOptions)[number]["value"];
  statusFilter: (typeof userStatusOptions)[number]["value"];
  setRoleFilter: (value: (typeof userRoleOptions)[number]["value"]) => void;
  setStatusFilter: (value: (typeof userStatusOptions)[number]["value"]) => void;
  roleDrafts: Record<string, AdminManagedRole>;
  groupDrafts: Record<string, string>;
  noteDrafts: Record<string, string>;
  onRoleDraftChange: (userId: string, value: string) => void;
  onGroupDraftChange: (userId: string, value: string) => void;
  onNoteDraftChange: (userId: string, value: string) => void;
  onActivate: (user: AdminManagedUser) => void;
  onDeactivate: (user: AdminManagedUser) => void;
  onUpdateRole: (user: AdminManagedUser) => void;
  onLinkGroup: (user: AdminManagedUser) => void;
  onSaveNote: (user: AdminManagedUser) => void;
  onOpenPasswordResetModal: (user: AdminManagedUser) => void;
  actionMessage: string | null;
}

const AdminUsersSection = ({
  usersState,
  filteredUsers,
  isLoading,
  authenticatedAdminId,
  canResetPasswords,
  roleFilter,
  statusFilter,
  setRoleFilter,
  setStatusFilter,
  roleDrafts,
  groupDrafts,
  noteDrafts,
  onRoleDraftChange,
  onGroupDraftChange,
  onNoteDraftChange,
  onActivate,
  onDeactivate,
  onUpdateRole,
  onLinkGroup,
  onSaveNote,
  onOpenPasswordResetModal,
  actionMessage,
}: AdminUsersSectionProps) => {
  if (isLoading) {
    return (
      <LoadingState
        title="Carregando gestão de usuários"
        description="Organizando perfis, status, grupos e histórico administrativo."
      />
    );
  }

  if (!usersState) {
    return (
      <EmptyState
        title="Lista de usuários indisponível"
        description="Não foi possível carregar a visão administrativa de usuários agora."
      />
    );
  }

  return (
    <section className="page-section admin-overview" id="admin-usuarios">
      <SectionHeader
        badge="Pessoas e perfis"
        helper="Gerencie usuários com ações simuladas, filtros rápidos e registro demonstrativo de auditoria."
        title="Gestão de usuários"
      />

      {usersState.notice ? (
        <AlertBox title="Modo demonstrativo de usuários" tone="info">
          {usersState.notice}
        </AlertBox>
      ) : (
        <AlertBox title="Backend online" tone="success">
          Os usuários foram atualizados pelo backend local.
        </AlertBox>
      )}

      <AlertBox title="Cuidados desta tela" tone="warning">
        As ações desta fase são simuladas. Em produção, ativação de usuário, mudança de perfil,
        vínculo de grupo e observações administrativas exigem backend autenticado.
      </AlertBox>

      {actionMessage ? (
        <AlertBox title="Última ação registrada" tone="success">
          {actionMessage}
        </AlertBox>
      ) : null}

      <div className="teacher-form-grid admin-user-filters">
        <Select
          id="admin-users-role-filter"
          label="Perfil"
          onChange={(event) => setRoleFilter(event.target.value as (typeof userRoleOptions)[number]["value"])}
          options={userRoleOptions.map((option) => ({ label: option.label, value: option.value }))}
          value={roleFilter}
        />
        <Select
          id="admin-users-status-filter"
          label="Status"
          onChange={(event) =>
            setStatusFilter(event.target.value as (typeof userStatusOptions)[number]["value"])
          }
          options={userStatusOptions.map((option) => ({ label: option.label, value: option.value }))}
          value={statusFilter}
        />
      </div>

      <div className="two-column-grid admin-users-layout">
        <div className="page-stack">
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Ajuste os filtros para localizar outro perfil nesta visualização."
            />
          ) : (
            filteredUsers.map((user) => (
              <Card className="admin-user-card" key={user.id}>
                <div className="admin-user-card__header">
                  <div>
                    <h3>{user.fullName}</h3>
                    <p>{user.email}</p>
                  </div>
                  <StatusTag
                    label={statusLabel[user.status]}
                    tone={statusToneByUserStatus[user.status]}
                  />
                </div>

                <dl className="admin-user-card__meta">
                  <div>
                    <dt>Perfil</dt>
                    <dd>{roleLabel[user.role]}</dd>
                  </div>
                  <div>
                    <dt>Grupo</dt>
                    <dd>{user.groupName}</dd>
                  </div>
                  <div>
                    <dt>Cadastro</dt>
                    <dd>{formatAdminDate(user.createdAt)}</dd>
                  </div>
                </dl>

                <div className="teacher-form-grid admin-user-card__controls">
                  <Select
                    id={`admin-user-role-${user.id}`}
                    label="Alterar perfil"
                    onChange={(event) => onRoleDraftChange(user.id, event.target.value)}
                    options={userRoleOptions
                      .filter((option) => option.value !== "all")
                      .map((option) => ({ label: option.label, value: option.value }))}
                    value={roleDrafts[user.id] ?? user.role}
                  />
                  <Select
                    id={`admin-user-group-${user.id}`}
                    label="Vincular a grupo"
                    onChange={(event) => onGroupDraftChange(user.id, event.target.value)}
                    options={groupLinkOptions.map((option) => ({ label: option.label, value: option.value }))}
                    value={groupDrafts[user.id] ?? (user.groupSlug ?? "none")}
                  />
                </div>

                <TextArea
                  id={`admin-user-note-${user.id}`}
                  label="Observação administrativa"
                  onChange={(event) => onNoteDraftChange(user.id, event.target.value)}
                  rows={3}
                  value={noteDrafts[user.id] ?? ""}
                />

                <div className="button-row admin-user-card__actions">
                  {user.status === "active" ? (
                    <Button
                      aria-label={`Inativar usuário ${user.fullName}`}
                      onClick={() => onDeactivate(user)}
                      variant="secondary"
                    >
                      Inativar usuário
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Ativar usuário ${user.fullName}`}
                      onClick={() => onActivate(user)}
                    >
                      Ativar usuário
                    </Button>
                  )}
                  <Button
                    aria-label={`Alterar perfil de ${user.fullName}`}
                    onClick={() => onUpdateRole(user)}
                    variant="secondary"
                  >
                    Alterar perfil
                  </Button>
                  <Button
                    aria-label={`Vincular ${user.fullName} a um grupo`}
                    onClick={() => onLinkGroup(user)}
                    variant="secondary"
                  >
                    Vincular a grupo
                  </Button>
                  <Button
                    aria-label={`Salvar observação administrativa de ${user.fullName}`}
                    onClick={() => onSaveNote(user)}
                    variant="ghost"
                  >
                    Salvar observação
                  </Button>
                  {canResetPasswords && user.id !== authenticatedAdminId ? (
                    <Button
                      aria-label={`Redefinir senha de ${user.fullName}`}
                      onClick={() => onOpenPasswordResetModal(user)}
                      variant="secondary"
                    >
                      Redefinir senha
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="admin-audit-card" tone="soft">
          <p className="card-eyebrow">Auditoria demonstrativa</p>
          <h3>Últimas ações administrativas</h3>
          <p>
            As ações executadas nesta tela são registradas em um log mockado local. Em produção,
            esse histórico deve ficar no backend autenticado.
          </p>

          <div className="stack-list">
            {usersState.auditEntries.map((entry) => (
              <div className="stack-list__item" key={entry.id}>
                <strong>{entry.summary}</strong>
                <p>{entry.actorName}</p>
                <p>{formatAdminDate(entry.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
};

interface AdminDashboardSectionProps {
  data: AdminDashboardData | null;
  isLoading: boolean;
}

const AdminDashboardSection = ({ data, isLoading }: AdminDashboardSectionProps) => {
  if (isLoading) {
    return (
      <div className="page-stack">
        <LoadingState
          title="Carregando dashboard administrativo"
          description="Organizando inscrições, grupos, materiais e status do ambiente."
        />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Dashboard indisponível agora"
        description="Não foi possível montar o resumo administrativo neste momento."
        action={
          <Button to="/portal" variant="secondary">
            Voltar ao portal
          </Button>
        }
      />
    );
  }

  const cards = createDashboardCardData(data);

  return (
    <section className="page-section admin-overview" id="admin-dashboard">
      <SectionHeader
        badge="Resumo geral"
        helper="Este painel resume inscrições, grupos, materiais, revisões e o status atual do backend local."
        title="Dashboard administrativo"
      />

      {data.notice ? (
        <AlertBox title="Fallback demonstrativo em uso" tone="info">
          {data.notice}
        </AlertBox>
      ) : (
        <AlertBox title="Backend online" tone="success">
          Os dados do dashboard foram atualizados pelo backend local.
        </AlertBox>
      )}

      <Card className="admin-status-card" tone="soft" padded>
        <div className="admin-status-card__top">
          <div>
            <p className="card-eyebrow">Status do backend</p>
            <h3>{renderBackendStatusLabel(data.backendStatus)}</h3>
          </div>
          <Badge tone={data.backendStatus === "online" ? "success" : "sand"}>
            {data.backendStatus === "online" ? "online" : "fallback demonstrativo"}
          </Badge>
        </div>
        <p>
          O dashboard inicial não mostra e-mails, WhatsApps nem dados pessoais detalhados. Essas
          informações ficam restritas às telas específicas de revisão.
        </p>
      </Card>

      <div className="three-column-grid admin-metric-grid" id="admin-destaques">
        {cards.map((card) => (
          <Card className="admin-metric-card" key={card.key} tone={card.tone}>
            <p className="card-eyebrow">{card.title}</p>
            <strong className="stat-value">{card.value}</strong>
            <p>{card.helper}</p>
          </Card>
        ))}
      </div>

      <div className="page-section">
        <SectionHeader
          badge="Ações rápidas"
          helper="Atalhos simples para continuar a gestão local sem abrir dados sensíveis no resumo inicial."
          title="Próximos passos"
        />

        <div className="three-column-grid admin-actions-grid">
          {quickActions.map((action) => (
            <ActionTile
              actionLabel={action.actionLabel}
              description={action.description}
              eyebrow={action.eyebrow}
              key={action.title}
              meta={action.meta}
              title={action.title}
              to={action.to}
              tone="default"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

interface AdminGroupsSectionProps {
  groupsState: AdminGroupsState | null;
  groupDrafts: Record<string, AdminGroupUpdateInput>;
  isLoading: boolean;
  onDraftChange: (groupId: string, field: keyof AdminGroupUpdateInput, value: string) => void;
  onSaveGroup: (group: AdminGroup) => void;
  onToggleStatus: (group: AdminGroup) => void;
  onCopyInviteMessage: (group: AdminGroup) => void;
  actionMessage: string | null;
}

const AdminGroupsSection = ({
  groupsState,
  groupDrafts,
  isLoading,
  onDraftChange,
  onSaveGroup,
  onToggleStatus,
  onCopyInviteMessage,
  actionMessage,
}: AdminGroupsSectionProps) => {
  const studentPreviewStatus = readStudentAccessStatus();

  if (isLoading) {
    return (
      <LoadingState
        title="Carregando gestão de grupos"
        description="Organizando agenda, responsáveis, mensagem de boas-vindas e visibilidade do Meet."
      />
    );
  }

  if (!groupsState) {
    return (
      <EmptyState
        title="Lista de grupos indisponível"
        description="Não foi possível carregar a gestão administrativa de grupos agora."
      />
    );
  }

  return (
    <section className="page-section admin-overview" id="admin-grupos">
      <SectionHeader
        badge="Agenda e operação"
        helper="Edite os grupos, acompanhe a proteção do Meet e prepare uma experiência segura para aluno, professor e admin."
        title="Gestão de grupos"
      />

      {groupsState.notice ? (
        <AlertBox title="Modo demonstrativo de grupos" tone="info">
          {groupsState.notice}
        </AlertBox>
      ) : (
        <AlertBox title="Backend online" tone="success">
          Os grupos foram atualizados pelo backend local.
        </AlertBox>
      )}

      <AlertBox title="Regra do link da aula" tone="warning">
        O link do Google Meet nunca aparece em páginas públicas. Nesta tela administrativa, o
        ambiente local pode mostrar o link real. No GitHub Pages, mostramos apenas um link
        demonstrativo.
      </AlertBox>

      {actionMessage ? (
        <AlertBox title="Última ação registrada" tone="success">
          {actionMessage}
        </AlertBox>
      ) : null}

      <div className="page-stack">
        {groupsState.groups.map((group) => {
          const draft = groupDrafts[group.id];
          const meetPreview = getAdminGroupMeetPreview(group);

          return (
            <Card className="admin-group-card" key={group.id}>
              <div className="admin-group-card__header">
                <div>
                  <h3>{group.name}</h3>
                  <p>{group.bookTitle}</p>
                </div>
                <StatusTag
                  label={group.status === "active" ? "Ativo" : "Inativo"}
                  tone={group.status === "active" ? "published" : "attention"}
                />
              </div>

              <div className="teacher-form-grid admin-group-card__grid">
                <TextInput
                  id={`admin-group-name-${group.id}`}
                  label="Nome do grupo"
                  onChange={(event) => onDraftChange(group.id, "name", event.target.value)}
                  value={draft?.name ?? group.name}
                />
                <TextInput
                  id={`admin-group-book-${group.id}`}
                  label="Livro base"
                  onChange={(event) => onDraftChange(group.id, "bookTitle", event.target.value)}
                  value={draft?.bookTitle ?? group.bookTitle}
                />
                <TextInput
                  id={`admin-group-teacher-${group.id}`}
                  label="Professor responsável"
                  onChange={(event) => onDraftChange(group.id, "teacherName", event.target.value)}
                  value={draft?.teacherName ?? group.teacherName}
                />
                <TextInput
                  id={`admin-group-day-${group.id}`}
                  label="Dia da semana"
                  onChange={(event) => onDraftChange(group.id, "meetingDay", event.target.value)}
                  value={draft?.meetingDay ?? group.meetingDay}
                />
                <TextInput
                  id={`admin-group-time-${group.id}`}
                  label="Horário"
                  onChange={(event) => onDraftChange(group.id, "meetingTime", event.target.value)}
                  value={draft?.meetingTime ?? group.meetingTime}
                />
                <TextInput
                  id={`admin-group-meet-${group.id}`}
                  helperText={getAdminGroupMeetVisibilityLabel()}
                  label="Link do Google Meet"
                  readOnly
                  value={meetPreview}
                />
              </div>

              <TextArea
                id={`admin-group-welcome-${group.id}`}
                label="Mensagem de boas-vindas"
                onChange={(event) => onDraftChange(group.id, "welcomeMessage", event.target.value)}
                rows={4}
                value={draft?.welcomeMessage ?? group.welcomeMessage}
              />

              <div className="admin-group-card__meta">
                <Badge tone="sand">
                  {appConfig.canShowRealMeetLink ? "Ambiente local com link real" : "Versão pública com link demonstrativo"}
                </Badge>
                <Badge tone="brand">
                  Prévia do aluno: {studentPreviewStatus === "approved" ? "aprovado" : "bloqueado"}
                </Badge>
              </div>

              <div className="button-row admin-group-card__actions">
                <Button
                  aria-label={`Salvar alterações do grupo ${group.name}`}
                  onClick={() => onSaveGroup(group)}
                >
                  Editar grupo
                </Button>
                <Button
                  aria-label={`${group.status === "active" ? "Inativar" : "Ativar"} grupo ${group.name}`}
                  onClick={() => onToggleStatus(group)}
                  variant="secondary"
                >
                  {group.status === "active" ? "Inativar grupo" : "Ativar grupo"}
                </Button>
                <Button
                  aria-label={`Copiar mensagem de convite do grupo ${group.name}`}
                  onClick={() => onCopyInviteMessage(group)}
                  variant="secondary"
                >
                  Copiar mensagem de convite
                </Button>
                <Button
                  aria-label={`Visualizar ${group.name} como aluno aprovado`}
                  to={`/aluno?grupo=${group.id}&access=approved`}
                  variant="ghost"
                >
                  Visualizar como aluno
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

interface AdminInfoSectionProps {
  content: AdminSectionContent;
}

const AdminInfoSection = ({ content }: AdminInfoSectionProps) => {
  return (
    <section className="page-section admin-overview" id={content.id}>
      <SectionHeader badge={content.badge} helper={content.helper} title={content.title} />

      <div className="two-column-grid">
        <Card className="admin-summary-card">
          <h3>O que acompanhar aqui</h3>
          <div className="admin-pill-row" aria-label="Destaques da seção">
            {content.highlights.map((item) => (
              <Badge key={item} tone="sand">
                {item}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="admin-summary-card" tone="soft" id="admin-destaques">
          <h3>Cuidados desta área</h3>
          <ul className="admin-list">
            {content.notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
};

interface SectionHeaderProps {
  badge: string;
  title: string;
  helper: string;
}

const SectionHeader = ({ badge, title, helper }: SectionHeaderProps) => {
  return (
    <div className="section-header">
      <Badge tone="sand">{badge}</Badge>
      <h2>{title}</h2>
      <p>{helper}</p>
    </div>
  );
};
