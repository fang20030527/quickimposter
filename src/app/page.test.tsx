import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home SEO content", () => {
  it("presents one keyword-focused H1 without blocking the game", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Free Imposter Game Online for One Phone",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How to play the imposter game" }),
    ).toBeInTheDocument();
    expect(screen.getByText("How many are playing?")).toBeInTheDocument();
  });
});
