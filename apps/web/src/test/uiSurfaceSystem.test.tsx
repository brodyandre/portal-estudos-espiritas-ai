import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusTag } from "../components/ui/StatusTag";
import { TextInput } from "../components/ui/TextInput";

describe("global surface system", () => {
  it("expõe a taxonomia compartilhada de cards sem remover variantes legadas", () => {
    const { container } = render(
      <>
        <Card aria-label="default">Conteúdo</Card>
        <Card aria-label="elevated" tone="elevated">Formulário</Card>
        <Card aria-label="subtle" tone="subtle">Resumo</Card>
        <Card aria-label="interactive" tone="interactive">Navegação</Card>
        <Card aria-label="soft" tone="soft">Legado soft</Card>
        <Card aria-label="brand" tone="brand">Legado brand</Card>
        <Card aria-label="sand" tone="sand">Legado sand</Card>
      </>,
    );

    expect(screen.getByLabelText("default")).toHaveClass("card", "card--default", "card--padded");
    expect(screen.getByLabelText("elevated")).toHaveClass("card--elevated");
    expect(screen.getByLabelText("subtle")).toHaveClass("card--subtle");
    expect(screen.getByLabelText("interactive")).toHaveClass("card--interactive");
    expect(screen.getByLabelText("soft")).toHaveClass("card--soft");
    expect(screen.getByLabelText("brand")).toHaveClass("card--brand");
    expect(screen.getByLabelText("sand")).toHaveClass("card--sand");
    expect(container.querySelectorAll(".card")).toHaveLength(7);
  });

  it("preserva semântica de alertas, badges, status, campos e ações", () => {
    render(
      <>
        <AlertBox title="Atenção" tone="warning">
          Revise antes de continuar.
        </AlertBox>
        <Badge tone="success">Ativo</Badge>
        <StatusTag tone="attention" />
        <TextInput error="Obrigatório" id="surface-email" label="E-mail" />
        <Button variant="destructiveSecondary">Encerrar outras sessões</Button>
      </>,
    );

    expect(screen.getByRole("alert")).toHaveClass("alert-box--warning");
    expect(screen.getByText("Ativo")).toHaveClass("badge--success");
    expect(screen.getByText("Requer revisao")).toHaveClass("status-tag--attention");
    expect(screen.getByRole("textbox")).toHaveClass("field__control--error");
    expect(screen.getByText("Obrigatório")).toHaveClass("field__message--error");
    expect(screen.getByRole("button", { name: "Encerrar outras sessões" })).toHaveClass(
      "button--destructive-secondary",
    );
  });
});
