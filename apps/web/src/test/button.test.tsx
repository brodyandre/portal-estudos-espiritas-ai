import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../components/ui/Button";

describe("Button", () => {
  it("renderiza a variante destructive preservando disabled", () => {
    render(
      <Button disabled variant="destructive">
        Remover acesso
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Remover acesso" });

    expect(button).toHaveClass("button--destructive");
    expect(button).toBeDisabled();
  });
});
