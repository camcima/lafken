import { NamespaceResponseDTO } from "@shared/backend-api";

import { Namespace } from "@/namespaces/domain/entities/namespace.entity";

export class NamespaceResponseMapper {
  static fromDomain(
    namespace: Namespace,
    storageBindingName: string,
    currentPolicyVersion: number,
  ): NamespaceResponseDTO {
    return {
      slug: namespace.props.slug.value,
      displayName: namespace.props.displayName,
      description: namespace.props.description ?? undefined,
      currentPolicyVersion,
      storageBindingName,
      archivedAt: namespace.props.archivedAt?.toISOString(),
      createdAt: namespace.props.createdAt.toISOString(),
      updatedAt: namespace.props.updatedAt.toISOString(),
    };
  }
}
