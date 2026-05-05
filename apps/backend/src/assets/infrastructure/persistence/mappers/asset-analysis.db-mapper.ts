import { AssetAnalysis } from "@/assets/domain/entities/asset-analysis.entity";

export class AssetAnalysisDbMapper {
  static toDomain(row: Record<string, any>): AssetAnalysis {
    return AssetAnalysis.fromProps({
      id: row["id"] as string,
      assetId: row["asset_id"] as string,
      analyzer: row["analyzer"] as string,
      analyzerVersion: (row["analyzer_version"] as string | null) ?? null,
      findings: (row["findings"] as Record<string, unknown>) ?? {},
      decision: (row["decision"] as string | null) ?? null,
      occurredAt: new Date(row["occurred_at"] as string),
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
