import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class PresetNameAlreadyExistsError extends DomainError {
  public readonly slug: string;
  public readonly name: string;

  constructor(props: { slug: string; name: string }) {
    super({
      message: `Preset "${props.name}" already exists in namespace "${props.slug}".`,
      params: props,
    });
    this.slug = props.slug;
    this.name = props.name;
  }
}
