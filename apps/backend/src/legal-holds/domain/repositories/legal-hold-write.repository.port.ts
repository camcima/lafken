import type { LegalHold } from "../entities/legal-hold.entity";

export interface IPlaceLegalHoldInput {
  caseReference: string;
  description: string;
  scopeSummary: string;
  placedBy: string;
  /** Internal asset ids (uuid). Already deduped and resolved by the use case. */
  assetInternalIds: string[];
}

export interface ILiftLegalHoldInput {
  id: string;
  liftedBy: string;
  liftReason: string;
}

export interface ILiftLegalHoldResult {
  hold: LegalHold;
  /** Number of asset rows whose legal_hold flag/reference were recomputed. */
  affectedAssetCount: number;
}

export abstract class LegalHoldWriteRepositoryPort {
  /**
   * Atomically inserts a `legal_holds` row, the `legal_hold_assets` rows, and
   * sets `assets.legal_hold = true` + `assets.legal_hold_reference = caseReference`
   * for every covered asset. Idempotent on the M2M PK.
   */
  abstract placeHold(input: IPlaceLegalHoldInput): Promise<LegalHold>;

  /**
   * Atomically marks the hold inactive (filling `lifted_*`) — guarded by
   * `WHERE active = true`, so a concurrent lift loses and gets
   * `LegalHoldAlreadyLiftedError` instead of silently overwriting the first
   * lift's metadata — and recomputes `assets.legal_hold` +
   * `assets.legal_hold_reference` for every covered asset in a single SQL
   * statement keyed on `legal_hold_id` (stacking-aware: assets still under
   * another active hold stay flagged). Throws `LegalHoldNotFoundError` when
   * the id doesn't exist.
   */
  abstract liftHold(input: ILiftLegalHoldInput): Promise<ILiftLegalHoldResult>;
}
