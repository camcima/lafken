import { PresetParams } from "../value-objects/preset-params.value-object";

export interface INamespacePresetProps {
  id: string;
  namespaceId: string;
  name: string;
  version: number;
  params: PresetParams;
  cdnMaxAge: number | null;
  signedUrlTtl: number | null;
  preGenerate: boolean;
  requiredPermission: string | null;
  description: string | null;
  active: boolean;
  createdAt: Date;
}

export class NamespacePreset {
  constructor(public readonly props: INamespacePresetProps) {}

  static fromProps(props: INamespacePresetProps): NamespacePreset {
    return new NamespacePreset(props);
  }
}
