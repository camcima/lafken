import { Injectable } from "@nestjs/common";

import {
  ListNamespacesInput,
  NamespacePage,
  NamespaceQueryRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-query.repository.port";

@Injectable()
export class ListNamespacesUseCase {
  constructor(private readonly repository: NamespaceQueryRepositoryPort) {}

  execute(input: ListNamespacesInput): Promise<NamespacePage> {
    return this.repository.list(input);
  }
}
