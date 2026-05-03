export interface INamespacePresetProps {
  id: bigint;
  namespaceId: bigint;
  name: string;
  version: number;
  transformation: Record<string, unknown>;
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
