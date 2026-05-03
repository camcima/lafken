import type { ListNamespacesQuery } from "@/services/NamespacesService";

export const namespacesKeys = {
  all: ["namespaces"] as const,
  lists: () => [...namespacesKeys.all, "list"] as const,
  list: (q: ListNamespacesQuery) => [...namespacesKeys.lists(), q] as const,
  details: () => [...namespacesKeys.all, "detail"] as const,
  detail: (slug: string) => [...namespacesKeys.details(), slug] as const,
  policies: (slug: string) => [...namespacesKeys.detail(slug), "policies"] as const,
  presets: (slug: string) => [...namespacesKeys.detail(slug), "presets"] as const,
};
