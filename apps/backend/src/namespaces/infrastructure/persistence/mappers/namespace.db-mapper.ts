import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

export class NamespaceDbMapper {
  static toDomain(row: Record<string, any>): Namespace {
    return Namespace.fromProps({
      id: BigInt(row["id"]),
      slug: new Slug(row["slug"] as string),
      displayName: row["display_name"] as string,
      description: (row["description"] as string | null) ?? null,
      currentPolicyId: BigInt(row["current_policy_id"]),
      storageBindingId: BigInt(row["storage_binding_id"]),
      archivedAt: row["archived_at"] ? new Date(row["archived_at"] as string) : null,
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
