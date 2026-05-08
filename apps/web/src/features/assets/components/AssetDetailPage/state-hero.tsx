import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

interface IStateHeroProps {
  state: string;
  stateReason: string | null;
  legalHold: boolean;
  legalHoldReference: string | null;
}

const VIRUS_REASON_PREFIX = "virus_detected:";

function parseVirusSignature(stateReason: string | null): string | null {
  if (stateReason === null) return null;
  if (!stateReason.startsWith(VIRUS_REASON_PREFIX)) return null;
  const sig: string = stateReason.slice(VIRUS_REASON_PREFIX.length).trim();
  return sig.length > 0 ? sig : null;
}

interface IHeroField {
  fieldKey: string;
  fieldValue: string;
  muted?: boolean;
}

// Processing step numbers
const PROCESSING_STEP = 4;
const PROCESSING_TOTAL = 5;
const PROCESSING_ELAPSED_S = 8;
const MAX_FAILED_RETRIES = 3;
const QUARANTINE_FLAG_SEC = 11;

interface ILegalHoldBannerProps {
  legalHoldReference: string | null;
}

function LegalHoldBanner({ legalHoldReference }: ILegalHoldBannerProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="border-warn/40 bg-warn-soft/40 mb-3 flex items-start gap-3 rounded-md border px-4 py-3">
      <Lock size={16} className="text-warn mt-0.5" />
      <div className="flex-1">
        <div className="text-[12.5px] font-semibold">
          {t("pages.assetDetail.legalHoldBanner.title")}
        </div>
        {legalHoldReference !== null && legalHoldReference.length > 0 && (
          <div className="text-muted-foreground font-mono text-[11.5px]">{legalHoldReference}</div>
        )}
      </div>
      {legalHoldReference !== null && legalHoldReference.length > 0 && (
        <Link
          to="/legal-holds"
          search={{ q: legalHoldReference }}
          className="text-latam-indigo text-[11.5px] hover:underline"
        >
          {t("pages.assetDetail.legalHoldBanner.viewMatching")}
        </Link>
      )}
    </div>
  );
}

