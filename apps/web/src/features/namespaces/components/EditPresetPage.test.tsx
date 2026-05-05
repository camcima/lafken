import type { NamespacePresetResponseDTO, NamespaceResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { EditPresetPage } from "./EditPresetPage";

// ── Shared mock state ──────────────────────────────────────
const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
let mockNamespace: NamespaceResponseDTO | undefined;
let mockPresets: NamespacePresetResponseDTO[] = [];

const SLUG = "aircraft-photos";
const PRESET_NAME = "thumbnail-sm";

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

const samplePreset: NamespacePresetResponseDTO = {
  name: PRESET_NAME,
  version: 2,
  params: {
    fit: "cover",
    format: "webp",
    quality: 75,
    width: 400,
    height: 300,
  },
  active: true,
  preGenerate: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ── Module mocks ───────────────────────────────────────────
vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespace: () => ({
    data: mockNamespace,
    isLoading: false,
  }),
  useNamespacePresets: () => ({
    data: mockPresets,
    isLoading: false,
  }),
  useUpdatePresetVersion: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
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
    useParams: () => ({ slug: SLUG, name: PRESET_NAME }),
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
      <EditPresetPage />
    </Wrapper>,
  );
}

// ── Test suite ─────────────────────────────────────────────
describe("EditPresetPage", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockNamespace = sampleNamespace;
    mockPresets = [samplePreset];
  });

  it("renders prefilled with the latest version's params", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/quality/i)).toHaveValue(75);
    });

    expect(screen.getByLabelText(/fit/i)).toHaveValue("cover");
    expect(screen.getByLabelText(/format/i)).toHaveValue("webp");
    expect(screen.getByLabelText(/width/i)).toHaveValue(400);
    expect(screen.getByLabelText(/height/i)).toHaveValue(300);
  });

  it("disables Save until at least one field is dirty", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/quality/i)).toHaveValue(75);
    });

    // Save button is disabled when form is pristine
    const saveButton = screen.getByRole("button", { name: /save preset/i });
    expect(saveButton).toBeDisabled();

    // Changing a field marks the form dirty → Save is enabled
    await user.clear(screen.getByLabelText(/quality/i));
    await user.type(screen.getByLabelText(/quality/i), "90");

    expect(saveButton).not.toBeDisabled();
  });

  it("calls useUpdatePresetVersion with the right payload on submit", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/quality/i)).toHaveValue(75);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/quality/i));
    await user.type(screen.getByLabelText(/quality/i), "90");

    await user.click(screen.getByRole("button", { name: /save preset/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        slug: SLUG,
        name: PRESET_NAME,
        input: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          params: expect.objectContaining({
            fit: "cover",
            format: "webp",
            quality: 90,
          }),
        },
      });
    });
  });

  it("navigates to detail page on success", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/quality/i)).toHaveValue(75);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/quality/i));
    await user.type(screen.getByLabelText(/quality/i), "90");

    await user.click(screen.getByRole("button", { name: /save preset/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/namespaces/$slug",
        params: { slug: SLUG },
        search: { tab: "presets" },
      });
    });
  });

  it("displays a form-level error mapped from preset-version-conflict-error", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/preset-version-conflict-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Preset version conflict.",
    };
    mockMutateAsync.mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/quality/i)).toHaveValue(75);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/quality/i));
    await user.type(screen.getByLabelText(/quality/i), "90");

    await user.click(screen.getByRole("button", { name: /save preset/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/another operator edited this preset/i);
    });
  });

  it("redirects when namespace is archived", async () => {
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

  it("renders the past versions panel with version history", async () => {
    const v1Preset: NamespacePresetResponseDTO = {
      name: PRESET_NAME,
      version: 1,
      params: { fit: "cover", format: "webp", quality: 60, width: 400, height: 300 },
      active: false,
      preGenerate: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    mockPresets = [samplePreset, v1Preset];
    renderPage();

    await waitFor(() => {
      // Panel header
      expect(screen.getByText(/past versions/i)).toBeInTheDocument();
    });

    // Both versions listed as buttons (sorted desc: v2, v1)
    const versionButtons = screen.getAllByRole("button", { name: /^v\d/ });
    expect(versionButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'Back to latest' in panel when a past version is selected", async () => {
    const user = userEvent.setup();
    const v1Preset: NamespacePresetResponseDTO = {
      name: PRESET_NAME,
      version: 1,
      params: { fit: "cover", format: "webp", quality: 60, width: 400, height: 300 },
      active: false,
      preGenerate: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    mockPresets = [samplePreset, v1Preset];
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/past versions/i)).toBeInTheDocument();
    });

    // Initially no "Back to latest" (we are already on v2)
    expect(screen.queryByText(/back to latest/i)).not.toBeInTheDocument();

    // Click v1 in the panel
    const v1Btn = screen.getByRole("button", { name: /v1/ });
    await user.click(v1Btn);

    // "Back to latest" should now appear
    expect(screen.getByText(/back to latest/i)).toBeInTheDocument();
  });
});
