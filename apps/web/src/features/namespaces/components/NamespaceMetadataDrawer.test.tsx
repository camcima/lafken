import type { NamespaceResponseDTO } from "@shared/backend-api";
import {
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
} from "@shared/backend-api/validation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespaceMetadataDrawer } from "./NamespaceMetadataDrawer";

interface IMockMutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
}

const updateMutation: IMockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
};

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({ data: [], isLoading: false }),
  useNamespace: () => ({ data: undefined, isLoading: false }),
  useUpdateNamespaceMetadata: () => updateMutation,
  useCreateNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnarchiveNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const sampleNamespace: NamespaceResponseDTO = {
  slug: "my-namespace",
  displayName: "My Namespace",
  description: "A sample description",
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderDrawer(props: {
  open: boolean;
  namespace?: NamespaceResponseDTO;
  onClose?: () => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const onClose = props.onClose ?? vi.fn();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    );
  }
  return {
    ...render(
      <Wrapper>
        <NamespaceMetadataDrawer open={props.open} namespace={props.namespace} onClose={onClose} />
      </Wrapper>,
    ),
    onClose,
  };
}

describe("NamespaceMetadataDrawer", () => {
  beforeEach(() => {
    updateMutation.mutateAsync = vi.fn().mockResolvedValue(sampleNamespace);
    updateMutation.isPending = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders prefilled values when open with a namespace", async () => {
    renderDrawer({ open: true, namespace: sampleNamespace });

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue("My Namespace");
    });
    expect(screen.getByLabelText(/description/i)).toHaveValue("A sample description");
  });

  it("calls useUpdateNamespaceMetadata mutation with the new values on submit", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ open: true, namespace: sampleNamespace, onClose });

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Updated Name");

    const descriptionInput = screen.getByLabelText(/description/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated description");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        slug: "my-namespace",
        input: {
          displayName: "Updated Name",
          description: "Updated description",
        },
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("displays a form-level error when the API responds with not-found", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/namespace-not-found-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: 'Namespace "my-namespace" was not found.',
    };
    updateMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));

    const onClose = vi.fn();
    renderDrawer({ open: true, namespace: sampleNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/this namespace was deleted/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // Proves the form's Zod max() bounds are derived from the shared
  // NAMESPACE_DISPLAY_NAME_MAX_LENGTH / NAMESPACE_DESCRIPTION_MAX_LENGTH
  // constants — the same ones UpdateNamespaceMetadataRequestDTO enforces on
  // the backend (shared/backend-api/presentation/namespaces/__tests__) —
  // rather than local literals that could silently drift from the backend.
  it("accepts displayName/description at the shared NAMESPACE_* max length and rejects one character over", async () => {
    renderDrawer({ open: true, namespace: sampleNamespace });

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue("My Namespace");
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

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

  it("closes on cancel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ open: true, namespace: sampleNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
  });
});