function HeroFields({ fields }: { fields: IHeroField[] }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-7 gap-y-1.5 px-5 py-2.5 text-[12px]">
      {fields.map(({ fieldKey, fieldValue, muted }) => (
        <div key={fieldKey} className="flex flex-col">
          <span className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {fieldKey}
          </span>
          <span
            className={cn(
              "font-mono text-[12px]",
              muted ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {fieldValue}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StateHero({
  state,
  stateReason,
  legalHold,
  legalHoldReference,
}: IStateHeroProps): React.JSX.Element {
  const { t } = useTranslation();

  if (state === "processing") {
    const fields: IHeroField[] = [
      { fieldKey: t("pages.assetDetail.stateHero.fields.pipeline"), fieldValue: "rn_01HXJ8K48S" },
      { fieldKey: t("pages.assetDetail.stateHero.fields.worker"), fieldValue: "processor-7" },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.attempts"),
        fieldValue: t("pages.assetDetail.stateHeroValues.processing.attemptsValue", {
          current: 1,
          total: 4,
        }),
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.nextStep"),
        // stage names are pipeline identifiers, not translated
        fieldValue: "moderate",
      },
    ];
    return (
      <>
        {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
        <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
          <div className="border-info-line bg-info-soft relative flex min-w-[260px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
            <span
              className="bg-info size-2.5 rounded-full"
              style={{ boxShadow: "0 0 0 4px rgba(21,85,121,0.2)" }}
            />
            <div>
              <div className="text-info text-[14px] font-semibold">
                {t("pages.assetDetail.stateHero.processing.title")}
              </div>
              <div className="text-info/85 text-[11.5px]">
                {t("pages.assetDetail.stateHero.processing.subtitle", {
                  step: PROCESSING_STEP,
                  total: PROCESSING_TOTAL,
                  stage: "transform",
                  elapsed: PROCESSING_ELAPSED_S,
                })}
              </div>
            </div>
          </div>
          <HeroFields fields={fields} />
        </div>
      </>
    );
  }

  if (state === "processing_failed") {
    const fields: IHeroField[] = [
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.lastError"),
        fieldValue: "transformer_timeout (30s)",
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.attempts"),
        fieldValue: t("pages.assetDetail.stateHeroValues.processingFailed.attemptsValue", {
          current: MAX_FAILED_RETRIES,
          total: MAX_FAILED_RETRIES,
        }),
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.nextRetry"),
        fieldValue: t("pages.assetDetail.stateHeroValues.processingFailed.nextRetryManual"),
      },
      { fieldKey: t("pages.assetDetail.stateHero.fields.run"), fieldValue: "rn_01HXJ8K48S" },
    ];
    return (
      <>
        {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
        <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
          <div className="border-alert-line bg-alert-soft flex min-w-[260px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
            <span
              className="bg-alert size-2.5 rounded-full"
              style={{ boxShadow: "0 0 0 4px rgba(138,66,9,0.18)" }}
            />
            <div>
              <div className="text-alert text-[14px] font-semibold">
                {t("pages.assetDetail.stateHero.processingFailed.title")}
              </div>
              <div className="text-alert/85 text-[11.5px]">
                {t("pages.assetDetail.stateHero.processingFailed.subtitle", {
                  stage: "transform",
                  retries: MAX_FAILED_RETRIES,
                })}
              </div>
            </div>
          </div>
          <HeroFields fields={fields} />
        </div>
      </>
    );
  }

  if (state === "quarantined_virus") {
    const signature: string | null = parseVirusSignature(stateReason);
    const fields: IHeroField[] = [
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.flaggedBy"),
        fieldValue: "clamav",
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.signature"),
        fieldValue: signature ?? t("pages.assetDetail.stateHero.fields.signatureUnknown"),
        muted: signature === null,
      },
    ];
    return (
      <>
        {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
        <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
          <div className="border-alert-line bg-alert-soft flex min-w-[280px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
            <span
              className="bg-alert size-2.5 rounded-full"
              style={{ boxShadow: "0 0 0 4px rgba(138,66,9,0.2)" }}
            />
            <div>
              <div className="text-alert text-[14px] font-semibold">
                {t("pages.assetDetail.stateHero.quarantinedVirus.title")}
              </div>
              <div className="text-alert/85 text-[11.5px]">
                {t("pages.assetDetail.stateHero.quarantinedVirus.subtitleFallback")}
              </div>
            </div>
          </div>
          <HeroFields fields={fields} />
        </div>
      </>
    );
  }

  if (state === "quarantined_invalid_format") {
    const fields: IHeroField[] = [
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.reason"),
        fieldValue: stateReason ?? t("pages.assetDetail.stateHero.fields.reasonUnknown"),
        muted: stateReason === null,
      },
    ];
    return (
      <>
        {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
        <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
          <div className="border-alert-line bg-alert-soft flex min-w-[280px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
            <span
              className="bg-alert size-2.5 rounded-full"
              style={{ boxShadow: "0 0 0 4px rgba(138,66,9,0.2)" }}
            />
            <div>
              <div className="text-alert text-[14px] font-semibold">
                {t("pages.assetDetail.stateHero.quarantinedInvalidFormat.title")}
              </div>
              <div className="text-alert/85 text-[11.5px]">
                {t("pages.assetDetail.stateHero.quarantinedInvalidFormat.subtitleFallback")}
              </div>
            </div>
          </div>
          <HeroFields fields={fields} />
        </div>
      </>
    );
  }

  if (state === "quarantined_moderation") {
    const fields: IHeroField[] = [
      { fieldKey: t("pages.assetDetail.stateHero.fields.flaggedBy"), fieldValue: "moderation-v2" },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.topCategory"),
        fieldValue: "violence · 0.78",
      },
      { fieldKey: t("pages.assetDetail.stateHero.fields.threshold"), fieldValue: "0.65" },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.inQueue"),
        fieldValue: t("pages.assetDetail.stateHeroValues.quarantinedModeration.inQueueValue", {
          hours: 2,
          minutes: 14,
        }),
      },
    ];
    return (
      <>
        {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
        <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
          <div className="border-alert-line bg-alert-soft flex min-w-[280px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
            <span
              className="bg-alert size-2.5 rounded-full"
              style={{ boxShadow: "0 0 0 4px rgba(138,66,9,0.2)" }}
            />
            <div>
              <div className="text-alert text-[14px] font-semibold">
                {t("pages.assetDetail.stateHero.quarantinedModeration.title")}
              </div>
              <div className="text-alert/85 text-[11.5px]">
                {t("pages.assetDetail.stateHero.quarantinedModeration.subtitle", {
                  flagSec: QUARANTINE_FLAG_SEC,
                })}
              </div>
            </div>
          </div>
          <HeroFields fields={fields} />
        </div>
      </>
    );
  }

  if (state === "ready") {
    const fields: IHeroField[] = [
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.pipeline"),
        fieldValue: t("pages.assetDetail.stateHeroValues.ready.pipelineValue", { seconds: 11.2 }),
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.retention"),
        fieldValue: t("pages.assetDetail.stateHeroValues.ready.retentionValue", {
          years: 7,
          date: "2033-05-03",
        }),
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.legalHold"),
        fieldValue: t("pages.assetDetail.stateHeroValues.ready.legalHoldNone"),
        muted: true,
      },
      {
        fieldKey: t("pages.assetDetail.stateHero.fields.serving"),
        fieldValue: t("pages.assetDetail.stateHeroValues.ready.servingValue", { ttl: "5m" }),
      },
    ];
    return (
      <>
        {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
        <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
          <div className="border-ok-line bg-ok-soft flex min-w-[240px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
            <span
              className="bg-ok size-2.5 rounded-full"
              style={{ boxShadow: "0 0 0 4px rgba(26,107,70,0.22)" }}
            />
            <div>
              <div className="text-ok text-[14px] font-semibold">
                {t("pages.assetDetail.stateHero.ready.title")}
              </div>
              <div className="text-ok/85 text-[11.5px]">
                {t("pages.assetDetail.stateHero.ready.subtitle", { since: "May 3, 08:14 UTC" })}
              </div>
            </div>
          </div>
          <HeroFields fields={fields} />
        </div>
      </>
    );
  }

  // Generic fallback for transitional / terminal states the UI doesn't yet
  // specialize on (uploaded, pending, rejected, expired, deleted, …). Surfaces
  // the raw state so the page never silently masquerades as "Ready".
  const fallbackFields: IHeroField[] =
    stateReason === null
      ? []
      : [
          {
            fieldKey: t("pages.assetDetail.stateHero.fields.reason"),
            fieldValue: stateReason,
          },
        ];
  return (
    <>
      {legalHold && <LegalHoldBanner legalHoldReference={legalHoldReference} />}
      <div className="border-border bg-card mb-5 flex flex-col items-stretch overflow-hidden rounded-md border md:flex-row">
        <div className="bg-muted/30 flex min-w-[240px] items-center gap-3 border-b px-5 py-3.5 md:border-r md:border-b-0">
          <span className="bg-muted-foreground size-2.5 rounded-full" />
          <div>
            <div className="text-foreground text-[14px] font-semibold">
              {t(`assetStates.${state}`, { defaultValue: state })}
            </div>
            <div className="text-muted-foreground text-[11.5px]">
              {t("pages.assetDetail.stateHero.generic.subtitle")}
            </div>
          </div>
        </div>
        <HeroFields fields={fallbackFields} />
      </div>
    </>
  );
}
