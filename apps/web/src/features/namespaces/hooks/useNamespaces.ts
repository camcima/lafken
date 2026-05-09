import type {
  CreateNamespaceRequestDTO,
  CreatePolicyVersionRequestDTO,
  CreatePresetRequestDTO,
  SetPresetActiveRequestDTO,
  UpdateNamespaceMetadataRequestDTO,
  UpdatePresetVersionRequestDTO,
} from "@shared/backend-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { namespacesKeys } from "@/features/namespaces/keys";
import type { IListNamespacesQuery } from "@/features/namespaces/keys";

export function useNamespaces(q: IListNamespacesQuery = {}) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.list(q),
    queryFn: () => c.namespaces.list(q),
  });
}

export function useNamespace(slug: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.detail(slug),
    queryFn: () => c.namespaces.get(slug),
    enabled: Boolean(slug),
  });
}

export function useNamespacePolicies(slug: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.policies(slug),
    queryFn: () => c.namespaces.listPolicies(slug),
    enabled: Boolean(slug),
  });
}

export function useNamespacePresets(slug: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.presets(slug),
    queryFn: () => c.namespaces.listPresets(slug),
    enabled: Boolean(slug),
  });
}

export function useCreateNamespace() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNamespaceRequestDTO) => c.namespaces.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useUpdateNamespaceMetadata() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { slug: string; input: UpdateNamespaceMetadataRequestDTO }) =>
      c.namespaces.updateMetadata(variables.slug, variables.input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useArchiveNamespace() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => c.namespaces.archive(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useUnarchiveNamespace() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => c.namespaces.unarchive(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useUpdateNamespacePolicy() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: CreatePolicyVersionRequestDTO }) =>
      c.namespaces.createPolicyVersion(slug, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.policies(variables.slug) });
    },
  });
}

export function useCreatePreset() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: CreatePresetRequestDTO }) =>
      c.namespaces.createPreset(slug, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.presets(variables.slug) });
    },
  });
}

export function useUpdatePresetVersion() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      name,
      input,
    }: {
      slug: string;
      name: string;
      input: UpdatePresetVersionRequestDTO;
    }) => c.namespaces.updatePresetVersion(slug, name, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.presets(variables.slug) });
    },
  });
}

export function useSetPresetActive() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      name,
      input,
    }: {
      slug: string;
      name: string;
      input: SetPresetActiveRequestDTO;
    }) => c.namespaces.setPresetActive(slug, name, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.presets(variables.slug) });
    },
  });
}
