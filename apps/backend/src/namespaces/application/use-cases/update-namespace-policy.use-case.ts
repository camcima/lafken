import { Injectable } from "@nestjs/common";

import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PolicyVersionConflictError } from "@/namespaces/domain/errors/policy-version-conflict.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import type {
  ICreateNamespaceInitialPolicyInput,
  ICreatePolicyVersionResult,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { NamespaceWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-write.repository.port";

const RETRY_LIMIT = 1;

export interface IUpdateNamespacePolicyInput {
  slug: string;
  policy: ICreateNamespaceInitialPolicyInput;
  createdBy: string | null;
}

@Injectable()
export class UpdateNamespacePolicyUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
  ) {}

  async execute(input: IUpdateNamespacePolicyInput): Promise<ICreatePolicyVersionResult> {
    const namespace = await this.queryRepository.findBySlug(input.slug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.slug });
    }
    if (namespace.props.archivedAt !== null) {
      throw new NamespaceArchivedError({ slug: input.slug });
    }

    let lastError: PolicyVersionConflictError | null = null;
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
      try {
        return await this.writeRepository.createPolicyVersion({
          namespaceId: namespace.props.id,
          policy: input.policy,
          createdBy: input.createdBy,
        });
      } catch (err) {
        if (err instanceof PolicyVersionConflictError) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    // lastError is always set: the loop only exits here after catching
    // at least one PolicyVersionConflictError in every iteration.
    throw new PolicyVersionConflictError({
      slug: input.slug,
      attemptedVersion: lastError!.attemptedVersion,
    });
  }
}
