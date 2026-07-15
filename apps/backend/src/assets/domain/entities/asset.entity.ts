import type { AssetState } from "../value-objects/asset-state.value-object";

export interface IAssetProps {
  id: string;
  publicId: string;
  namespaceId: string;
  policyVersionId: string;
  storageBindingId: string;
  storageKey: string;
  state: AssetState;
  stateReason: string | null;
  sizeBytes: bigint | null;
  mimeType: string | null;
  declaredMimeType: string | null;
  width: number | null;
  height: number | null;
  contentHash: Buffer | null;
  /**
   * 64-bit DCT-based perceptual hash (sharp-phash output, packed into 8
   * bytes). Null until image inspection runs; null forever for non-image
   * payloads. Used for visual-similarity reasoning, not for identity —
   * `contentHash` is still the canonical bytewise fingerprint.
   */
  phash: Buffer | null;
  uploadedBy: string | null;
  externalRefType: string | null;
  externalRefId: string | null;
  customMetadata: Record<string, unknown>;
  captureContext: Record<string, unknown> | null;
  tags: string[];
  legalHold: boolean;
  legalHoldReference: string | null;
  confirmedAt: Date | null;
  stateChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Legal state-transition map for the 11-state asset lifecycle. This is the
 * domain-side source of truth that replaced the (write-only) XState machine:
 * every mutation path still enforces it operationally via the SQL CAS
 * (`WHERE state = :fromState`), and this map documents + unit-tests which
 * `fromState` values each actor may pass.
 *
 *  - uploaded → processing            worker starts the pipeline
 *  - processing → ready/rejected/quarantined_* /processing_failed  pipeline verdicts
 *  - processing_failed → uploaded     operator retry (restartProcessing)
 *  - quarantined_* → ready/rejected   reviewer release / reject
 *  - ready → expired                  retention (future retention worker)
 *  - * (non-terminal) → deleted       operator delete
 *  - expired, deleted                 terminal: no exits
 */
const LEGAL_TRANSITIONS: Readonly<Record<AssetState, readonly AssetState[]>> = {
  pending: ["uploaded", "expired", "deleted"],
  uploaded: ["processing", "deleted"],
  processing: [
    "ready",
    "rejected",
    "quarantined_virus",
    "quarantined_moderation",
    "processing_failed",
    "deleted",
  ],
  ready: ["expired", "deleted"],
  rejected: ["deleted"],
  quarantined_virus: ["ready", "rejected", "deleted"],
  quarantined_moderation: ["ready", "rejected", "deleted"],
  quarantined_invalid_format: ["ready", "rejected", "deleted"],
  processing_failed: ["uploaded", "deleted"],
  expired: [],
  deleted: [],
};

export class Asset {
  constructor(public readonly props: IAssetProps) {}

  static fromProps(props: IAssetProps): Asset {
    return new Asset(props);
  }

  /**
   * Whether moving this asset from its current state to `to` is a legal
   * lifecycle transition. Pure domain logic — persistence still guards the
   * race with a CAS UPDATE; this encodes *which* moves are ever allowed.
   */
  canTransitionTo(to: AssetState): boolean {
    return LEGAL_TRANSITIONS[this.props.state].includes(to);
  }
}
