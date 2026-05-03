export interface IAssetAnalysisProps {
  id: bigint;
  assetId: bigint;
  analyzer: string;
  analyzerVersion: string | null;
  findings: Record<string, unknown>;
  decision: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AssetAnalysis {
  constructor(public readonly props: IAssetAnalysisProps) {}

  static fromProps(props: IAssetAnalysisProps): AssetAnalysis {
    return new AssetAnalysis(props);
  }
}
