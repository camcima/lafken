import { Slug } from "../value-objects/slug.value-object";

export interface INamespaceProps {
  id: bigint;
  slug: Slug;
  displayName: string;
  description: string | null;
  currentPolicyId: bigint;
  storageBindingId: bigint;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Namespace {
  constructor(public readonly props: INamespaceProps) {}

  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  static fromProps(props: INamespaceProps): Namespace {
    return new Namespace(props);
  }
}
