import type {
  CreateStorageBindingRequestDTO,
  StorageBindingResponseDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditKeys } from "@/features/audit/keys";
import { systemKeys } from "@/features/system/keys";

import {
  useCreateStorageBinding,
  useDeleteStorageBinding,
  useUpdateStorageBinding,
} from "./useSystem";

const mockSystem = {
  createStorageBinding: vi.fn(),
  updateStorageBinding: vi.fn(),
  deleteStorageBinding: vi.fn(),
  listStorageBindings: vi.fn(),
  getStorageBinding: vi.fn(),
  listIntegrations: vi.fn(),
  getHealth: vi.fn(),
};

vi.mock("@lafken/react", () => ({
  useLafkenClient: () => ({ system: mockSystem }),
}));

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

const sampleBinding: StorageBindingResponseDTO = {
  id: "1",
  name: "lafken-prod",
  adapterType: "gcs",
  config: { bucket: "lafken-dev", projectId: "lafken-prod-1" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("useCreateStorageBinding", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls system.createStorageBinding and invalidates the bindings list on success", async () => {
    const input: CreateStorageBindingRequestDTO = {
      name: "lafken-prod",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "lafken-prod-1" },
    };
    mockSystem.createStorageBinding.mockResolvedValue(sampleBinding);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockSystem.createStorageBinding).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: systemKeys.storageBindings() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });
  });

  it("surfaces the error and does not invalidate the cache when the client throws", async () => {
    const input: CreateStorageBindingRequestDTO = {
      name: "lafken-prod",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "lafken-prod-1" },
    };
    const failure = new Error("boom");
    mockSystem.createStorageBinding.mockRejectedValue(failure);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow("boom");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(failure);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useUpdateStorageBinding", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls system.updateStorageBinding and invalidates the matching binding plus list on success", async () => {
    const input: UpdateStorageBindingRequestDTO = {
      config: { bucket: "lafken-staging", projectId: "lafken-prod-1" },
    };
    mockSystem.updateStorageBinding.mockResolvedValue(sampleBinding);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: "lafken-prod", input });
    });

    expect(mockSystem.updateStorageBinding).toHaveBeenCalledWith("lafken-prod", input);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: systemKeys.storageBinding("lafken-prod"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: systemKeys.storageBindings() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });
  });
});

describe("useDeleteStorageBinding", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls system.deleteStorageBinding and invalidates the bindings list on success", async () => {
    mockSystem.deleteStorageBinding.mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("lafken-prod");
    });

    expect(mockSystem.deleteStorageBinding).toHaveBeenCalledWith("lafken-prod");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: systemKeys.storageBindings() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });
  });
});
