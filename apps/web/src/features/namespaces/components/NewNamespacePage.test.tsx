import type { NamespaceResponseDTO, StorageBindingResponseDTO } from "@shared/backend-api";
import {
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
  NAMESPACE_SLUG_MAX_LENGTH,
  POLICY_MAX_FILE_SIZE_BYTES,
  POLICY_MAX_RETENTION_DAYS,
  POLICY_MAX_SIGNED_URL_BUCKET_SIZE,
  POLICY_MAX_TTL_SECONDS,
} from "@shared/backend-api/validation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NewNamespacePage } from "./NewNamespacePage";

// ── Shared mock state ──────────────────────────────────────
const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
let mockBindings: StorageBindingResponseDTO[] = [];
let mockBindingsLoading = false;

const sampleBinding: StorageBindingResponseDTO = {
  id: "01900000-0000-7000-8000-000000000001",
  name: "gcs-prod-main",
  adapterType: "gcs",
  config: { bucket: "lafken-bucket", projectId: "lafken-project" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const sampleCreated: NamespaceResponseDTO = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod-main",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Module mocks ───────────────────────────────────────────
vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useCreateNamespace: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/features/system/hooks/useSystem", () => ({
  useStorageBindings: () => ({ data: mockBindings, isLoading: mockBindingsLoading }),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: {
      children: ReactNode;
      to: string;
      [k: string]: unknown;
    }) => (
      <a href={to} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
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
      <NewNamespacePage />
    </Wrapper>,
  );
}

