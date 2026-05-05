import { beforeEach, describe, expect, it } from "vitest";

import { CreatePresetUseCase } from "@/namespaces/application/use-cases/create-preset.use-case";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PresetNameAlreadyExistsError } from "@/namespaces/domain/errors/preset-name-already-exists.error";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespacePresetWriteRepository } from "../__fakes__/in-memory-namespace-preset-write.repository";
import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";

const VALID_PARAMS = PresetParams.fromUnknown({
  width: 800,
  height: 600,
  fit: "cover",
  format: "webp",
  quality: 80,
  dpr: 2,
});

function makeNamespace(opts: { slug: string; archived?: boolean }): Namespace {
  return Namespace.fromProps({
    id: "ns-1",
    slug: new Slug(opts.slug),
    displayName: "X",
    description: null,
    currentPolicyId: "pol-1",
    storageBindingId: "sb-1",
    archivedAt: opts.archived ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("CreatePresetUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespacePresetWriteRepository;
  let useCase: CreatePresetUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespacePresetWriteRepository();
    useCase = new CreatePresetUseCase(queryRepo, writeRepo);
  });

  it("creates v1 with active=true on an active namespace", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    queryRepo.seed([ns]);

    const preset = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: "ops@latam.com",
    });

    expect(preset.props.version).toBe(1);
    expect(preset.props.active).toBe(true);
    expect(preset.props.name).toBe("thumbnail");
  });

  it("throws NamespaceNotFoundError when slug missing", async () => {
    await expect(
      useCase.execute({
        slug: "ghost",
        name: "x",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });

  it("throws NamespaceArchivedError when namespace is archived", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos", archived: true });
    queryRepo.seed([ns]);
    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceArchivedError);
  });

  it("throws PresetNameAlreadyExistsError when name is taken", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    queryRepo.seed([ns]);
    const existing = NamespacePreset.fromProps({
      id: "pres-1",
      namespaceId: "ns-1",
      name: "thumbnail",
      version: 1,
      params: VALID_PARAMS,
      cdnMaxAge: null,
      signedUrlTtl: null,
      preGenerate: false,
      requiredPermission: null,
      description: null,
      active: true,
      createdAt: new Date(),
    });
    queryRepo.seedPresets([existing]);

    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "thumbnail",
        params: VALID_PARAMS,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(PresetNameAlreadyExistsError);
  });
});
