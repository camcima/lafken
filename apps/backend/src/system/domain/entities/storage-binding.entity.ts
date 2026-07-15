export interface IStorageBindingProps {
  id: string;
  name: string;
  adapterType: "gcs";
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Decoded shape of a GCS storage binding's `config` blob. The domain owns
 * this as a plain, framework-free shape — no zod, no third-party library —
 * per the hexagonal rule that domain code must not depend on anything
 * external. Runtime validation of untrusted input against this shape lives
 * in the application layer (`@/system/application/gcs-binding-config.schema`),
 * whose zod schema is typed against this interface so the two cannot
 * silently drift apart.
 *
 * The invariant "config matches this shape when adapterType is 'gcs'" is
 * enforced once, at the aggregate's only two mutation entry points
 * (CreateStorageBindingUseCase / UpdateStorageBindingUseCase), both of which
 * validate untrusted input before ever calling `StorageBinding.fromProps()`.
 * `getGcsConfig()` below trusts that invariant rather than re-validating
 * with a framework dependency the domain isn't allowed to have.
 *
 * Extends `Record<string, unknown>` (rather than a bare object type) so it
 * stays assignable both ways with `IStorageBindingProps.config` — a
 * narrower, validated view of the same underlying blob, not a distinct
 * shape requiring an unsafe double-cast at every call site.
 */
export interface GcsBindingConfig extends Record<string, unknown> {
  bucket: string;
  projectId: string;
  prefix?: string;
}

export class StorageBinding {
  constructor(public readonly props: IStorageBindingProps) {}

  static fromProps(props: IStorageBindingProps): StorageBinding {
    return new StorageBinding(props);
  }

  getGcsConfig(): GcsBindingConfig {
    if (this.props.adapterType !== "gcs") {
      throw new Error(
        `StorageBinding.getGcsConfig() called on a non-GCS binding — invariant violation.`,
      );
    }
    return this.props.config as GcsBindingConfig;
  }
}
