import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiErrorBody } from "@/lib/api/api-error";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { DeleteStorageBindingDialog } from "./DeleteStorageBindingDialog";

interface IMockMutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

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
  useCreateStorageBinding: () => deleteMutation,
  useUpdateStorageBinding: () => deleteMutation,
  useDeleteStorageBinding: () => deleteMutation,
}));

const sampleBinding: StorageBindingResponseDTO = {
  name: "lafken-prod",
  adapterType: "gcs",
  config: { bucket: "lafken-bucket", projectId: "lafken-prj-1" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderDialog(props: {
  open: boolean;
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
      <DeleteStorageBindingDialog open={props.open} binding={props.binding} onClose={onClose} />
    </Wrapper>,
  );
}

describe("DeleteStorageBindingDialog", () => {
  beforeEach(() => {
    deleteMutation.mutateAsync = vi.fn().mockResolvedValue(undefined);
    deleteMutation.isPending = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders confirm/cancel buttons with the binding name in the title", () => {
    renderDialog({ open: true, binding: sampleBinding });
    expect(screen.getByRole("dialog")).toHaveTextContent("lafken-prod");
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("calls useDeleteStorageBinding with the binding name on confirm", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, binding: sampleBinding, onClose });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteMutation.mutateAsync).toHaveBeenCalledWith("lafken-prod");
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("calls onClose on cancel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, binding: sampleBinding, onClose });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
    expect(deleteMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, binding: sampleBinding, onClose });

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when binding is undefined", () => {
    renderDialog({ open: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an inline error message when the delete mutation fails", async () => {
    const user = userEvent.setup();
    const errorBody: ApiErrorBody = {
      type: "https://lafken.dev/problems/storage-binding-not-found-error",
      title: "Not Found",
      status: 404,
      detail: "Storage binding could not be deleted right now",
    };
    deleteMutation.mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiError(404, "Not Found", errorBody));

    const onClose = vi.fn();
    renderDialog({ open: true, binding: sampleBinding, onClose });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /storage binding could not be deleted right now/i,
      );
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
