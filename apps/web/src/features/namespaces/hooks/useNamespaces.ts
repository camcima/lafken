import type {
  CreateNamespaceRequestDTO,
  UpdateNamespaceMetadataRequestDTO,
} from "@shared/backend-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { namespacesKeys } from "@/features/namespaces/keys";
import { namespacesService } from "@/services";
import type { ListNamespacesQuery } from "@/services/NamespacesService";

export function useNamespaces(q: ListNamespacesQuery = {}) {
  return useQuery({
    queryKey: namespacesKeys.list(q),
    queryFn: () => namespacesService.list(q),
  });
}

export function useNamespace(slug: string) {
  return useQuery({
    queryKey: namespacesKeys.detail(slug),
    queryFn: () => namespacesService.getBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useNamespacePolicies(slug: string) {
  return useQuery({
    queryKey: namespacesKeys.policies(slug),
    queryFn: () => namespacesService.listPolicies(slug),
    enabled: Boolean(slug),
  });
}

export function useNamespacePresets(slug: string) {
  return useQuery({
    queryKey: namespacesKeys.presets(slug),
    queryFn: () => namespacesService.listPresets(slug),
    enabled: Boolean(slug),
  });
}

export function useCreateNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNamespaceRequestDTO) => namespacesService.createNamespace(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useUpdateNamespaceMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { slug: string; input: UpdateNamespaceMetadataRequestDTO }) =>
      namespacesService.updateNamespaceMetadata(variables.slug, variables.input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(variables.slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useArchiveNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => namespacesService.archiveNamespace(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}

export function useUnarchiveNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => namespacesService.unarchiveNamespace(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: namespacesKeys.lists() });
    },
  });
}
