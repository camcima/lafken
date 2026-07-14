import type { NamespaceResponseDTO } from "@shared/backend-api";
import {
  PRESET_DIMENSION_MAX,
  PRESET_DIMENSION_MIN,
  PRESET_DPR_MAX,
  PRESET_DPR_MIN,
  PRESET_QUALITY_MAX,
  PRESET_QUALITY_MIN,
} from "@shared/backend-api/validation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreatePreset } from "@/features/namespaces/hooks/useNamespaces";
import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NewPresetPage } from "./NewPresetPage";

// ── Shared mock state ──────────────────────────────────────
const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
let mockNamespace: NamespaceResponseDTO | undefined;

const SLUG = "aircraft-photos";

const sampleNamespace: NamespaceResponseDTO = {
  slug: SLUG,
  displayName: "Aircraft Photos",
  description: "Sample description",
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod-main",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const archivedNamespace: NamespaceResponseDTO = {
  slug: SLUG,
  displayName: "Aircraft Photos",
  description: "Sample description",
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod-main",
  archivedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Module mocks ───────────────────────────────────────────
vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespace: () => ({
    data: mockNamespace,
    isLoading: false,
  }),
  useCreatePreset: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: ReactNode;
      to: string;
      params?: Record<string, string>;
      [k: string]: unknown;
    }) => {
      const href = params ? to.replace(/\$(\w+)/g, (_, key: string) => params[key] ?? "") : to;
      return (
        <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    },
    useNavigate: () => mockNavigate,
    useParams: () => ({ slug: SLUG }),
  };
});

// ── Render helper ──────────────────────────────────────────
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    );
  }
  return render(
    <Wrapper>
      <NewPresetPage />
    </Wrapper>,
  );
}

// ── Test suite ─────────────────────────────────────────────
describe("NewPresetPage", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockNamespace = sampleNamespace;
    vi.mocked(useCreatePreset).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreatePreset>);
  });

  it("renders the form with default values", () => {
    renderPage();

    expect(screen.getByLabelText(/name/i)).toHaveValue("");

    // Fit is now a radio-card group; the cover card should be checked.
    expect(screen.getByRole("radio", { name: /cover/i })).toBeChecked();

    expect(screen.getByLabelText(/format/i)).toHaveValue("auto");

    // Quality is a slider + numeric pair sharing the same accessible name.
    expect(screen.getByRole("spinbutton", { name: /quality/i })).toHaveValue(80);
  });

  // Proves the rendered dimension/quality/DPR bounds are wired to the shared
  // PRESET_* validation constants — the same ones the backend
  // CreatePresetRequestDTO enforces (shared/backend-api/presentation/namespaces/__tests__)
  // and the Zod schema in preset-params.schema.ts reads — rather than to
  // local literals that could silently drift from either.
  it("renders width/height/dpr/quality bounds equal to the shared PRESET_* constants", () => {
    renderPage();

    expect(screen.getByLabelText(/width/i)).toHaveAttribute("min", String(PRESET_DIMENSION_MIN));
    expect(screen.getByLabelText(/width/i)).toHaveAttribute("max", String(PRESET_DIMENSION_MAX));
    expect(screen.getByLabelText(/height/i)).toHaveAttribute("min", String(PRESET_DIMENSION_MIN));
    expect(screen.getByLabelText(/height/i)).toHaveAttribute("max", String(PRESET_DIMENSION_MAX));
    expect(screen.getByLabelText(/dpr/i)).toHaveAttribute("min", String(PRESET_DPR_MIN));
    expect(screen.getByLabelText(/dpr/i)).toHaveAttribute("max", String(PRESET_DPR_MAX));
    expect(screen.getByRole("spinbutton", { name: /quality/i })).toHaveAttribute(
      "min",
      String(PRESET_QUALITY_MIN),
    );
    expect(screen.getByRole("spinbutton", { name: /quality/i })).toHaveAttribute(
      "max",
      String(PRESET_QUALITY_MAX),
    );
  });

  it("disables submit while pending", () => {
    vi.mocked(useCreatePreset).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    } as unknown as ReturnType<typeof useCreatePreset>);

    renderPage();
    const submitBtn = screen.getByRole("button", { name: /create preset/i });
    expect(submitBtn).toBeDisabled();
  });

  it("calls useCreatePreset with the correct payload on submit", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(undefined);
    renderPage();

    await user.type(screen.getByLabelText(/name/i), "thumbnail-sm");

    // Width and height remain empty (optional), quality is 80 (default)
    await user.click(screen.getByRole("button", { name: /create preset/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        slug: SLUG,
        input: {
          name: "thumbnail-sm",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          params: expect.objectContaining({
            fit: "cover",
            format: "auto",
            quality: 80,
          }),
        },
      });
    });
  });

  it("navigates to detail page (presets tab) on success", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(undefined);
    renderPage();

    await user.type(screen.getByLabelText(/name/i), "thumbnail-sm");
    await user.click(screen.getByRole("button", { name: /create preset/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/namespaces/$slug",
        params: { slug: SLUG },
        search: { tab: "presets" },
      });
    });
  });

  it("sets a name field-level error when duplicate-name response received", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/preset-name-already-exists-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "A preset with this name already exists.",
    };
    mockMutateAsync.mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));
    renderPage();

    await user.type(screen.getByLabelText(/name/i), "existing-preset");
    await user.click(screen.getByRole("button", { name: /create preset/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it("redirects when the namespace is archived", async () => {
    mockNamespace = archivedNamespace;
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/namespaces/$slug",
        params: { slug: SLUG },
        search: { tab: "presets" },
      });
    });
  });
});
