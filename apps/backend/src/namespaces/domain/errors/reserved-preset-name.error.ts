import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class ReservedPresetNameError extends DomainError {
  public readonly name: string;
  public readonly reservedPrefix: string;

  constructor(props: { name: string; reservedPrefix: string }) {
    super({
      message:
        `Preset name "${props.name}" uses the reserved "${props.reservedPrefix}" prefix. ` +
        `Names starting with this prefix are reserved for Lafken-internal presets.`,
      params: props,
    });
    this.name = props.name;
    this.reservedPrefix = props.reservedPrefix;
  }
}
