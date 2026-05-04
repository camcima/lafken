import type { Namespace } from "@/namespaces/domain/entities/namespace.entity";

export interface NamespaceWithMetadata {
  namespace: Namespace;
  storageBindingName: string;
  currentPolicyVersion: number;
}
