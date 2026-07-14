import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import { ServiceRequestError } from "../services/api";
import {
  baseResult,
  buildBaseResult,
  buildInvitation,
  buildResult,
  buildResendResult,
  createDeferred,
  renderPage,
  restoreOriginalLocation,
} from "./AdminAccountInvitationsPageTestSupport";

vi.mock("../services/adminAccountInvitationsService", () => ({
  cancelAdminAccountInvitation: vi.fn(),
  listAdminAccountInvitations: vi.fn(),
  resendAdminAccountInvitation: vi.fn(),
}));

const cancelInvitationMock = vi.mocked(cancelAdminAccountInvitation);
const listInvitationsMock = vi.mocked(listAdminAccountInvitations);
const resendInvitationMock = vi.mocked(resendAdminAccountInvitation);

describe("AdminAccountInvitationsPage", () => {
  beforeEach(() => {
    listInvitationsMock.mockReset();
    cancelInvitationMock.mockReset();
    resendInvitationMock.mockReset();

    listInvitationsMock.mockResolvedValue(buildBaseResult());
    cancelInvitationMock.mockResolvedValue({ canceled: true });
    resendInvitationMock.mockResolvedValue(buildResendResult());
  });

  afterEach(() => {
    cleanup();

    listInvitationsMock.mockReset();
    cancelInvitationMock.mockReset();
    resendInvitationMock.mockReset();

    vi.clearAllMocks();

    window.localStorage.clear();
    window.sessionStorage.clear();

    restoreOriginalLocation();
  });

  it("botao reenviar convite aparece para convite pendente", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });

  it("botao reenviar convite aparece para convite expirado", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "expired" })]));

    renderPage();

    expect(await screen.findByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });

  it("botao reenviar convite aparece para convite cancelado", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "canceled" })]));

    renderPage();

    expect(await screen.findByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });

  it("botao reenviar convite nao aparece para convite aceito", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "accepted" })]));

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reenviar convite" })).not.toBeInTheDocument();
  });

  it("deliveryStatus nao interfere na elegibilidade do reenvio", async () => {
    listInvitationsMock.mockResolvedValue(
      buildResult({}, [buildInvitation({ deliveryStatus: "failed", lifecycleStatus: "expired" })]),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });

  it("convite pendente mostra cancelar e reenviar", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByRole("button", { name: "Cancelar convite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });

  it("convite expirado mostra somente reenviar", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "expired" })]));

    renderPage();

    expect(await screen.findByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar convite" })).not.toBeInTheDocument();
  });

  it("clique em reenviar abre confirmacao acessivel", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));

    const dialog = screen.getByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i });
    const title = screen.getByRole("heading", { name: "Reenviar convite para Ana Beatriz?" });

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", "resend-invitation-dialog-title");
    expect(dialog).not.toHaveAttribute("aria-label");
    expect(title).toHaveAttribute("id", "resend-invitation-dialog-title");
    expect(dialog.getAttribute("aria-labelledby")).not.toContain("invitation-internal-id-001");
    expect(title).not.toHaveTextContent("invitation-internal-id-001");
  });

  it("confirmacao de reenvio mostra nome e email mascarado", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));

    expect(screen.getByText("Reenviar convite para Ana Beatriz?")).toBeInTheDocument();
    expect(screen.getAllByText("a***z@example.com").length).toBeGreaterThan(0);
  });

  it("confirmacao de reenvio nao mostra id do convite", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));

    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("manter convite fecha confirmacao de reenvio sem chamar servico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Manter convite" }));

    expect(screen.queryByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i })).not.toBeInTheDocument();
    expect(resendInvitationMock).not.toHaveBeenCalled();
  });

  it("confirmar reenvio chama servico com id correto", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    await waitFor(() => {
      expect(resendInvitationMock).toHaveBeenCalledWith("invitation-internal-id-001");
    });
    expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("duplo clique em confirmar reenvio nao gera duas chamadas", async () => {
    const resend = createDeferred<ReturnType<typeof buildResendResult>>();
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockReturnValue(resend.promise);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    const confirmButton = screen.getByRole("button", { name: "Confirmar reenvio" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(resendInvitationMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resend.resolve(buildResendResult());
      await resend.promise;
    });
  });

  it("controles ficam desabilitados durante reenvio", async () => {
    const resend = createDeferred<ReturnType<typeof buildResendResult>>();
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockReturnValue(resend.promise);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(screen.getByRole("button", { name: "Reenviando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Manter convite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar convite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeDisabled();

    await act(async () => {
      resend.resolve(buildResendResult());
      await resend.promise;
    });
  });

  it("sucesso de reenvio sent fecha modal, mostra mensagem e recarrega", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockResolvedValue(buildResendResult("sent"));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("sucesso de reenvio pending mostra mensagem correta", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockResolvedValue(buildResendResult("pending"));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Reenvio processado e aguardando confirmação de entrega.")).toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("sucesso de reenvio failed e tratado como operacao processada", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockResolvedValue(buildResendResult("failed"));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Novo convite criado, mas o envio do e-mail falhou.")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível reenviar o convite")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("sucesso de reenvio not_configured e tratado como operacao processada", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockResolvedValue(buildResendResult("not_configured"));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Novo convite criado, mas o envio de e-mail não está configurado.")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível reenviar o convite")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("erro 409 de reenvio permanece como erro de acao seguro", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "ACCOUNT_INVITATION_NOT_RESENDABLE",
        message: "ACCOUNT_INVITATION_NOT_RESENDABLE",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(
      await screen.findByText("Este convite não pode mais ser reenviado. Atualize a lista para consultar o estado atual."),
    ).toBeInTheDocument();
    expect(screen.getByText("Não foi possível reenviar o convite")).toBeInTheDocument();
    expect(screen.queryByText("ACCOUNT_INVITATION_NOT_RESENDABLE")).not.toBeInTheDocument();
  });

  it("erro 409 de reenvio nao altera item localmente", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "ACCOUNT_INVITATION_NOT_RESENDABLE",
        message: "ACCOUNT_INVITATION_NOT_RESENDABLE",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Este convite não pode mais ser reenviado. Atualize a lista para consultar o estado atual.")).toBeInTheDocument();
    expect(screen.getAllByText("Aguardando aceite").length).toBeGreaterThan(0);
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("erro 429 de reenvio nao dispara retry automatico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "RATE_LIMITED",
        message: "Muitas tentativas. Tente novamente em cerca de 1 minuto.",
        retryAfterSeconds: 60,
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Muitas tentativas. Tente novamente em cerca de 1 minuto.")).toBeInTheDocument();
    expect(resendInvitationMock).toHaveBeenCalledTimes(1);
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede de reenvio permite nova tentativa explicita", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }))
      .mockResolvedValueOnce(buildResendResult());

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    await waitFor(() => expect(resendInvitationMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
  });

  it("erro 401 de reenvio usa mensagem segura do servico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "UNAUTHORIZED",
        message: "Sessão expirada. Entre novamente.",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Sessão expirada. Entre novamente.")).toBeInTheDocument();
    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("erro 403 de reenvio usa mensagem segura do servico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "FORBIDDEN",
        message: "Você não tem permissão para reenviar este convite.",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    expect(
      await screen.findByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));
    await waitFor(() => {
      expect(resendInvitationMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i }),
      ).not.toBeInTheDocument();
    });

    expect(await screen.findByText("Você não tem permissão para reenviar este convite.")).toBeInTheDocument();
    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("nova acao de reenvio limpa erro anterior", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    expect(
      await screen.findByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Nao foi possivel conectar ao backend local agora.")).not.toBeInTheDocument();
    });
  });

  it("reenvio nao constroi token ou url de ativacao", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockResolvedValue(buildResendResult());

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("token");
    expect(document.body).not.toHaveTextContent("https://");
    expect(document.body).not.toHaveTextContent("/ativar");
  });
});
