import type { NamespaceResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { ArchiveNamespaceDialog } from "./ArchiveNamespaceDialog";

interface IMockMutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

const archiveMutation: IMockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

const unarchiveMutation: IMockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({ data: [], isLoading: false }),
  useNamespace: () => ({ data: undefined, isLoading: false }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
  useNamespacePresets: () => ({ data: undefined, isLoading: false }),
  useCreateNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNamespaceMetadata: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveNamespace: () => archiveMutation,
  useUnarchiveNamespace: () => unarchiveMutation,
}));

const sampleNamespace: NamespaceResponseDTO = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  description: "A sample description",
  currentPolicyVersion: 7,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const archivedNamespace: NamespaceResponseDTO = {
  slug: sampleNamespace.slug,
  displayName: sampleNamespace.displayName,
  description: sampleNamespace.description,
  currentPolicyVersion: sampleNamespace.currentPolicyVersion,
  storageBindingName: sampleNamespace.storageBindingName,
  archivedAt: "2026-02-01T00:00:00.000Z",
  createdAt: sampleNamespace.createdAt,
  updatedAt: sampleNamespace.updatedAt,
};

function renderDialog(props: {
  open: boolean;
  mode: "archive" | "unarchive";
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
  return render(
    <Wrapper>
      <ArchiveNamespaceDialog
        open={props.open}
        mode={props.mode}
        namespace={props.namespace}
        onClose={onClose}
      />
    </Wrapper>,
  );
}

describe("ArchiveNamespaceDialog", () => {
  beforeEach(() => {
    archiveMutation.mutateAsync = vi.fn().mockResolvedValue(undefined);
    archiveMutation.isPending = false;
    unarchiveMutation.mutateAsync = vi.fn().mockResolvedValue(undefined);
    unarchiveMutation.isPending = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders archive copy when mode is archive", () => {
    renderDialog({ open: true, mode: "archive", namespace: sampleNamespace });
    expect(screen.getByRole("dialog")).toHaveTextContent(/archive aircraft photos\?/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/existing assets remain accessible/i);
  });

  it("renders unarchive copy when mode is unarchive", () => {
    renderDialog({ open: true, mode: "unarchive", namespace: archivedNamespace });
    expect(screen.getByRole("dialog")).toHaveTextContent(/unarchive aircraft photos\?/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/accept new uploads again/i);
  });

  it("calls useArchiveNamespace on confirm in archive mode", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, mode: "archive", namespace: sampleNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(archiveMutation.mutateAsync).toHaveBeenCalledWith("aircraft-photos");
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(unarchiveMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("calls useUnarchiveNamespace on confirm in unarchive mode", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, mode: "unarchive", namespace: archivedNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(unarchiveMutation.mutateAsync).toHaveBeenCalledWith("aircraft-photos");
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(archiveMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows inline error when mutation rejects", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/namespace-not-found-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Namespace could not be archived right now",
    };
    archiveMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiError(422, "Unprocessable Entity", errorBody));

    const onClose = vi.fn();
    renderDialog({ open: true, mode: "archive", namespace: sampleNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /namespace could not be archived right now/i,
      );
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancel calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, mode: "archive", namespace: sampleNamespace, onClose });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalled();
    expect(archiveMutation.mutateAsync).not.toHaveBeenCalled();
  });
});
