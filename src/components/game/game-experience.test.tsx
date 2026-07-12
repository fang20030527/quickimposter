import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GameExperience } from "./game-experience";

describe("GameExperience", () => {
  it("starts a six-player game at Player 1 handoff", async () => {
    const user = userEvent.setup();
    render(<GameExperience />);

    await user.click(screen.getByRole("button", { name: "6 players" }));
    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(
      screen.getByRole("heading", { name: "Pass to Player 1" }),
    ).toBeInTheDocument();
  });
});
