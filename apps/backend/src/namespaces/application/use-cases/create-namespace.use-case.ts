import { Injectable } from "@nestjs/common";

import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceAlreadyExistsError } from "@/namespaces/domain/errors/namespace-already-exists.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import {
  ICreateNamespaceInput,
  NamespaceWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

@Injectable()
export class CreateNamespaceUseCase {
  constructor(
    private readonly queryRepository: NamespaceQueryRepositoryPort,
    private readonly writeRepository: NamespaceWriteRepositoryPort,
  ) {}

  async execute(input: ICreateNamespaceInput): Promise<Namespace> {
    new Slug(input.slug);

    const existing = await this.queryRepository.findBySlug(input.slug);
    if (existing) {
      throw new NamespaceAlreadyExistsError({ slug: input.slug });
    }

    return this.writeRepository.createWithInitialPolicy(input);
  }
}
