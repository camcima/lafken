import type { NamespacePolicy } from "../entities/namespace-policy.entity";
import type { NamespacePreset } from "../entities/namespace-preset.entity";
import type { Namespace } from "../entities/namespace.entity";

export interface NamespacePage {
  data: Namespace[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export interface ListNamespacesInput {
  page: number;
  limit: number;
}

export abstract class NamespaceQueryRepositoryPort {
  abstract list(input: ListNamespacesInput): Promise<NamespacePage>;
  abstract findBySlug(slug: string): Promise<Namespace | null>;
  abstract listPolicies(namespaceId: string): Promise<NamespacePolicy[]>;
  abstract listPresets(namespaceId: string): Promise<NamespacePreset[]>;
  abstract findStorageBindingName(storageBindingId: string): Promise<string | null>;
  abstract findCurrentPolicyVersion(namespaceId: string): Promise<number | null>;
}
