import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageText } from "@/components/MessageText";

describe("MessageText", () => {
  it("reveals and hides spoilers with an accessible toggle", () => {
    render(<MessageText text="Antes ||segredo|| depois" byName={{}} onMention={() => {}} />);

    const revealButton = screen.getByRole("button", { name: "Revelar spoiler" });
    expect(revealButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(revealButton);

    const hideButton = screen.getByRole("button", { name: "Ocultar spoiler" });
    expect(hideButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hideButton);

    expect(screen.getByRole("button", { name: "Revelar spoiler" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
