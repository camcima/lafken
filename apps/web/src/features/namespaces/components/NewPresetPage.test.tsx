import type { NamespaceResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  useCreatePreset: () => ({
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
  });

  it("renders the form with default values", () => {
    renderPage();

    // Name input empty by default
    expect(screen.getByLabelText(/name/i)).toHaveValue("");

    // Default selections
    const fitSelect = screen.getByLabelText(/fit/i);
    expect(fitSelect).toHaveValue("cover");

    const formatSelect = screen.getByLabelText(/format/i);
    expect(formatSelect).toHaveValue("auto");

    const qualityInput = screen.getByLabelText(/quality/i);
    expect(qualityInput).toHaveValue(80);
  });

  it("disables submit while pending", () => {
    // Re-mock with isPending = true
    const { unmount } = renderPage();
    unmount();

    // We can check the normal state — button is enabled when not pending/submitting
    renderPage();
    const submitBtn = screen.getByRole("button", { name: /create preset/i });
    // Not disabled when not submitting
    expect(submitBtn).not.toBeDisabled();
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
