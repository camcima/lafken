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
  private policies = new Map<string, NamespacePolicy[]>();
  readonly presets: NamespacePreset[] = [];

  seed(namespaces: Namespace[]): void {
    this.namespaces = namespaces;
  }

  seedPolicies(namespaceId: string, policies: NamespacePolicy[]): void {
    this.policies.set(namespaceId, policies);
  }

  seedPresets(presets: NamespacePreset[]): void {
    this.presets.push(...presets);
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

  listPolicies(namespaceId: string): Promise<NamespacePolicy[]> {
    return Promise.resolve(this.policies.get(namespaceId) ?? []);
  }

  listPresets(namespaceId: string): Promise<NamespacePreset[]> {
    return Promise.resolve(
      this.presets.filter((preset) => preset.props.namespaceId === namespaceId),
    );
  }

  findPresetByName(namespaceId: string, name: string): Promise<NamespacePreset | null> {
    const matches = this.presets.filter(
      (preset) => preset.props.namespaceId === namespaceId && preset.props.name === name,
    );
    if (matches.length === 0) return Promise.resolve(null);
    const latest = matches.reduce((acc, cur) =>
      acc.props.version >= cur.props.version ? acc : cur,
    );
    return Promise.resolve(latest);
  }

  findStorageBindingName(): Promise<string | null> {
    return Promise.resolve(null);
  }

  findCurrentPolicyVersion(): Promise<number | null> {
    return Promise.resolve(null);
  }

  findActivePolicy(namespaceId: string): Promise<NamespacePolicy | null> {
    const namespace = this.namespaces.find((ns) => ns.props.id === namespaceId);
    if (!namespace) return Promise.resolve(null);
    const allPolicies = this.policies.get(namespaceId) ?? [];
    const active = allPolicies.find((p) => p.props.id === namespace.props.currentPolicyId) ?? null;
    return Promise.resolve(active);
  }

  findPolicyById(policyVersionId: string): Promise<NamespacePolicy | null> {
    for (const policies of this.policies.values()) {
      const found = policies.find((p) => p.props.id === policyVersionId);
      if (found) return Promise.resolve(found);
    }
    return Promise.resolve(null);
  }
}
