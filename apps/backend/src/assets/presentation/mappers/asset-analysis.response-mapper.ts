import { AssetAnalysisResponseDTO } from "@shared/backend-api";

import type { AssetAnalysis } from "@/assets/domain/entities/asset-analysis.entity";

export class AssetAnalysisResponseMapper {
  static fromDomain(analysis: AssetAnalysis): AssetAnalysisResponseDTO {
    return {
      analyzer: analysis.props.analyzer,
      analyzerVersion: analysis.props.analyzerVersion ?? undefined,
      findings: analysis.props.findings,
      decision: (analysis.props.decision as AssetAnalysisResponseDTO["decision"]) ?? undefined,
      occurredAt: analysis.props.occurredAt.toISOString(),
    };
  }
}
