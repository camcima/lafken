import type {
  AssetResponseDTO,
  LegalHoldResponseDTO,
  ListAssetsQueryDTO,
  NamespaceResponseDTO,
  PaginatedResult,
  PlaceLegalHoldRequestDTO,
} from "@shared/backend-api";
import {
  LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
  LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MIN_LENGTH,
} from "@shared/backend-api/validation";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "@/lib/test/render-with-router";

import { PlaceLegalHoldPage } from "./PlaceLegalHoldPage";

// ── SDK client mocks (network boundary) ─────────────────────────────────────
// AssetImage requires a LafkenProvider; stub it out in unit tests. The
// remaining hooks (useAssets/useNamespaces/usePlaceLegalHold) are real —
// only the underlying SDK client calls they make are mocked here.
const listAssetsMock =
  vi.fn<(query: Partial<ListAssetsQueryDTO>) => Promise<PaginatedResult<AssetResponseDTO>>>();
const listNamespacesMock =
  vi.fn<
    (query: { page?: number; limit?: number }) => Promise<PaginatedResult<NamespaceResponseDTO>>
  >();
const placeMock = vi.fn<(input: PlaceLegalHoldRequestDTO) => Promise<LegalHoldResponseDTO>>();

vi.mock("@lafken/react", () => ({
  AssetImage: () => null,
  useLafkenClient: () => ({
    assets: { list: (q: Partial<ListAssetsQueryDTO>) => listAssetsMock(q) },
    namespaces: {
      list: (q: { page?: number; limit?: number }) => listNamespacesMock(q),
    },
    legalHolds: { place: (input: PlaceLegalHoldRequestDTO) => placeMock(input) },
  }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────
// publicIds must be real UUIDs — the form's Zod schema validates assetIds
// with z.uuid(), matching the wire contract (assetIds are asset publicIds).
const ASSET_ONE: AssetResponseDTO = {
  id: "01977b7a-0000-7000-8000-000000000001",
  publicId: "b7e6c2b0-1111-4a11-8a11-111111111111",
  namespaceSlug: "fleet-photos",
  policyVersion: 1,
  state: "ready",
  customMetadata: {},
  tags: [],
  legalHold: false,
  stateChangedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  mimeType: "image/jpeg",
};

const ASSET_TWO_ALREADY_HELD: AssetResponseDTO = {
  id: "01977b7a-0000-7000-8000-000000000002",
  publicId: "b7e6c2b0-2222-4a11-8a11-222222222222",
  namespaceSlug: "fleet-photos",
  policyVersion: 1,
  state: "ready",
  customMetadata: {},
  tags: [],
  legalHold: true,
  stateChangedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  mimeType: "image/jpeg",
};

const NAMESPACE: NamespaceResponseDTO = {
  slug: "fleet-photos",
  displayName: "Fleet Photos",
  description: undefined,
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const PLACED_HOLD: LegalHoldResponseDTO = {
  id: "01977b7a-0000-7000-8000-000000000099",
  caseReference: "CHL-AVN-2026-014",
  description: "Investigation per DGAC requirement.",
  scopeSummary: "assets:1",
  placedBy: "carlos.cima@latam.com",
  placedAt: new Date().toISOString(),
  active: true,
  affectedAssetCount: 1,
};

// ── Render helper ──────────────────────────────────────────────────────────
function renderPage(initialUrl = "/legal-holds/new") {
  return renderWithRouter(
    { path: "legal-holds/new", index: false, component: PlaceLegalHoldPage },
    initialUrl,
  );
}

async function renderReady() {
  const result = await renderPage();
  await screen.findByLabelText(/case reference/i);
  return result;
}

async function fillValidCaseAndReason(): Promise<void> {
  await userEvent.type(await screen.findByLabelText(/case reference/i), "CHL-AVN-2026-014");
  await userEvent.type(
    screen.getByLabelText(/reason \/ counsel note/i),
    "Investigation per DGAC requirement.",
  );
}

async function pickFirstAsset(): Promise<void> {
  const assetButtons = await screen.findAllByRole("button", { name: /^add$/i });
  await userEvent.click(assetButtons[0]);
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  listAssetsMock.mockReset();
  listNamespacesMock.mockReset();
  placeMock.mockReset();
  listAssetsMock.mockResolvedValue({
    data: [ASSET_ONE, ASSET_TWO_ALREADY_HELD],
    total: 2,
    page: 1,
    limit: 25,
    lastPage: 1,
  });
  listNamespacesMock.mockResolvedValue({
    data: [NAMESPACE],
    total: 1,
    page: 1,
    limit: 100,
    lastPage: 1,
  });
  placeMock.mockResolvedValue(PLACED_HOLD);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PlaceLegalHoldPage", () => {
  // Pre-existing test, adapted: the old design silently disabled the submit
  // button on an incomplete form (no field errors, `canSubmit` gating). That
  // is the exact anti-pattern F-W6 removes — the button is no longer
  // disabled up front; instead, an invalid submit surfaces field errors and
  // still does not call the mutation. This test preserves the original
  // intent ("an incomplete form cannot successfully submit") under the new
  // mechanism.
  it("does not disable the submit button up front, but blocks submission of an empty form with field errors", async () => {
    await renderReady();
    const submitBtn = screen.getByRole("button", { name: /place hold/i });
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);

    expect(await screen.findByText(/case reference must be 3–100 characters/i)).toBeInTheDocument();
    expect(placeMock).not.toHaveBeenCalled();
  });

  // Pre-existing test, adapted: now asserts the mutation is called through
  // the real client (not a mocked hook) with the correct wire body. This is
  // also the wire-body test required by the task brief — it fails if
  // `assetInternalIds` ever leaks onto the request (forbidNonWhitelisted
  // would 400 the whole request in production).
  it("calls legalHolds.place with the exact wire body (publicIds only, no assetInternalIds) on a valid submit", async () => {
    await renderReady();

    await fillValidCaseAndReason();
    await pickFirstAsset();
    await userEvent.click(screen.getByRole("checkbox"));

    const submitBtn = screen.getByRole("button", { name: /place hold/i });
    expect(submitBtn).not.toBeDisabled();
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(placeMock).toHaveBeenCalledTimes(1);
    });
    // Exact equality (not objectContaining) — an extra assetInternalIds key
    // would fail this assertion, proving the wire body stays clean.
    expect(placeMock).toHaveBeenCalledWith({
      caseReference: "CHL-AVN-2026-014",
      description: "Investigation per DGAC requirement.",
      assetIds: [ASSET_ONE.publicId],
    });
  });

  it("renders all four section headings", async () => {
    await renderReady();
    expect(screen.getByText(/^Case$/i)).toBeInTheDocument();
    expect(screen.getByText(/find & pick assets/i)).toBeInTheDocument();
    expect(screen.getByText(/^Reason$/i)).toBeInTheDocument();
    expect(screen.getByText(/effects & acknowledgement/i)).toBeInTheDocument();
  });

  it("renders the already-held badge on assets with legalHold=true", async () => {
    await renderReady();
    expect(await screen.findByText(/already held/i)).toBeInTheDocument();
  });

  it("basket shows picked asset chips after picking an asset", async () => {
    await renderReady();

    await pickFirstAsset();

    const matches = screen.getAllByText(ASSET_ONE.publicId);
    expect(matches.length).toBeGreaterThan(0);
  });

  // ── New validation tests (F-W6) ─────────────────────────────────────────

  it("shows a field error when the case reference is too short on submit", async () => {
    await renderReady();

    await userEvent.type(
      await screen.findByLabelText(/case reference/i),
      "AB", // < LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH chars
    );
    await userEvent.click(screen.getByRole("button", { name: /place hold/i }));

    expect(await screen.findByText(/case reference must be 3–100 characters/i)).toBeInTheDocument();
    expect(placeMock).not.toHaveBeenCalled();
  });

  it("shows an error when no asset is selected", async () => {
    await renderReady();

    await fillValidCaseAndReason();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /place hold/i }));

    expect(await screen.findByText(/select at least one asset/i)).toBeInTheDocument();
    expect(placeMock).not.toHaveBeenCalled();
  });

  it("shows an error when the acknowledgement checkbox is left unchecked", async () => {
    await renderReady();

    await fillValidCaseAndReason();
    await pickFirstAsset();
    await userEvent.click(screen.getByRole("button", { name: /place hold/i }));

    expect(await screen.findByText(/must acknowledge the hold implications/i)).toBeInTheDocument();
    expect(placeMock).not.toHaveBeenCalled();
  });

  // These bounds are asserted directly against the shared LEGAL_HOLD_*
  // constants (not local literals) so drift between this form and
  // PlaceLegalHoldRequestDTO's class-validator decorators fails this test.
  it("rejects a case reference one character over LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH while accepting one at the bound", async () => {
    await renderReady();
    const input = screen.getByLabelText(/case reference/i);

    fireEvent.change(input, {
      target: { value: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).not.toHaveAttribute("aria-invalid");
    });

    fireEvent.change(input, {
      target: { value: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH + 1) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("rejects a case reference one character under LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH while accepting one at the bound", async () => {
    await renderReady();
    const input = screen.getByLabelText(/case reference/i);

    fireEvent.change(input, {
      target: { value: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH - 1) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    fireEvent.change(input, {
      target: { value: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).not.toHaveAttribute("aria-invalid");
    });
  });

  it("rejects a description one character over LEGAL_HOLD_DESCRIPTION_MAX_LENGTH while accepting one at the bound", async () => {
    await renderReady();
    const input = screen.getByLabelText(/reason \/ counsel note/i);

    fireEvent.change(input, {
      target: { value: "y".repeat(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).not.toHaveAttribute("aria-invalid");
    });

    fireEvent.change(input, {
      target: { value: "y".repeat(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH + 1) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("rejects a description one character under LEGAL_HOLD_DESCRIPTION_MIN_LENGTH while accepting one at the bound", async () => {
    await renderReady();
    const input = screen.getByLabelText(/reason \/ counsel note/i);

    fireEvent.change(input, {
      target: { value: "y".repeat(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH - 1) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    fireEvent.change(input, {
      target: { value: "y".repeat(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH) },
    });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(input).not.toHaveAttribute("aria-invalid");
    });
  });

  // ── Unsaved-changes guard (F-W6, Task 12) ───────────────────────────────
  // Exercised end-to-end against the real router (no mock of
  // useUnsavedChangesGuard or @tanstack/react-router), matching the harness
  // this suite was converted to.

  it("prompts before navigating away once the form is dirty", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { router } = await renderReady();

    await userEvent.type(screen.getByLabelText(/case reference/i), "A");
    await userEvent.click(screen.getByRole("link", { name: /back to legal holds/i }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/legal-holds/new");

    vi.restoreAllMocks();
  });

  it("does not prompt when navigating away after a successful submit", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderReady();

    await fillValidCaseAndReason();
    await pickFirstAsset();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /place hold/i }));

    await waitFor(() => {
      expect(placeMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(window.confirm).not.toHaveBeenCalled();
    });

    vi.restoreAllMocks();
  });
});
