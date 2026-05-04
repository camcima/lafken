import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { StorageBindingDrawer } from "./StorageBindingDrawer";

interface IMockMutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

const createMutation: IMockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

const updateMutation: IMockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

const deleteMutation: IMockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

vi.mock("@/features/system/hooks/useSystem", () => ({
  useStorageBindings: () => ({ data: [], isLoading: false }),
  useStorageBinding: () => ({ data: undefined, isLoading: false }),
  useIntegrations: () => ({ data: [], isLoading: false }),
  useSystemHealth: () => ({
    data: { overall: "unknown", indicators: [], integrations: [] },
    isLoading: false,
  }),
  useCreateStorageBinding: () => createMutation,
  useUpdateStorageBinding: () => updateMutation,
  useDeleteStorageBinding: () => deleteMutation,
}));

function renderDrawer(props: {
  open: boolean;
  mode: "create" | "edit";
  binding?: StorageBindingResponseDTO;
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
      <StorageBindingDrawer
        open={props.open}
        mode={props.mode}
        binding={props.binding}
        onClose={onClose}
      />
    </Wrapper>,
  );
}

const sampleBinding: StorageBindingResponseDTO = {
  name: "lafken-prod",
  adapterType: "gcs",
  config: { bucket: "lafken-bucket", projectId: "lafken-prj-1" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("StorageBindingDrawer", () => {
  beforeEach(() => {
    createMutation.mutateAsync = vi.fn().mockResolvedValue(sampleBinding);
    updateMutation.mutateAsync = vi.fn().mockResolvedValue(sampleBinding);
    deleteMutation.mutateAsync = vi.fn().mockResolvedValue(undefined);
    createMutation.isPending = false;
    updateMutation.isPending = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders create-mode title and empty fields when open with mode=create", () => {
    renderDrawer({ open: true, mode: "create" });

    expect(screen.getByText(/add storage binding/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^bucket$/i)).toHaveValue("");
    expect(screen.getByLabelText(/gcp project id/i)).toHaveValue("");
  });

  it("calls useCreateStorageBinding mutation with the form values on submit", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ open: true, mode: "create", onClose });

    await user.type(screen.getByLabelText(/^name$/i), "lafken-prod");
    await user.type(screen.getByLabelText(/^bucket$/i), "lafken-bucket");
    await user.type(screen.getByLabelText(/gcp project id/i), "lafken-prj-1");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({
        name: "lafken-prod",
        adapterType: "gcs",
        config: { bucket: "lafken-bucket", projectId: "lafken-prj-1" },
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("renders edit-mode title and pre-fills fields from the provided binding", async () => {
    renderDrawer({ open: true, mode: "edit", binding: sampleBinding });

    expect(screen.getByText(/edit storage binding/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/^name$/i)).toHaveValue("lafken-prod");
    });
    expect(screen.getByLabelText(/^bucket$/i)).toHaveValue("lafken-bucket");
    expect(screen.getByLabelText(/gcp project id/i)).toHaveValue("lafken-prj-1");
  });

  it("name field is read-only in edit mode", async () => {
    renderDrawer({ open: true, mode: "edit", binding: sampleBinding });
    await waitFor(() => {
      expect(screen.getByLabelText(/^name$/i)).toHaveValue("lafken-prod");
    });
    const nameInput = screen.getByLabelText(/^name$/i);
    expect(nameInput).toBeDisabled();
    expect(nameInput).toHaveAttribute("readonly");
  });

  it("displays a field error on `name` when the API responds with a duplicate-name error", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/duplicate-storage-binding-name-error",
      title: "Conflict",
      status: 409,
      detail: 'Storage binding "lafken-prod" already exists.',
      params: { name: "lafken-prod" },
    };
    createMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "Conflict", errorBody));

    const onClose = vi.fn();
    renderDrawer({ open: true, mode: "create", onClose });

    await user.type(screen.getByLabelText(/^name$/i), "lafken-prod");
    await user.type(screen.getByLabelText(/^bucket$/i), "lafken-bucket");
    await user.type(screen.getByLabelText(/gcp project id/i), "lafken-prj-1");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/binding with this name already exists/i)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("displays a form-level error mentioning the bucket when the API responds with a bucket-not-found error", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/bucket-not-found-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: 'Bucket "missing-bucket" was not found in the gcs backend.',
      params: { adapterType: "gcs", bucket: "missing-bucket" },
    };
    createMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiError(422, "Unprocessable", errorBody));

    const onClose = vi.fn();
    renderDrawer({ open: true, mode: "create", onClose });

    await user.type(screen.getByLabelText(/^name$/i), "lafken-prod");
    await user.type(screen.getByLabelText(/^bucket$/i), "missing-bucket");
    await user.type(screen.getByLabelText(/gcp project id/i), "lafken-prj-1");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/missing-bucket/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
