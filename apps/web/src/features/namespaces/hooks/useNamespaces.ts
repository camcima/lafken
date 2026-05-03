import { useQuery } from "@tanstack/react-query";

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
