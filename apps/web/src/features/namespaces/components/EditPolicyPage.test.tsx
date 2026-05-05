import type { NamespacePolicyResponseDTO, NamespaceResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { EditPolicyPage } from "./EditPolicyPage";

// ── Shared mock state ──────────────────────────────────────
const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
let mockNamespace: NamespaceResponseDTO | undefined;
let mockPolicies: NamespacePolicyResponseDTO[] = [];

const SLUG = "aircraft-photos";

const sampleNamespace: NamespaceResponseDTO = {
  slug: SLUG,
  displayName: "Aircraft Photos",
  description: "Sample description",
  currentPolicyVersion: 3,
  storageBindingName: "gcs-prod-main",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const archivedNamespace: NamespaceResponseDTO = {
  slug: SLUG,
  displayName: "Aircraft Photos",
  description: "Sample description",
  currentPolicyVersion: 3,
  storageBindingName: "gcs-prod-main",
  archivedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const samplePolicy: NamespacePolicyResponseDTO = {
  version: 3,
  maxFileSizeBytes: 10_485_760,
  allowedMimeTypes: ["image/jpeg", "image/heic"],
  virusScanRequired: true,
  retentionDays: 365,
  retentionMode: "delete",
  exifHandling: "preserve",
  immutable: false,
  servingMode: "signed",
  signedUrlTtlSeconds: 7200,
  signedUrlBucketSize: 600,
  contentModeration: { threshold: 0.7 },
  requiredMetadataSchema: undefined,
  retryConfig: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ── Module mocks ───────────────────────────────────────────
vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespace: () => ({
    data: mockNamespace,
    isLoading: false,
  }),
  useNamespacePolicies: () => ({
    data: mockPolicies,
    isLoading: false,
  }),
  useUpdateNamespacePolicy: () => ({
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
      <EditPolicyPage />
    </Wrapper>,
  );
}

// ── Test suite ─────────────────────────────────────────────
describe("EditPolicyPage", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockNamespace = sampleNamespace;
    mockPolicies = [samplePolicy];
  });

  it("renders prefilled with the current policy values", async () => {
    renderPage();

    // Wait for form to be populated via useEffect reset
    await waitFor(() => {
      expect(screen.getByLabelText(/max file size/i)).toHaveValue(10_485_760);
    });

    expect(screen.getByLabelText(/allowed mime types/i)).toHaveValue("image/jpeg, image/heic");
    expect(screen.getByLabelText(/require virus scan/i)).toBeChecked();
    expect(screen.getByLabelText(/retention.*days/i)).toHaveValue(365);
    expect(screen.getByLabelText(/retention mode/i)).toHaveValue("delete");
    expect(screen.getByLabelText(/exif handling/i)).toHaveValue("preserve");
    expect(screen.getByLabelText(/immutable/i)).not.toBeChecked();
    expect(screen.getByLabelText(/serving mode/i)).toHaveValue("signed");
    expect(screen.getByLabelText(/signed url ttl/i)).toHaveValue(7200);
    expect(screen.getByLabelText(/signed url bucket size/i)).toHaveValue(600);
  });

  it("disables Save until at least one field is dirty", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/max file size/i)).toHaveValue(10_485_760);
    });

    // Save button is disabled when form is pristine
    const saveButton = screen.getByRole("button", { name: /save policy/i });
    expect(saveButton).toBeDisabled();

    // Changing a field marks the form as dirty → Save is enabled
    await user.clear(screen.getByLabelText(/max file size/i));
    await user.type(screen.getByLabelText(/max file size/i), "5000000");

    expect(saveButton).not.toBeDisabled();
  });

  it("calls useUpdateNamespacePolicy with the right payload on submit", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/max file size/i)).toHaveValue(10_485_760);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/max file size/i));
    await user.type(screen.getByLabelText(/max file size/i), "20971520");

    await user.click(screen.getByRole("button", { name: /save policy/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        slug: SLUG,
        input: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          policy: expect.objectContaining({
            maxFileSizeBytes: 20_971_520,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            allowedMimeTypes: expect.arrayContaining(["image/jpeg", "image/heic"]),
            virusScanRequired: true,
            retentionDays: 365,
            retentionMode: "delete",
            exifHandling: "preserve",
            immutable: false,
            servingMode: "signed",
            signedUrlTtlSeconds: 7200,
            signedUrlBucketSize: 600,
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
      expect(screen.getByLabelText(/max file size/i)).toHaveValue(10_485_760);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/max file size/i));
    await user.type(screen.getByLabelText(/max file size/i), "20971520");

    await user.click(screen.getByRole("button", { name: /save policy/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/namespaces/$slug",
        params: { slug: SLUG },
        search: { tab: "policy" },
      });
    });
  });

  it("displays a form-level error mapped from policy-version-conflict-error", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/policy-version-conflict-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Policy version conflict.",
    };
    mockMutateAsync.mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/max file size/i)).toHaveValue(10_485_760);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/max file size/i));
    await user.type(screen.getByLabelText(/max file size/i), "5000000");

    await user.click(screen.getByRole("button", { name: /save policy/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/another operator edited this policy/i);
    });
  });

  it("redirects to detail page when the namespace loads as archived", async () => {
    mockNamespace = archivedNamespace;
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/namespaces/$slug",
        params: { slug: SLUG },
      });
    });
  });

  it("displays a form-level error mapped from namespace-not-found-error", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/namespace-not-found-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: 'Namespace "aircraft-photos" was not found.',
    };
    mockMutateAsync.mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/max file size/i)).toHaveValue(10_485_760);
    });

    // Dirty the form
    await user.clear(screen.getByLabelText(/max file size/i));
    await user.type(screen.getByLabelText(/max file size/i), "5000000");

    await user.click(screen.getByRole("button", { name: /save policy/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/this namespace was deleted/i);
    });
  });
});
