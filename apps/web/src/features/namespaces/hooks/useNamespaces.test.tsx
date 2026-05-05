import type {
  CreateNamespaceRequestDTO,
  CreatePolicyVersionRequestDTO,
  NamespaceResponseDTO,
  UpdateNamespaceMetadataRequestDTO,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { namespacesKeys } from "@/features/namespaces/keys";
import { namespacesService } from "@/services";

import {
  useArchiveNamespace,
  useCreateNamespace,
  useUnarchiveNamespace,
  useUpdateNamespaceMetadata,
  useUpdateNamespacePolicy,
} from "./useNamespaces";

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

const sampleNamespace: NamespaceResponseDTO = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  description: "Photos of aircraft",
  currentPolicyVersion: 1,
  storageBindingName: "lafken-prod",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useCreateNamespace", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls NamespacesService.createNamespace and invalidates the namespaces list on success", async () => {
    const input: CreateNamespaceRequestDTO = {
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      description: null,
      storageBindingId: "01900000-0000-7000-8000-000000000001",
      policy: {
        retentionDays: null,
        retentionMode: "none",
        maxFileSizeBytes: 52428800,
        allowedMimeTypes: ["image/jpeg", "image/png"],
        exifHandling: "strip",
        virusScanRequired: false,
        contentModeration: null,
        requiredMetadataSchema: null,
        immutable: false,
        servingMode: "public",
        signedUrlTtlSeconds: null,
        signedUrlBucketSize: null,
        retryConfig: null,
      },
    };
    const createSpy = vi
      .spyOn(namespacesService, "createNamespace")
      .mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateNamespace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(createSpy).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.lists() });
  });

  it("surfaces the error and does not invalidate the cache when the service throws", async () => {
    const input: CreateNamespaceRequestDTO = {
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      description: null,
      storageBindingId: "01900000-0000-7000-8000-000000000001",
      policy: {
        retentionDays: null,
        retentionMode: "none",
        maxFileSizeBytes: 52428800,
        allowedMimeTypes: ["image/jpeg"],
        exifHandling: "strip",
        virusScanRequired: false,
        contentModeration: null,
        requiredMetadataSchema: null,
        immutable: false,
        servingMode: "public",
        signedUrlTtlSeconds: null,
        signedUrlBucketSize: null,
        retryConfig: null,
      },
    };
    const failure = new Error("boom");
    vi.spyOn(namespacesService, "createNamespace").mockRejectedValueOnce(failure);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateNamespace(), {
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

describe("useUpdateNamespaceMetadata", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls NamespacesService.updateNamespaceMetadata and invalidates the matching detail and list on success", async () => {
    const slug = "aircraft-photos";
    const input: UpdateNamespaceMetadataRequestDTO = {
      displayName: "Aircraft Photos Updated",
      description: "Updated description",
    };
    const updateSpy = vi
      .spyOn(namespacesService, "updateNamespaceMetadata")
      .mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNamespaceMetadata(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, input });
    });

    expect(updateSpy).toHaveBeenCalledWith(slug, input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.detail(slug) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.lists() });
  });
});

describe("useArchiveNamespace", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls NamespacesService.archiveNamespace and invalidates the matching detail and list on success", async () => {
    const slug = "aircraft-photos";
    const archivedNamespace: NamespaceResponseDTO = {
      slug: sampleNamespace.slug,
      displayName: sampleNamespace.displayName,
      description: sampleNamespace.description,
      currentPolicyVersion: sampleNamespace.currentPolicyVersion,
      storageBindingName: sampleNamespace.storageBindingName,
      archivedAt: "2026-05-04T00:00:00.000Z",
      createdAt: sampleNamespace.createdAt,
      updatedAt: sampleNamespace.updatedAt,
    };
    const archiveSpy = vi
      .spyOn(namespacesService, "archiveNamespace")
      .mockResolvedValue(archivedNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useArchiveNamespace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(slug);
    });

    expect(archiveSpy).toHaveBeenCalledWith(slug);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.detail(slug) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.lists() });
  });
});

describe("useUnarchiveNamespace", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls NamespacesService.unarchiveNamespace and invalidates the matching detail and list on success", async () => {
    const slug = "aircraft-photos";
    const unarchiveSpy = vi
      .spyOn(namespacesService, "unarchiveNamespace")
      .mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUnarchiveNamespace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(slug);
    });

    expect(unarchiveSpy).toHaveBeenCalledWith(slug);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.detail(slug) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.lists() });
  });
});

const VALID_POLICY: CreatePolicyVersionRequestDTO = {
  policy: {
    retentionDays: null,
    retentionMode: "none",
    maxFileSizeBytes: 52428800,
    allowedMimeTypes: ["image/jpeg", "image/png"],
    exifHandling: "strip",
    virusScanRequired: false,
    contentModeration: null,
    requiredMetadataSchema: null,
    immutable: false,
    servingMode: "public",
    signedUrlTtlSeconds: null,
    signedUrlBucketSize: null,
    retryConfig: null,
  },
};

describe("useUpdateNamespacePolicy", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls NamespacesService.updatePolicy and invalidates the matching detail and policies on success", async () => {
    const slug = "aircraft-photos";
    const updatePolicySpy = vi
      .spyOn(namespacesService, "updatePolicy")
      .mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNamespacePolicy(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, input: VALID_POLICY });
    });

    expect(updatePolicySpy).toHaveBeenCalledWith(slug, VALID_POLICY);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.detail(slug) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.policies(slug) });
  });

  it("surfaces the error and does not invalidate the cache when the service throws", async () => {
    const slug = "aircraft-photos";
    const failure = new Error("policy update failed");
    vi.spyOn(namespacesService, "updatePolicy").mockRejectedValueOnce(failure);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNamespacePolicy(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ slug, input: VALID_POLICY })).rejects.toThrow(
        "policy update failed",
      );
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(failure);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
