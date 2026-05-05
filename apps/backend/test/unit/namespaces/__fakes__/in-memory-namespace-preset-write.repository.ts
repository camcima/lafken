import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetVersionConflictError } from "@/namespaces/domain/errors/preset-version-conflict.error";
import {
  ICreatePresetInput,
  ICreatePresetVersionInput,
  ISetPresetActiveInput,
  NamespacePresetWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";

interface IRow {
  id: string;
  namespaceId: string;
  name: string;
  version: number;
  preset: NamespacePreset;
}

export class InMemoryNamespacePresetWriteRepository extends NamespacePresetWriteRepositoryPort {
  readonly rows: IRow[] = [];
  collisionsRemaining = 0; // tests set this to 1 to simulate transient unique-violations

  seed(preset: NamespacePreset): void {
    this.rows.push({
      id: preset.props.id,
      namespaceId: preset.props.namespaceId,
      name: preset.props.name,
      version: preset.props.version,
      preset,
    });
  }

  createPreset(input: ICreatePresetInput): Promise<NamespacePreset> {
    const id = `pres-${this.rows.length + 1}`;
    const preset = NamespacePreset.fromProps({
      id,
      namespaceId: input.namespaceId,
      name: input.name,
      version: 1,
      params: input.params,
      cdnMaxAge: null,
      signedUrlTtl: null,
      preGenerate: false,
      requiredPermission: null,
      description: null,
      active: true,
      createdAt: new Date(),
    });
    this.rows.push({ id, namespaceId: input.namespaceId, name: input.name, version: 1, preset });
    return Promise.resolve(preset);
  }

  createVersion(input: ICreatePresetVersionInput): Promise<NamespacePreset> {
    const versions = this.rows.filter(
      (row) => row.namespaceId === input.namespaceId && row.name === input.name,
    );
    if (versions.length === 0) {
      return Promise.reject(new PresetNotFoundError({ slug: "<unknown>", name: input.name }));
    }
    const latest = versions.reduce((acc, cur) => (acc.version >= cur.version ? acc : cur));
    const nextVersion = latest.version + 1;
    if (this.collisionsRemaining > 0) {
      this.collisionsRemaining -= 1;
      return Promise.reject(
        new PresetVersionConflictError({
          slug: "<simulated>",
          name: input.name,
          attemptedVersion: nextVersion,
        }),
      );
    }
    const id = `pres-${this.rows.length + 1}`;
    const preset = NamespacePreset.fromProps({
      id,
      namespaceId: input.namespaceId,
      name: input.name,
      version: nextVersion,
      params: input.params,
      cdnMaxAge: null,
      signedUrlTtl: null,
      preGenerate: false,
      requiredPermission: null,
      description: null,
      active: latest.preset.props.active,
      createdAt: new Date(),
    });
    this.rows.push({
      id,
      namespaceId: input.namespaceId,
      name: input.name,
      version: nextVersion,
      preset,
    });
    return Promise.resolve(preset);
  }

  setActive(input: ISetPresetActiveInput): Promise<NamespacePreset> {
    const versions = this.rows.filter(
      (row) => row.namespaceId === input.namespaceId && row.name === input.name,
    );
    if (versions.length === 0) {
      return Promise.reject(new PresetNotFoundError({ slug: "<unknown>", name: input.name }));
    }
    const latest = versions.reduce((acc, cur) => (acc.version >= cur.version ? acc : cur));
    const updated = NamespacePreset.fromProps({ ...latest.preset.props, active: input.active });
    latest.preset = updated;
    return Promise.resolve(updated);
  }
}