// ── Test suite ─────────────────────────────────────────────
describe("NewNamespacePage", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockBindings = [sampleBinding];
    mockBindingsLoading = false;
  });

  it("renders all six sections with secure defaults pre-filled", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /^identity$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^storage$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^validation$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^lifecycle$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^serving$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^advanced$/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("");
    expect(screen.getByLabelText(/max file size/i)).toHaveValue(52_428_800);
    expect(screen.getByLabelText(/require virus scan/i)).toBeChecked();
  });

  // Proves the rendered form bounds are wired to the shared validation
  // constants — the same ones the backend CreateNamespaceRequestDTO enforces
  // (shared/backend-api/presentation/namespaces/__tests__) — rather than to
  // local literals that could silently drift from the backend.
  it("renders numeric field bounds equal to the shared POLICY_* constants", () => {
    renderPage();

    expect(screen.getByLabelText(/max file size/i)).toHaveAttribute(
      "max",
      String(POLICY_MAX_FILE_SIZE_BYTES),
    );
    expect(screen.getByLabelText(/retention.*days/i)).toHaveAttribute(
      "max",
      String(POLICY_MAX_RETENTION_DAYS),
    );
    expect(screen.getByLabelText(/signed url ttl/i)).toHaveAttribute(
      "max",
      String(POLICY_MAX_TTL_SECONDS),
    );
    expect(screen.getByLabelText(/signed url bucket size/i)).toHaveAttribute(
      "max",
      String(POLICY_MAX_SIGNED_URL_BUCKET_SIZE),
    );
  });

  // Proves the client-side Zod schema's slug/displayName/description bounds
  // are derived from the shared NAMESPACE_* constants — the same ones
  // CreateNamespaceRequestDTO enforces on the backend
  // (shared/backend-api/presentation/namespaces/__tests__) — rather than
  // local literals that could silently drift from the backend.
  it("rejects a slug one character over NAMESPACE_SLUG_MAX_LENGTH while accepting one at the bound", async () => {
    renderPage();

    const slugInput = screen.getByLabelText(/^slug$/i);

    fireEvent.change(slugInput, { target: { value: "a".repeat(NAMESPACE_SLUG_MAX_LENGTH) } });
    fireEvent.blur(slugInput);
    await waitFor(() => {
      expect(slugInput).not.toHaveAttribute("aria-invalid");
    });

    fireEvent.change(slugInput, { target: { value: "a".repeat(NAMESPACE_SLUG_MAX_LENGTH + 1) } });
    fireEvent.blur(slugInput);
    await waitFor(() => {
      expect(slugInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  // Discriminates the slug *pattern* (NAMESPACE_SLUG_PATTERN) from the slug
  // *length* (NAMESPACE_SLUG_MAX_LENGTH): a slug well within the length
  // bound but violating the pattern must still be rejected.
  it("rejects an uppercase slug that satisfies NAMESPACE_SLUG_MAX_LENGTH but violates NAMESPACE_SLUG_PATTERN", async () => {
    renderPage();

    const slugInput = screen.getByLabelText(/^slug$/i);

    fireEvent.change(slugInput, { target: { value: "Aircraft-Photos" } });
    fireEvent.blur(slugInput);
    await waitFor(() => {
      expect(slugInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("rejects a displayName one character over NAMESPACE_DISPLAY_NAME_MAX_LENGTH while accepting one at the bound", async () => {
    renderPage();

    const displayNameInput = screen.getByLabelText(/^display name$/i);

    fireEvent.change(displayNameInput, {
      target: { value: "d".repeat(NAMESPACE_DISPLAY_NAME_MAX_LENGTH) },
    });
    fireEvent.blur(displayNameInput);
    await waitFor(() => {
      expect(displayNameInput).not.toHaveAttribute("aria-invalid");
    });

    fireEvent.change(displayNameInput, {
      target: { value: "d".repeat(NAMESPACE_DISPLAY_NAME_MAX_LENGTH + 1) },
    });
    fireEvent.blur(displayNameInput);
    await waitFor(() => {
      expect(displayNameInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("rejects a description one character over NAMESPACE_DESCRIPTION_MAX_LENGTH while accepting one at the bound", async () => {
    renderPage();

    const descriptionInput = screen.getByLabelText(/description/i);

    fireEvent.change(descriptionInput, {
      target: { value: "d".repeat(NAMESPACE_DESCRIPTION_MAX_LENGTH) },
    });
    fireEvent.blur(descriptionInput);
    await waitFor(() => {
      expect(descriptionInput).not.toHaveAttribute("aria-invalid");
    });

    fireEvent.change(descriptionInput, {
      target: { value: "d".repeat(NAMESPACE_DESCRIPTION_MAX_LENGTH + 1) },
    });
    fireEvent.blur(descriptionInput);
    await waitFor(() => {
      expect(descriptionInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("renders a live YAML preview that reflects the current slug", async () => {
    const user = userEvent.setup();
    renderPage();

    const preview = screen.getByLabelText(/yaml/i);
    expect(preview.textContent).toMatch(/slug: <slug>/);

    await user.type(screen.getByLabelText(/^slug$/i), "aircraft-photos");
    expect(preview.textContent).toMatch(/slug: aircraft-photos/);
  });

  it("disables Save and shows a warning when there are no storage bindings", () => {
    mockBindings = [];
    renderPage();

    // Warning alert is displayed
    const alert = screen.getByText(/no storage bindings configured/i);
    expect(alert).toBeInTheDocument();
    expect(alert.closest("[role='alert']")).not.toBeNull();

    // Save button is disabled
    const saveButton = screen.getByRole("button", { name: /create namespace/i });
    expect(saveButton).toBeDisabled();
  });

  it("calls useCreateNamespace mutation with the correct payload on submit", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(sampleCreated);
    renderPage();

    await user.type(screen.getByLabelText(/^slug$/i), "aircraft-photos");
    await user.type(screen.getByLabelText(/^display name$/i), "Aircraft Photos");

    // Storage binding select is populated with sampleBinding
    const storageSelect = screen.getByLabelText(/^storage binding$/i);
    await user.selectOptions(storageSelect, "gcs-prod-main");

    await user.click(screen.getByRole("button", { name: /create namespace/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "aircraft-photos",
          displayName: "Aircraft Photos",
          storageBindingId: "01900000-0000-7000-8000-000000000001",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          policy: expect.objectContaining({
            maxFileSizeBytes: 52_428_800,
            virusScanRequired: true,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            allowedMimeTypes: expect.arrayContaining(["image/jpeg", "image/png", "image/webp"]),
            servingMode: "signed",
          }),
        }),
      );
    });
  });

  it("displays a field error on slug when the API responds with namespace-already-exists", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/namespace-already-exists-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: 'Namespace "aircraft-photos" already exists.',
      params: { slug: "aircraft-photos" },
    };
    mockMutateAsync.mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));

    renderPage();

    await user.type(screen.getByLabelText(/^slug$/i), "aircraft-photos");
    await user.type(screen.getByLabelText(/^display name$/i), "Aircraft Photos");
    await user.selectOptions(screen.getByLabelText(/^storage binding$/i), "gcs-prod-main");

    await user.click(screen.getByRole("button", { name: /create namespace/i }));

    await waitFor(() => {
      // The error message for duplicate slug
      expect(screen.getByText(/namespace with this slug already exists/i)).toBeInTheDocument();
    });

    // The slug input should have aria-invalid=true
    expect(screen.getByLabelText(/^slug$/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("displays a form-level error linking to /system when the API responds with storage-binding-missing", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/storage-binding-missing-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "The selected storage binding no longer exists.",
      params: {},
    };
    mockMutateAsync.mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));

    renderPage();

    await user.type(screen.getByLabelText(/^slug$/i), "aircraft-photos");
    await user.type(screen.getByLabelText(/^display name$/i), "Aircraft Photos");
    await user.selectOptions(screen.getByLabelText(/^storage binding$/i), "gcs-prod-main");

    await user.click(screen.getByRole("button", { name: /create namespace/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/storage binding no longer exists/i);
    });

    // There should be a link to /system inside the alert
    const alert = screen.getByRole("alert");
    const systemLink = alert.querySelector('a[href="/system"]');
    expect(systemLink).not.toBeNull();
  });

  it("navigates to /namespaces/:slug on successful create", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(sampleCreated);

    renderPage();

    await user.type(screen.getByLabelText(/^slug$/i), "aircraft-photos");
    await user.type(screen.getByLabelText(/^display name$/i), "Aircraft Photos");
    await user.selectOptions(screen.getByLabelText(/^storage binding$/i), "gcs-prod-main");

    await user.click(screen.getByRole("button", { name: /create namespace/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/namespaces/$slug",
        params: { slug: "aircraft-photos" },
      });
    });
  });
});
