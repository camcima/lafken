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
  /** Asset internal ids covered by this hold; provided by the use case from the M2M. */
  assetInternalIds: string[];
}

export abstract class LegalHoldWriteRepositoryPort {
  /**
   * Atomically inserts a `legal_holds` row, the `legal_hold_assets` rows, and
   * sets `assets.legal_hold = true` + `assets.legal_hold_reference = caseReference`
   * for every covered asset. Idempotent on the M2M PK.
   */
  abstract placeHold(input: IPlaceLegalHoldInput): Promise<LegalHold>;

  /**
   * Atomically marks the hold inactive (filling `lifted_*`) and recomputes
   * `assets.legal_hold` + `assets.legal_hold_reference` for the covered assets,
   * leaving any asset still covered by another active hold flagged as held.
   */
  abstract liftHold(input: ILiftLegalHoldInput): Promise<LegalHold>;
}
