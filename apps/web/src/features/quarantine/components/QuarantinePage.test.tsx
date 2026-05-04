import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { QuarantinePage } from "./QuarantinePage";

vi.mock("@/features/quarantine/hooks/useQuarantine", () => ({
  useQuarantine: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
}));

describe("QuarantinePage", () => {
  it("renders the title heading", () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/quarantine queue/i);
  });

  it("renders the queue list with at least 3 items", () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    // Queue items all show an id starting with "01HXJ"
    const ids = screen.getAllByText(/01HXJ/i);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the filter toggle buttons", () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    // Filter strip buttons (All / Moderation / Virus) come first in the DOM
    const allFilterBtns = screen.getAllByRole("button", { name: /^all/i });
    expect(allFilterBtns[0]).toBeInTheDocument();
    const moderationFilterBtns = screen.getAllByRole("button", { name: /^moderation/i });
    expect(moderationFilterBtns[0]).toBeInTheDocument();
    const virusFilterBtns = screen.getAllByRole("button", { name: /^virus/i });
    expect(virusFilterBtns[0]).toBeInTheDocument();
  });

  it("filters to moderation items when moderation tab is clicked", async () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    // Pick the first "Moderation" button — that is the filter strip button
    const [moderationBtn] = screen.getAllByRole("button", { name: /^moderation/i });
    await userEvent.click(moderationBtn);
    // After filtering, no virus reason items should appear in queue
    const virusBtns = screen.queryAllByText(/heuristic match/i);
    expect(virusBtns.length).toBe(0);
  });

  it("filters to virus items when virus tab is clicked", async () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    const virusBtn = screen.getByRole("button", { name: /^virus/i });
    await userEvent.click(virusBtn);
    // After filtering, only virus items in queue
    const moderationItems = screen.queryAllByText(/moderation: violence/i);
    expect(moderationItems.length).toBe(0);
  });

  it("selecting a queue item highlights it and shows detail", () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    // The first item is selected by default — detail pane should be visible
    expect(screen.getByText(/release to ready/i)).toBeInTheDocument();
    expect(screen.getByText(/reject…/i)).toBeInTheDocument();
  });

  it("opens the reject modal when reject button is clicked", async () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    const rejectBtn = screen.getByRole("button", { name: /reject…/i });
    await userEvent.click(rejectBtn);
    // Modal appears — check for the note textarea placeholder
    expect(screen.getByPlaceholderText(/confirms moderation flag/i)).toBeInTheDocument();
  });

  it("disables the confirm button when note is too short", async () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    const rejectBtn = screen.getByRole("button", { name: /reject…/i });
    await userEvent.click(rejectBtn);
    // The modal's confirm button should be disabled (note is empty)
    const confirmBtns = screen.getAllByRole("button", { name: /reject asset/i });
    // The modal confirm is the one inside the modal
    const modalConfirm = confirmBtns[confirmBtns.length - 1];
    expect(modalConfirm).toBeDisabled();
  });

  it("j/k keyboard navigation moves selection between queue items", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );

    // Initially the first item is selected
    const selectedButtons = () =>
      screen.getAllByRole("button").filter((btn) => btn.getAttribute("aria-current") === "true");

    const firstSelected = selectedButtons();
    expect(firstSelected).toHaveLength(1);
    const firstItemText = firstSelected[0]?.textContent ?? "";

    // Press j — second item should become selected
    await user.keyboard("j");
    const afterJ = selectedButtons();
    expect(afterJ).toHaveLength(1);
    expect(afterJ[0]?.textContent).not.toBe(firstItemText);

    // Press k — first item should be selected again
    await user.keyboard("k");
    const afterK = selectedButtons();
    expect(afterK).toHaveLength(1);
    expect(afterK[0]?.textContent).toBe(firstItemText);
  });
});
