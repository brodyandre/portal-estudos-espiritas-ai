import type { AdminAuditEvent } from "../types/adminAudit";

const AUDIT_EVENTS_STORAGE_KEY = "portal-estudos-espiritas-ai:admin-audit-events";

const seededAuditEvents: AdminAuditEvent[] = [
  {
    id: "audit-event-001",
    occurredAt: "2026-07-09T19:12:00-03:00",
    actorName: "Portal público",
    actorRole: "student",
    action: "Aluno inscrito",
    entity: "Inscrição de novo interessado",
    note: "Cadastro inicial recebido para análise, sem expor informações além do necessário.",
  },
  {
    id: "audit-event-002",
    occurredAt: "2026-07-09T19:35:00-03:00",
    actorName: "Professora Ariete",
    actorRole: "teacher",
    action: "Professor aprovou aluno",
    entity: "Solicitação de Mariana Souza",
    note: "Acesso liberado para o painel do aluno no fluxo demonstrativo.",
  },
  {
    id: "audit-event-003",
    occurredAt: "2026-07-10T09:05:00-03:00",
    actorName: "Professor Luiz",
    actorRole: "teacher",
    action: "Professor marcou para conversar",
    entity: "Solicitação de Carlos Henrique",
    note: "Solicitado contato manual antes da liberação do acesso.",
  },
  {
    id: "audit-event-004",
    occurredAt: "2026-07-10T10:20:00-03:00",
    actorName: "Admin demonstrativo",
    actorRole: "admin",
    action: "Admin alterou grupo",
    entity: "Grupo Emmanuel",
    note: "Horário e mensagem de boas-vindas revisados no ambiente local.",
  },
  {
    id: "audit-event-005",
    occurredAt: "2026-07-10T14:45:00-03:00",
    actorName: "Admin demonstrativo",
    actorRole: "admin",
    action: "Admin marcou conteúdo como revisado",
    entity: "Emmanuel - dúvidas frequentes",
    note: "Resumo autoral conferido para uso como apoio ao estudo.",
  },
  {
    id: "audit-event-006",
    occurredAt: "2026-07-11T08:10:00-03:00",
    actorName: "Admin demonstrativo",
    actorRole: "admin",
    action: "Admin alterou configuração",
    entity: "Configurações do portal",
    note: "URL pública e mensagem padrão de inscrição atualizadas no modo demonstrativo.",
  },
];

const isBrowser = () => {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
};

const cloneAuditEvent = (item: AdminAuditEvent): AdminAuditEvent => ({ ...item });

const readStoredAuditEvents = (): AdminAuditEvent[] | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(AUDIT_EVENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminAuditEvent[]) : null;
  } catch (_error) {
    return null;
  }
};

export const listMockAdminAuditEvents = () => {
  return (readStoredAuditEvents() ?? seededAuditEvents).map(cloneAuditEvent);
};

export const resetMockAdminAuditEvents = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(AUDIT_EVENTS_STORAGE_KEY);
};

