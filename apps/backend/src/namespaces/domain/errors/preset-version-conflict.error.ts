import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class PresetVersionConflictError extends DomainError {
  public readonly slug: string;
  public readonly name: string;
  public readonly attemptedVersion: number;

  constructor(props: { slug: string; name: string; attemptedVersion: number }) {
    super({
      message: `Concurrent edit on preset "${props.name}" in namespace "${props.slug}" — version ${props.attemptedVersion} was claimed by another writer.`,
      params: props,
    });
    this.slug = props.slug;
    this.name = props.name;
    this.attemptedVersion = props.attemptedVersion;
  }
}
