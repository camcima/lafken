import { useLafkenClient } from "@lafken/react";
import type {
  CreateNamespaceRequestDTO,
  CreatePolicyVersionRequestDTO,
  CreatePresetRequestDTO,
  SetPresetActiveRequestDTO,
  UpdateNamespaceMetadataRequestDTO,
  UpdatePresetVersionRequestDTO,
} from "@shared/backend-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { auditKeys } from "@/features/audit/keys";
import { namespacesKeys } from "@/features/namespaces/keys";
import type { IListNamespacesQuery } from "@/features/namespaces/keys";

export function useNamespaces(q: IListNamespacesQuery = {}) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.list(q),
    queryFn: () => client.namespaces.list(q),
  });
}

export function useNamespace(slug: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.detail(slug),
    queryFn: () => client.namespaces.get(slug),
    enabled: Boolean(slug),
  });
}

export function useNamespacePolicies(slug: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.policies(slug),
    queryFn: () => client.namespaces.listPolicies(slug),
    enabled: Boolean(slug),
  });
}

export function useNamespacePresets(slug: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: namespacesKeys.presets(slug),
    queryFn: () => client.namespaces.listPresets(slug),
    enabled: Boolean(slug),
  });
}

export function useCreateNamespace() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNamespaceRequestDTO) => client.namespaces.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useUpdateNamespaceMetadata() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { slug: string; input: UpdateNamespaceMetadataRequestDTO }) =>
      client.namespaces.updateMetadata(variables.slug, variables.input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useArchiveNamespace() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => client.namespaces.archive(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useUnarchiveNamespace() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => client.namespaces.unarchive(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useUpdateNamespacePolicy() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: CreatePolicyVersionRequestDTO }) =>
      client.namespaces.createPolicyVersion(slug, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.policies(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useCreatePreset() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: CreatePresetRequestDTO }) =>
      client.namespaces.createPreset(slug, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.presets(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useUpdatePresetVersion() {
  const client = useLafkenClient();
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
    }) => client.namespaces.updatePresetVersion(slug, name, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.presets(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useSetPresetActive() {
  const client = useLafkenClient();
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
    }) => client.namespaces.setPresetActive(slug, name, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.presets(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}
