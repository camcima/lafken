import type {
  CreateNamespaceRequestDTO,
  CreatePolicyVersionRequestDTO,
  CreatePresetRequestDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
  SetPresetActiveRequestDTO,
  UpdateNamespaceMetadataRequestDTO,
  UpdatePresetVersionRequestDTO,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { namespacesKeys } from "@/features/namespaces/keys";

import {
  useArchiveNamespace,
  useCreateNamespace,
  useCreatePreset,
  useSetPresetActive,
  useUnarchiveNamespace,
  useUpdateNamespaceMetadata,
  useUpdateNamespacePolicy,
  useUpdatePresetVersion,
} from "./useNamespaces";

const mockNamespaces = {
  create: vi.fn(),
  updateMetadata: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  createPolicyVersion: vi.fn(),
  createPreset: vi.fn(),
  updatePresetVersion: vi.fn(),
  setPresetActive: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  listPolicies: vi.fn(),
  listPresets: vi.fn(),
};

vi.mock("@lafken/react", () => ({
  useLafkenClient: () => ({ namespaces: mockNamespaces }),
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
    vi.clearAllMocks();
  });

  it("calls namespaces.create and invalidates the namespaces list on success", async () => {
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
    mockNamespaces.create.mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateNamespace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockNamespaces.create).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.lists() });
  });

  it("surfaces the error and does not invalidate the cache when the client throws", async () => {
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
    mockNamespaces.create.mockRejectedValueOnce(failure);
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
    vi.clearAllMocks();
  });

  it("calls namespaces.updateMetadata and invalidates the matching detail and list on success", async () => {
    const slug = "aircraft-photos";
    const input: UpdateNamespaceMetadataRequestDTO = {
      displayName: "Aircraft Photos Updated",
      description: "Updated description",
    };
    mockNamespaces.updateMetadata.mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNamespaceMetadata(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, input });
    });

    expect(mockNamespaces.updateMetadata).toHaveBeenCalledWith(slug, input);
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
    vi.clearAllMocks();
  });

  it("calls namespaces.archive and invalidates the matching detail and list on success", async () => {
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
    mockNamespaces.archive.mockResolvedValue(archivedNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useArchiveNamespace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(slug);
    });

    expect(mockNamespaces.archive).toHaveBeenCalledWith(slug);
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
    vi.clearAllMocks();
  });

  it("calls namespaces.unarchive and invalidates the matching detail and list on success", async () => {
    const slug = "aircraft-photos";
    mockNamespaces.unarchive.mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUnarchiveNamespace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(slug);
    });

    expect(mockNamespaces.unarchive).toHaveBeenCalledWith(slug);
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
    vi.clearAllMocks();
  });

  it("calls namespaces.createPolicyVersion and invalidates the matching detail and policies on success", async () => {
    const slug = "aircraft-photos";
    mockNamespaces.createPolicyVersion.mockResolvedValue(sampleNamespace);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNamespacePolicy(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, input: VALID_POLICY });
    });

    expect(mockNamespaces.createPolicyVersion).toHaveBeenCalledWith(slug, VALID_POLICY);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.detail(slug) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.policies(slug) });
  });

  it("surfaces the error and does not invalidate the cache when the client throws", async () => {
    const slug = "aircraft-photos";
    const failure = new Error("policy update failed");
    mockNamespaces.createPolicyVersion.mockRejectedValueOnce(failure);
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

const samplePreset: NamespacePresetResponseDTO = {
  name: "thumbnail",
  version: 1,
  params: { width: 200, height: 200, fit: "cover", format: "webp", quality: 80 },
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const VALID_PRESET_PARAMS: CreatePresetRequestDTO = {
  name: "thumbnail",
  params: {
    width: 200,
    height: 200,
    fit: "cover",
    format: "webp",
    quality: 80,
  },
};

describe("useCreatePreset", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls namespaces.createPreset and invalidates the presets key on success", async () => {
    const slug = "aircraft-photos";
    mockNamespaces.createPreset.mockResolvedValue(samplePreset);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePreset(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, input: VALID_PRESET_PARAMS });
    });

    expect(mockNamespaces.createPreset).toHaveBeenCalledWith(slug, VALID_PRESET_PARAMS);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.presets(slug) });
  });

  it("surfaces the error and does not invalidate the cache when the client throws", async () => {
    const slug = "aircraft-photos";
    const failure = new Error("create preset failed");
    mockNamespaces.createPreset.mockRejectedValueOnce(failure);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePreset(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ slug, input: VALID_PRESET_PARAMS }),
      ).rejects.toThrow("create preset failed");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(failure);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

const VALID_PRESET_VERSION: UpdatePresetVersionRequestDTO = {
  params: {
    width: 400,
    height: 400,
    fit: "contain",
    format: "avif",
    quality: 90,
  },
};

describe("useUpdatePresetVersion", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls namespaces.updatePresetVersion and invalidates the presets key on success", async () => {
    const slug = "aircraft-photos";
    const name = "thumbnail";
    mockNamespaces.updatePresetVersion.mockResolvedValue(samplePreset);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePresetVersion(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, name, input: VALID_PRESET_VERSION });
    });

    expect(mockNamespaces.updatePresetVersion).toHaveBeenCalledWith(slug, name, VALID_PRESET_VERSION);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.presets(slug) });
  });

  it("surfaces the error and does not invalidate the cache when the client throws", async () => {
    const slug = "aircraft-photos";
    const name = "thumbnail";
    const failure = new Error("update preset version failed");
    mockNamespaces.updatePresetVersion.mockRejectedValueOnce(failure);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePresetVersion(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ slug, name, input: VALID_PRESET_VERSION }),
      ).rejects.toThrow("update preset version failed");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(failure);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

const VALID_SET_ACTIVE: SetPresetActiveRequestDTO = {
  active: true,
};

describe("useSetPresetActive", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls namespaces.setPresetActive and invalidates the presets key on success", async () => {
    const slug = "aircraft-photos";
    const name = "thumbnail";
    mockNamespaces.setPresetActive.mockResolvedValue(samplePreset);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetPresetActive(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slug, name, input: VALID_SET_ACTIVE });
    });

    expect(mockNamespaces.setPresetActive).toHaveBeenCalledWith(slug, name, VALID_SET_ACTIVE);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: namespacesKeys.presets(slug) });
  });

  it("surfaces the error and does not invalidate the cache when the client throws", async () => {
    const slug = "aircraft-photos";
    const name = "thumbnail";
    const failure = new Error("set preset active failed");
    mockNamespaces.setPresetActive.mockRejectedValueOnce(failure);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetPresetActive(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ slug, name, input: VALID_SET_ACTIVE }),
      ).rejects.toThrow("set preset active failed");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(failure);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
