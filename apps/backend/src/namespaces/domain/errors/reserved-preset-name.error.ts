import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class ReservedPresetNameError extends DomainError {
  public readonly presetName: string;
  public readonly reservedPrefix: string;

  constructor(props: { presetName: string; reservedPrefix: string }) {
    super({
      message:
        `Preset name "${props.presetName}" uses the reserved "${props.reservedPrefix}" prefix. ` +
        `Names starting with this prefix are reserved for Lafken-internal presets.`,
      params: { name: props.presetName, reservedPrefix: props.reservedPrefix },
    });
    this.presetName = props.presetName;
    this.reservedPrefix = props.reservedPrefix;
  }
}
