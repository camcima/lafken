import type {
  CreateStorageBindingRequestDTO,
  StorageBindingResponseDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { systemKeys } from "@/features/system/keys";
import { systemService } from "@/services";

import {
  useCreateStorageBinding,
  useDeleteStorageBinding,
  useUpdateStorageBinding,
} from "./useSystem";

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
    vi.restoreAllMocks();
  });

  it("calls SystemService.createStorageBinding and invalidates the bindings list on success", async () => {
    const input: CreateStorageBindingRequestDTO = {
      name: "lafken-prod",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "lafken-prod-1" },
    };
    const createSpy = vi
      .spyOn(systemService, "createStorageBinding")
      .mockResolvedValue(sampleBinding);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(createSpy).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: systemKeys.storageBindings() });
  });

  it("surfaces the error and does not invalidate the cache when the service throws", async () => {
    const input: CreateStorageBindingRequestDTO = {
      name: "lafken-prod",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "lafken-prod-1" },
    };
    const failure = new Error("boom");
    vi.spyOn(systemService, "createStorageBinding").mockRejectedValue(failure);
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
    vi.restoreAllMocks();
  });

  it("calls SystemService.updateStorageBinding and invalidates the matching binding plus list on success", async () => {
    const input: UpdateStorageBindingRequestDTO = {
      config: { bucket: "lafken-staging", projectId: "lafken-prod-1" },
    };
    const updateSpy = vi
      .spyOn(systemService, "updateStorageBinding")
      .mockResolvedValue(sampleBinding);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: "lafken-prod", input });
    });

    expect(updateSpy).toHaveBeenCalledWith("lafken-prod", input);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: systemKeys.storageBinding("lafken-prod"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: systemKeys.storageBindings() });
  });
});

describe("useDeleteStorageBinding", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls SystemService.deleteStorageBinding and invalidates the bindings list on success", async () => {
    const deleteSpy = vi.spyOn(systemService, "deleteStorageBinding").mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteStorageBinding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("lafken-prod");
    });

    expect(deleteSpy).toHaveBeenCalledWith("lafken-prod");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: systemKeys.storageBindings() });
  });
});
