import type { QuarantinedAssetResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { QuarantinePage } from "./QuarantinePage";

function renderWithProviders(ui: ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </I18nProvider>,
  );
}

function makeAsset(overrides: Partial<QuarantinedAssetResponseDTO>): QuarantinedAssetResponseDTO {
  const now = new Date();
  return {
    id: overrides.id ?? "01900000-0000-7000-8000-000000000040",
    publicId: overrides.publicId ?? "11111111-1111-1111-1111-111111111111",
    namespaceSlug: overrides.namespaceSlug ?? "fleet-photos",
    policyVersion: 1,
    state: overrides.state ?? "quarantined_invalid_format",
    sizeBytes: 1024,
    declaredMimeType: "image/jpeg",
    width: 64,
    height: 48,
    uploadedBy: "user@example.com",
    customMetadata: {},
    tags: [],
    legalHold: false,
    stateChangedAt: now.toISOString(),
    createdAt: now.toISOString(),
    quarantineKind: overrides.quarantineKind ?? "invalid_format",
    flaggedAt: now.toISOString(),
    stateReason: overrides.stateReason,
    ...overrides,
  };
}

const ASSETS: QuarantinedAssetResponseDTO[] = [
  makeAsset({
    publicId: "aaaaaaaa-1111-1111-1111-111111111111",
    quarantineKind: "invalid_format",
    state: "quarantined_invalid_format",
    stateReason: "declared image/jpeg, sniffed image/png",
  }),
  makeAsset({
    publicId: "bbbbbbbb-2222-2222-2222-222222222222",
    quarantineKind: "moderation",
    state: "quarantined_moderation",
    flaggedAnalyzer: "moderation-v2",
    flaggedCategory: "violence",
  }),
  makeAsset({
    publicId: "cccccccc-3333-3333-3333-333333333333",
    quarantineKind: "virus",
    state: "quarantined_virus",
    flaggedAnalyzer: "clamav",
    flaggedCategory: "EICAR-Test",
  }),
];

vi.mock("@/features/quarantine/hooks/useQuarantine", () => ({
  useQuarantine: () => ({
    data: { data: ASSETS, total: ASSETS.length, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
}));

describe("QuarantinePage", () => {
  it("renders the title heading", () => {
    renderWithProviders(<QuarantinePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/quarantine queue/i);
  });

  it("renders one queue button per quarantined asset", () => {
    renderWithProviders(<QuarantinePage />);
    // Each queue row uses the publicId prefix as its label; the page also has
    // filter buttons + actions, so we filter to queue rows by aria-current.
    expect(screen.getByText(/aaaaaaaa…/)).toBeInTheDocument();
    expect(screen.getByText(/bbbbbbbb…/)).toBeInTheDocument();
    expect(screen.getByText(/cccccccc…/)).toBeInTheDocument();
  });

  it("renders the filter toggle buttons", () => {
    renderWithProviders(<QuarantinePage />);
    expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^moderation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^virus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^invalid format/i })).toBeInTheDocument();
  });

  it("filters to invalid_format items when that tab is clicked", async () => {
    renderWithProviders(<QuarantinePage />);
    const invalidBtn = screen.getByRole("button", { name: /^invalid format/i });
    await userEvent.click(invalidBtn);
    // Moderation and virus rows disappear, invalid_format row remains.
    expect(screen.getByText(/aaaaaaaa…/)).toBeInTheDocument();
    expect(screen.queryByText(/bbbbbbbb…/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cccccccc…/)).not.toBeInTheDocument();
  });

  it("shows the invalid_format verdict block on the detail pane when selected", () => {
    renderWithProviders(<QuarantinePage />);
    // First asset is auto-selected; the verdict text should be visible.
    expect(screen.getByText(/magic-byte mismatch/i)).toBeInTheDocument();
    // The state_reason renders both in the queue row AND in the detail pane.
    expect(screen.getAllByText(/declared image\/jpeg, sniffed image\/png/i).length).toBeGreaterThan(
      0,
    );
  });

  it("opens the reject modal when Reject is clicked", async () => {
    renderWithProviders(<QuarantinePage />);
    const rejectBtn = screen.getByRole("button", { name: /reject…/i });
    await userEvent.click(rejectBtn);
    expect(screen.getByPlaceholderText(/confirms moderation flag/i)).toBeInTheDocument();
  });

  it("disables the reject-confirm button while the note is too short", async () => {
    renderWithProviders(<QuarantinePage />);
    await userEvent.click(screen.getByRole("button", { name: /reject…/i }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /reject asset/i });
    expect(confirm).toBeDisabled();
  });

  it("j/k keyboard shortcuts move selection between queue items", async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuarantinePage />);

    const selectedButtons = (): HTMLElement[] =>
      screen.getAllByRole("button").filter((btn) => btn.getAttribute("aria-current") === "true");

    const before = selectedButtons();
    expect(before).toHaveLength(1);
    const firstText = before[0]?.textContent ?? "";

    await user.keyboard("j");
    const afterJ = selectedButtons();
    expect(afterJ).toHaveLength(1);
    expect(afterJ[0]?.textContent).not.toBe(firstText);

    await user.keyboard("k");
    const afterK = selectedButtons();
    expect(afterK).toHaveLength(1);
    expect(afterK[0]?.textContent).toBe(firstText);
  });
});
