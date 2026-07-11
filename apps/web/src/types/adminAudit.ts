export type AdminAuditActorRole = "student" | "teacher" | "admin";

export interface AdminAuditEvent {
  id: string;
  occurredAt: string;
  actorName: string;
  actorRole: AdminAuditActorRole;
  action: string;
  entity: string;
  note: string;
}

