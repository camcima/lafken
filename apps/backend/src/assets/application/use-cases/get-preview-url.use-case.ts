import { Injectable } from "@nestjs/common";

import { ActivePresetNotFoundError } from "@/assets/domain/errors/active-preset-not-found.error";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotPreviewableError } from "@/assets/domain/errors/asset-not-previewable.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import {
  type IPreviewSpec,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";
import { isAssetPreviewable } from "@/assets/domain/value-objects/asset-state.value-object";
import { SYSTEM_PRESETS } from "@/assets/domain/value-objects/system-presets";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { MetricsPort } from "@/shared/application/metrics.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

/**
 * TTL for the V4-signed source URL handed to imgproxy. Keeps a comfortable
 * margin over imgproxy's render + retry window so a transient retry never
 * outlives the URL.
 */
const PREVIEW_SOURCE_URL_TTL_SECONDS = 900;
const MS_PER_SECOND = 1000;
const UNKNOWN_NAMESPACE_SLUG = "unknown";

export interface IGetPreviewUrlInput {
  publicId: string;
  presetName: string;
}

export interface IGetPreviewUrlResult {
  url: string;
  expiresAt: Date;
  namespaceSlug: string;
  presetName: string;
}

@Injectable()
export class GetPreviewUrlUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly namespaceQueryRepo: NamespaceQueryRepositoryPort,
    private readonly storageBindingQueryRepo: StorageBindingQueryRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
    private readonly previewUrlSigner: PreviewUrlSignerPort,
    private readonly metrics: MetricsPort,
  ) {}

  async execute(input: IGetPreviewUrlInput): Promise<IGetPreviewUrlResult> {
    const startedAt: number = Date.now();

    const asset = await this.assetQueryRepo.findByPublicId(input.publicId);
    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    // Defense in depth: refuse to mint preview URLs for non-previewable
    // states (quarantined / rejected / deleted / expired). Even though the
    // bytes are physically moved out of imgproxy's reach on quarantine,
    // refusing to sign new URLs here closes the future-issuance vector and
    // shields the bytes from any caller that already knows the publicId.
    if (!isAssetPreviewable(asset.props.state)) {
      throw new AssetNotPreviewableError({
        publicId: input.publicId,
        currentState: asset.props.state,
      });
    }

    const spec: IPreviewSpec | null = await this.resolveActivePresetSpec(
      asset.props.namespaceId,
      input.presetName,
    );
    if (spec === null) {
      throw new ActivePresetNotFoundError({ presetName: input.presetName });
    }

    const binding = await this.storageBindingQueryRepo.findById(asset.props.storageBindingId);
    const gcs = binding?.getGcsConfig();
    if (!gcs) {
      // Externally indistinguishable from an unknown preset: the asset cannot
      // be previewed. Identical to the pre-extraction controller behavior.
      throw new ActivePresetNotFoundError({ presetName: input.presetName });
    }

    // Mint a V4-signed read URL against the asset's binding. imgproxy fetches
    // this URL anonymously, so the bucket itself never has to be public-read
    // and Lafken can host any number of bindings without per-bucket setup on
    // imgproxy. The TTL must outlive imgproxy's worst-case render+retry
    // window for a single asset.
    const sourceUrl: string = await this.assetStorage.signSourceUrlForRendering({
      binding: { bucket: gcs.bucket, projectId: gcs.projectId },
      storageKey: asset.props.storageKey,
      ttlSeconds: PREVIEW_SOURCE_URL_TTL_SECONDS,
    });

    const url: string | null = this.previewUrlSigner.sign({ sourceUrl, preset: spec });
    if (url === null) {
      throw new ActivePresetNotFoundError({ presetName: input.presetName });
    }

    const expiresAt: Date = new Date(Date.now() + PREVIEW_SOURCE_URL_TTL_SECONDS * MS_PER_SECOND);
    const namespaceSlug: string =
      (await this.assetQueryRepo.findNamespaceSlug(asset.props.namespaceId)) ??
      UNKNOWN_NAMESPACE_SLUG;

    this.metrics.recordPreviewUrlIssued({ namespaceSlug, presetName: input.presetName });
    this.metrics.recordPreviewUrlDuration({
      namespaceSlug,
      presetName: input.presetName,
      durationMs: Date.now() - startedAt,
    });

    return { url, expiresAt, namespaceSlug, presetName: input.presetName };
  }

  /**
   * Resolves the active preset spec for a namespace by name. `listPresets`
   * returns exactly one row per preset name (the latest version) but does
   * NOT filter by `active` — callers that only want servable presets must
   * filter on `props.active` (see `NamespaceQueryRepositoryPort.listPresets`
   * doc). Collapsing to the highest *active* version per name mirrors the
   * pre-extraction controller behavior verbatim: an inactive/deactivated
   * namespace preset must never become resolvable for preview. System
   * presets take precedence — namespace preset names can never carry the
   * `lafken:` prefix (enforced at create/update), but the dedupe pass
   * remains as defense-in-depth.
   */
  private async resolveActivePresetSpec(
    namespaceId: string,
    presetName: string,
  ): Promise<IPreviewSpec | null> {
    const latestByName: Map<string, IPreviewSpec> = new Map();
    for (const sys of SYSTEM_PRESETS) {
      latestByName.set(sys.name, sys.spec);
    }
    const list = await this.namespaceQueryRepo.listPresets(namespaceId);
    for (const preset of list) {
      if (preset.props.active && !latestByName.has(preset.props.name)) {
        latestByName.set(preset.props.name, preset.props.params.props);
      }
    }
    return latestByName.get(presetName) ?? null;
  }
}
