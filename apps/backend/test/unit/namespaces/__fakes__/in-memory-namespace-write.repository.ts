import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { PolicyVersionConflictError } from "@/namespaces/domain/errors/policy-version-conflict.error";
import { StorageBindingMissingError } from "@/namespaces/domain/errors/storage-binding-missing.error";
import type {
  ICreatePolicyVersionInput,
  ICreatePolicyVersionResult,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import {
  ICreateNamespaceInput,
  IUpdateNamespaceMetadataInput,
  NamespaceWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

const INITIAL_NAMESPACE_ID = 1n;
const INITIAL_POLICY_ID = 1n;
const ID_INCREMENT = 1n;

export class InMemoryNamespaceWriteRepository extends NamespaceWriteRepositoryPort {
  readonly namespaces = new Map<string, Namespace>();
  readonly missingStorageBindings = new Set<bigint>();
  readonly policyVersionsByNamespace = new Map<bigint, number>();
  collisionsRemaining = 0;
  private nextNamespaceId = INITIAL_NAMESPACE_ID;
  private nextPolicyId = INITIAL_POLICY_ID;

  seed(namespace: Namespace): void {
    this.namespaces.set(namespace.props.slug.value, namespace);
  }

  has(slug: string): boolean {
    return this.namespaces.has(slug);
  }

  get(slug: string): Namespace | undefined {
    return this.namespaces.get(slug);
  }

  size(): number {
    return this.namespaces.size;
  }

  createWithInitialPolicy(input: ICreateNamespaceInput): Promise<Namespace> {
    if (this.missingStorageBindings.has(input.storageBindingId)) {
      return Promise.reject(
        new StorageBindingMissingError({ storageBindingId: input.storageBindingId }),
      );
    }
    const now = new Date();
    const policyId = this.nextPolicyId;
    this.nextPolicyId += ID_INCREMENT;
    const namespaceId = this.nextNamespaceId;
    this.nextNamespaceId += ID_INCREMENT;
    const namespace = Namespace.fromProps({
      id: namespaceId,
      slug: new Slug(input.slug),
      displayName: input.displayName,
      description: input.description,
      currentPolicyId: policyId,
      storageBindingId: input.storageBindingId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.namespaces.set(input.slug, namespace);
    return Promise.resolve(namespace);
  }

  updateMetadata(input: IUpdateNamespaceMetadataInput): Promise<Namespace> {
    const existing = this.namespaces.get(input.slug);
    if (!existing)
      return Promise.reject(new Error("InMemoryNamespaceWriteRepository: namespace not found"));
    const updated = Namespace.fromProps({
      ...existing.props,
      displayName: input.displayName,
      description: input.description,
      updatedAt: new Date(),
    });
    this.namespaces.set(input.slug, updated);
    return Promise.resolve(updated);
  }

  archive(slug: string): Promise<Namespace> {
    const existing = this.namespaces.get(slug);
    if (!existing)
      return Promise.reject(new Error("InMemoryNamespaceWriteRepository: namespace not found"));
    const updated = Namespace.fromProps({
      ...existing.props,
      archivedAt: existing.props.archivedAt ?? new Date(),
      updatedAt: new Date(),
    });
    this.namespaces.set(slug, updated);
    return Promise.resolve(updated);
  }

  unarchive(slug: string): Promise<Namespace> {
    const existing = this.namespaces.get(slug);
    if (!existing)
      return Promise.reject(new Error("InMemoryNamespaceWriteRepository: namespace not found"));
    const updated = Namespace.fromProps({
      ...existing.props,
      archivedAt: null,
      updatedAt: new Date(),
    });
    this.namespaces.set(slug, updated);
    return Promise.resolve(updated);
  }

  createPolicyVersion(input: ICreatePolicyVersionInput): Promise<ICreatePolicyVersionResult> {
    if (this.collisionsRemaining > 0) {
      this.collisionsRemaining -= 1;
      const attempted = (this.policyVersionsByNamespace.get(input.namespaceId) ?? 0) + 1;
      return Promise.reject(
        new PolicyVersionConflictError({ slug: "<simulated>", attemptedVersion: attempted }),
      );
    }
    const current = this.policyVersionsByNamespace.get(input.namespaceId) ?? 0;
    const next = current + 1;
    this.policyVersionsByNamespace.set(input.namespaceId, next);

    const found = Array.from(this.namespaces.values()).find(
      (ns) => ns.props.id === input.namespaceId,
    );
    if (!found) {
      return Promise.reject(
        new Error("InMemoryNamespaceWriteRepository: namespace not found by id"),
      );
    }
    const updated = Namespace.fromProps({
      ...found.props,
      currentPolicyId: BigInt(next),
      updatedAt: new Date(),
    });
    this.namespaces.set(found.props.slug.value, updated);
    return Promise.resolve({ namespace: updated, newPolicyVersion: next });
  }
}
