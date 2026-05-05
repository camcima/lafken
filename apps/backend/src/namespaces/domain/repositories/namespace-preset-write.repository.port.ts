import type { NamespacePreset } from "../entities/namespace-preset.entity";
import type { PresetParams } from "../value-objects/preset-params.value-object";

export interface ICreatePresetInput {
  namespaceId: string;
  name: string;
  params: PresetParams;
  createdBy: string | null;
}

export interface ICreatePresetVersionInput {
  namespaceId: string;
  name: string;
  params: PresetParams;
  createdBy: string | null;
}

export interface ISetPresetActiveInput {
  namespaceId: string;
  name: string;
  active: boolean;
}

export abstract class NamespacePresetWriteRepositoryPort {
  abstract createPreset(input: ICreatePresetInput): Promise<NamespacePreset>;
  abstract createVersion(input: ICreatePresetVersionInput): Promise<NamespacePreset>;
  abstract setActive(input: ISetPresetActiveInput): Promise<NamespacePreset>;
}
