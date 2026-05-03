import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import {
  ListNamespacesInput,
  NamespacePage,
  NamespaceQueryRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-query.repository.port";

export class InMemoryNamespaceQueryRepository implements NamespaceQueryRepositoryPort {
  private namespaces: Namespace[] = [];
  private policies = new Map<bigint, NamespacePolicy[]>();
  private presets = new Map<bigint, NamespacePreset[]>();

  seed(namespaces: Namespace[]): void {
    this.namespaces = namespaces;
  }

  seedPolicies(namespaceId: bigint, policies: NamespacePolicy[]): void {
    this.policies.set(namespaceId, policies);
  }

  seedPresets(namespaceId: bigint, presets: NamespacePreset[]): void {
    this.presets.set(namespaceId, presets);
  }

  list(input: ListNamespacesInput): Promise<NamespacePage> {
    const total = this.namespaces.length;
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: this.namespaces.slice(start, start + input.limit),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    });
  }

  findBySlug(slug: string): Promise<Namespace | null> {
    return Promise.resolve(this.namespaces.find((ns) => ns.props.slug.value === slug) ?? null);
  }

  listPolicies(namespaceId: bigint): Promise<NamespacePolicy[]> {
    return Promise.resolve(this.policies.get(namespaceId) ?? []);
  }

  listPresets(namespaceId: bigint): Promise<NamespacePreset[]> {
    return Promise.resolve(this.presets.get(namespaceId) ?? []);
  }

  findStorageBindingName(): Promise<string | null> {
    return Promise.resolve(null);
  }

  findCurrentPolicyVersion(): Promise<number | null> {
    return Promise.resolve(null);
  }
}
