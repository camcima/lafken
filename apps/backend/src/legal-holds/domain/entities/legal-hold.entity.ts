export interface LegalHoldProps {
  id: string;
  caseReference: string;
  description: string;
  scopeSummary: string;
  placedBy: string;
  placedAt: Date;
  liftedBy: string | null;
  liftedAt: Date | null;
  liftReason: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class LegalHold {
  constructor(public readonly props: LegalHoldProps) {}

  static fromProps(props: LegalHoldProps): LegalHold {
    return new LegalHold(props);
  }
}
