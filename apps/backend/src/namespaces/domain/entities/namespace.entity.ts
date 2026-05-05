import { Slug } from "../value-objects/slug.value-object";

export interface INamespaceProps {
  id: string;
  slug: Slug;
  displayName: string;
  description: string | null;
  currentPolicyId: string;
  storageBindingId: string;
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
