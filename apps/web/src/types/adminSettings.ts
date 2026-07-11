export type AdminPublicationMode = "demonstrativo" | "local" | "producao_futura";

export interface AdminSettings {
  institutionName: string;
  portalName: string;
  publicPagesUrl: string;
  recommendedQrCodeUrl: string;
  enrollmentMessage: string;
  approvalMessage: string;
  whatsappMessage: string;
  publicationMode: AdminPublicationMode;
}

