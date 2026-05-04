import type { NamespaceResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("closes on cancel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ open: true, namespace: sampleNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(updateMutation.mutateAsync).not.toHaveBeenCalled();
  });
});
