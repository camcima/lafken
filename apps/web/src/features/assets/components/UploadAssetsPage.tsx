import { type IUploadDropzoneRenderProps, type IUploadFile, UploadDropzone } from "@lafken/react";
import type { NamespacePolicyResponseDTO, NamespaceResponseDTO } from "@shared/backend-api";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Image as ImageIcon,
  Layers,
  Shield,
  Tag,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { assetsKeys } from "@/features/assets/keys";
import { useNamespacePolicies, useNamespaces } from "@/features/namespaces/hooks/useNamespaces";
import { getLafkenClient } from "@/lib/lafken-client";
import { cn, fmtBytes } from "@/lib/utils";

const NAMESPACE_FETCH_LIMIT = 100;
const MAX_TAGS = 32;
const MAX_TAG_LENGTH = 64;

/**
 * Lifecycle states that represent a terminal failure for an upload tile —
 * the file did make it to the backend but the pipeline rejected, quarantined,
 * timed out polling, or otherwise failed it. These render with the warn-line
 * border and surface the structured error message to the user.
 */
const TERMINAL_FAILURE_STATES: ReadonlyArray<IUploadFile["state"]> = [
  "error",
  "failed",
  "quarantined",
  "rejected",
];

function tileBorderForState(state: IUploadFile["state"]): string {
  if (state === "ready") return "border-ok-line";
  if (TERMINAL_FAILURE_STATES.includes(state)) return "border-warn-line";
  return "border-border";
}

interface IUploadAssetsPageProps {
  /** Optional preselected namespace (from `?ns=<slug>`). */
  preselectedSlug?: string;
}

export function UploadAssetsPage(props: IUploadAssetsPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: namespacesPage } = useNamespaces({ page: 1, limit: NAMESPACE_FETCH_LIMIT });
  const namespaces: NamespaceResponseDTO[] = useMemo(
    () => (namespacesPage?.data ?? []).filter((entry) => !entry.archivedAt),
    [namespacesPage],
  );

  const [explicitNsSlug, setNsSlug] = useState(props.preselectedSlug ?? "");
  // Resolve the effective slug: explicit user choice wins; otherwise fall back
  // to the first non-archived namespace once the list loads. Doing this in
  // memo (instead of useEffect+setState) avoids the cascading-render warning.
  const nsSlug: string = useMemo(() => {
    if (explicitNsSlug) return explicitNsSlug;
    return namespaces[0]?.slug ?? "";
  }, [explicitNsSlug, namespaces]);
  const ns: NamespaceResponseDTO | undefined = useMemo(
    () => namespaces.find((entry) => entry.slug === nsSlug),
    [namespaces, nsSlug],
  );

  const { data: policiesData } = useNamespacePolicies(ns?.slug ?? "");
  const activePolicy: NamespacePolicyResponseDTO | undefined = useMemo(() => {
    if (!ns || !policiesData) return undefined;
    return policiesData.find((policy) => policy.version === ns.currentPolicyVersion);
  }, [ns, policiesData]);

  const [extType, setExtType] = useState("");
  const [extId, setExtId] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [nsOpen, setNsOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const nsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!nsOpen) return;
    function onDoc(ev: MouseEvent): void {
      if (nsRef.current && !nsRef.current.contains(ev.target as Node)) setNsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
    };
  }, [nsOpen]);

  function addTag(): void {
    const value = tagDraft.trim();
    if (!value || tags.includes(value) || tags.length >= MAX_TAGS) {
      setTagDraft("");
      return;
    }
    if (value.length > MAX_TAG_LENGTH) return;
    setTags([...tags, value]);
    setTagDraft("");
  }

  const sharedMetadata = useMemo(() => {
    const trimmedNote = note.trim();
    return {
      externalRefType: extType.trim() || undefined,
      externalRefId: extId.trim() || undefined,
      note: trimmedNote || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
  }, [extType, extId, note, tags]);

  const client = getLafkenClient();

  function handleAllUploadsDone(): void {
    void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
    void navigate({
      to: "/assets",
      search: nsSlug ? { page: 1, namespaceSlug: nsSlug } : { page: 1 },
    });
  }

  const restrictions = useMemo(() => {
    if (!activePolicy) return undefined;
    return {
      allowedFileTypes: activePolicy.allowedMimeTypes,
      maxFileSize: activePolicy.maxFileSizeBytes,
    };
  }, [activePolicy]);

  if (!ns) {
    return (
      <Card className="px-8 py-16 text-center">
        <div className="text-muted-foreground text-[12.5px]">{t("pages.uploadAssets.loading")}</div>
      </Card>
    );
  }

  return (
    <UploadDropzone
      client={client}
      namespaceSlug={ns.slug}
      sharedMetadata={sharedMetadata}
      restrictions={restrictions}
      render={(renderProps) => (
        <UploadAssetsPageBody
          renderProps={renderProps}
          ns={ns}
          activePolicy={activePolicy}
          namespaces={namespaces}
          nsSlug={nsSlug}
          setNsSlug={setNsSlug}
          nsOpen={nsOpen}
          setNsOpen={setNsOpen}
          nsRef={nsRef}
          extType={extType}
          setExtType={setExtType}
          extId={extId}
          setExtId={setExtId}
          note={note}
          setNote={setNote}
          tags={tags}
          setTags={setTags}
          tagDraft={tagDraft}
          setTagDraft={setTagDraft}
          addTag={addTag}
          hasStarted={hasStarted}
          setHasStarted={setHasStarted}
          onAllUploadsDone={handleAllUploadsDone}
        />
      )}
    />
  );
}

interface IUploadAssetsPageBodyProps {
  renderProps: IUploadDropzoneRenderProps;
  ns: NamespaceResponseDTO;
  activePolicy: NamespacePolicyResponseDTO | undefined;
  namespaces: NamespaceResponseDTO[];
  nsSlug: string;
  setNsSlug: (value: string) => void;
  nsOpen: boolean;
  setNsOpen: (value: boolean) => void;
  nsRef: React.RefObject<HTMLDivElement | null>;
  extType: string;
  setExtType: (value: string) => void;
  extId: string;
  setExtId: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  tags: string[];
  setTags: (next: string[]) => void;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  addTag: () => void;
  hasStarted: boolean;
  setHasStarted: (value: boolean) => void;
  onAllUploadsDone: () => void;
}

function UploadAssetsPageBody(props: IUploadAssetsPageBodyProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    renderProps,
    ns,
    activePolicy,
    namespaces,
    nsSlug,
    setNsSlug,
    nsOpen,
    setNsOpen,
    nsRef,
    extType,
    setExtType,
    extId,
    setExtId,
    note,
    setNote,
    tags,
    setTags,
    tagDraft,
    setTagDraft,
    addTag,
    hasStarted,
    setHasStarted,
    onAllUploadsDone,
  } = props;

  const {
    files,
    rejections,
    dismissRejection,
    isUploading,
    startUpload,
    removeFile,
    getRootProps,
    getInputProps,
  } = renderProps;

  // Auto-dismiss rejections after a short delay so the page doesn't accumulate
  // toasts while the user keeps dragging files.
  const REJECTION_TTL_MS = 6000;
  useEffect(() => {
    if (rejections.length === 0) return undefined;
    const timers = rejections.map((rejection) =>
      setTimeout(() => {
        dismissRejection(rejection.id);
      }, REJECTION_TTL_MS),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [rejections, dismissRejection]);

  // Guard so we only navigate once after the user actually started a batch.
  // Stay on the page if anything errored — the user needs to read the error and
  // decide whether to retry or remove the bad tiles.
  useEffect(() => {
    if (!hasStarted || isUploading || files.length === 0) return;
    if (files.every((file) => file.state === "ready")) {
      onAllUploadsDone();
    }
  }, [hasStarted, isUploading, files, onAllUploadsDone]);

  const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
  const canSubmit = files.length > 0 && !isUploading;
  const erroredCount = files.filter((file) => TERMINAL_FAILURE_STATES.includes(file.state)).length;
  const readyCount = files.filter((file) => file.state === "ready").length;
  const showResultsBanner =
    hasStarted && !isUploading && erroredCount > 0 && readyCount + erroredCount === files.length;

  function handleStart(): void {
    setHasStarted(true);
    void startUpload();
  }

  return (
    <div className="space-y-4">
      {/* Rejection toasts (top-right, stacked, auto-dismiss) */}
      {rejections.length > 0 && (
        <div className="pointer-events-none fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-2">
          {rejections.map((rejection) => (
            <div
              key={rejection.id}
              role="status"
              className="border-warn-line bg-warn-soft text-warn pointer-events-auto rounded-md border px-3 py-2 text-[12px] shadow-md"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{rejection.fileName}</div>
                  <div className="mt-0.5 text-[11px] opacity-90">{rejection.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    dismissRejection(rejection.id);
                  }}
                  className="hover:opacity-70"
                  aria-label={t("pages.uploadAssets.rejection.dismiss")}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results banner — shown after a batch finishes with at least one error */}
      {showResultsBanner && (
        <div
          role="alert"
          className="border-warn-line bg-warn-soft text-warn flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-[12.5px]"
        >
          <span>
            {t("pages.uploadAssets.results.partial", {
              uploaded: readyCount,
              total: files.length,
              failed: erroredCount,
            })}
          </span>
          <Link to="/assets" search={{ page: 1, namespaceSlug: ns.slug }}>
            <Button type="button" variant="outline" size="sm">
              {t("pages.uploadAssets.results.viewUploaded")}
            </Button>
          </Link>
        </div>
      )}

      {/* Back link */}
      <div className="mb-3">
        <Link
          to="/assets"
          className="text-muted-foreground hover:text-latam-indigo inline-flex items-center gap-1 text-[11.5px]"
        >
          <ChevronLeft size={11} /> {t("pages.uploadAssets.backToAssets")}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {t("pages.uploadAssets.title")}
          </h1>
          <div className="text-muted-foreground mt-1 max-w-[640px] text-[12.5px]">
            {t("pages.uploadAssets.subtitle")}
          </div>
        </div>
        <Badge variant="indigo-soft" className="font-mono">
          <Layers size={10} /> {nsSlug || t("pages.uploadAssets.noNamespace")}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {/* 01 Namespace */}
          <NumberedSection
            num={1}
            title={t("pages.uploadAssets.sections.namespace.title")}
            hint={t("pages.uploadAssets.sections.namespace.hint")}
          >
            <div ref={nsRef} className="relative max-w-md">
              <button
                type="button"
                onClick={() => {
                  setNsOpen(!nsOpen);
                }}
                className={cn(
                  "bg-card flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-[12.5px] transition-colors",
                  nsOpen
                    ? "border-latam-indigo ring-latam-indigo/25 ring-2"
                    : "border-input hover:border-latam-indigo/40",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="bg-latam-indigo/10 text-latam-indigo-deep grid size-5 flex-none place-items-center rounded-sm">
                    <Layers size={10} />
                  </span>
                  <span className="truncate font-medium">{ns.displayName}</span>
                  <span className="text-muted-foreground truncate font-mono text-[11px]">
                    {ns.slug}
                  </span>
                </span>
                <ChevronDown
                  size={12}
                  className={cn("flex-none transition-transform", nsOpen && "rotate-180")}
                />
              </button>

              {nsOpen && (
                <div className="border-border bg-card absolute top-full right-0 left-0 z-30 mt-1 max-h-[340px] overflow-auto rounded-md border shadow-lg">
                  {namespaces.map((entry) => {
                    const active = entry.slug === nsSlug;
                    return (
                      <button
                        key={entry.slug}
                        type="button"
                        onClick={() => {
                          setNsSlug(entry.slug);
                          setNsOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                          active ? "bg-latam-indigo/[0.06]" : "hover:bg-secondary/60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-3.5 flex-none place-items-center rounded-full border-2",
                            active ? "border-latam-indigo" : "border-border",
                          )}
                        >
                          {active && <span className="bg-latam-indigo size-1.5 rounded-full" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span className="text-[12.5px] font-medium">{entry.displayName}</span>
                            <span className="text-muted-foreground font-mono text-[10.5px]">
                              {entry.slug}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Policy chips for the selected namespace */}
            {activePolicy ? (
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]">
                <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                  {t("pages.uploadAssets.policyChips.maxFile")}{" "}
                  <b className="text-foreground">{fmtBytes(activePolicy.maxFileSizeBytes)}</b>
                </span>
                <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                  {t("pages.uploadAssets.policyChips.retention")}{" "}
                  <b className="text-foreground">{activePolicy.retentionMode}</b>
                </span>
                <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                  {activePolicy.allowedMimeTypes.join(" · ")}
                </span>
              </div>
            ) : null}
          </NumberedSection>

          {/* 02 Files */}
          <NumberedSection
            num={2}
            title={t("pages.uploadAssets.sections.files.title")}
            hint={t("pages.uploadAssets.sections.files.hint", {
              max: activePolicy ? fmtBytes(activePolicy.maxFileSizeBytes) : "—",
            })}
          >
            <div className="border-border bg-secondary/30 overflow-hidden rounded-md border">
              <div
                {...getRootProps()}
                className="flex flex-col items-center justify-center px-6 py-7 text-center"
              >
                <div className="bg-latam-indigo/10 text-latam-indigo-deep grid size-10 place-items-center rounded-full">
                  <Upload size={18} />
                </div>
                <div className="mt-2.5 text-[13px] font-medium">
                  {t("pages.uploadAssets.dropzone.prompt")}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                  <label className="text-latam-indigo cursor-pointer font-medium hover:underline">
                    {t("pages.uploadAssets.dropzone.browse")}
                    <input className="hidden" {...getInputProps()} />
                  </label>
                </div>
              </div>

              {files.length > 0 && (
                <div className="border-border/60 bg-card/50 grid grid-cols-2 gap-2 border-t p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {files.map((file) => {
                    const tileBorderClass: string = tileBorderForState(file.state);
                    const isFailureState: boolean = TERMINAL_FAILURE_STATES.includes(file.state);
                    return (
                      <div
                        key={file.id}
                        className={cn(
                          "group bg-card relative overflow-hidden rounded border-2 transition-colors",
                          tileBorderClass,
                        )}
                      >
                        <div className="bg-checkerboard relative grid aspect-[4/3] w-full place-items-center overflow-hidden">
                          {file.previewUrl ? (
                            <img
                              src={file.previewUrl}
                              alt={file.name}
                              className={cn(
                                "max-h-full max-w-full object-contain ring-1 ring-black/10",
                                isFailureState ? "opacity-40" : undefined,
                              )}
                            />
                          ) : null}
                          <FileStateOverlay state={file.state} />
                        </div>
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => {
                            removeFile(file.id);
                          }}
                          className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={t("pages.uploadAssets.fileTile.remove")}
                        >
                          <X size={9} />
                        </button>
                        <div className="px-2 py-1.5">
                          <div className="truncate font-mono text-[11px] font-medium">
                            {file.name}
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex items-center justify-between font-mono text-[10px]">
                            <span>{file.type}</span>
                            <span>{fmtBytes(file.size)}</span>
                          </div>
                          {isFailureState && file.error ? (
                            <div className="text-warn mt-1 line-clamp-2 text-[10.5px]">
                              {humanizeFileError(file.error, t)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-border bg-card/80 flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-[11.5px]">
                <div className="text-muted-foreground flex items-center gap-3">
                  <span>
                    <b className="text-foreground tabular-nums">{files.length}</b>{" "}
                    {t("pages.uploadAssets.statusBar.files")}
                  </span>
                  <span className="font-mono">{fmtBytes(totalBytes)}</span>
                </div>
              </div>
            </div>
          </NumberedSection>

          {/* 03 External reference (optional) */}
          <NumberedSection
            num={3}
            title={t("pages.uploadAssets.sections.reference.title")}
            hint={t("pages.uploadAssets.sections.reference.hintOptional")}
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[200px_1fr]">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="upload-ext-type"
                  className="text-foreground text-[11.5px] font-medium"
                >
                  {t("pages.uploadAssets.reference.typeLabel")}{" "}
                  <span className="text-muted-foreground ml-1 text-[10.5px] font-normal">
                    ({t("pages.uploadAssets.optional")})
                  </span>
                </label>
                <input
                  id="upload-ext-type"
                  value={extType}
                  onChange={(ev) => {
                    setExtType(ev.target.value);
                  }}
                  placeholder=""
                  className="border-input bg-card focus:border-latam-indigo focus:ring-latam-indigo/25 h-9 rounded-md border px-2 font-mono text-[12.5px] focus:ring-2 focus:outline-none"
                />
                <span className="text-muted-foreground text-[11px]">
                  {t("pages.uploadAssets.reference.typeHint")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="upload-ext-id"
                  className="text-foreground text-[11.5px] font-medium"
                >
                  {t("pages.uploadAssets.reference.idLabel")}{" "}
                  <span className="text-muted-foreground ml-1 text-[10.5px] font-normal">
                    ({t("pages.uploadAssets.optional")})
                  </span>
                </label>
                <input
                  id="upload-ext-id"
                  value={extId}
                  onChange={(ev) => {
                    setExtId(ev.target.value);
                  }}
                  placeholder=""
                  className="border-input bg-card focus:border-latam-indigo focus:ring-latam-indigo/25 h-9 rounded-md border px-2 font-mono text-[12.5px] focus:ring-2 focus:outline-none"
                />
                <span className="text-muted-foreground text-[11px]">
                  {t("pages.uploadAssets.reference.idHint")}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="upload-note" className="text-foreground text-[11.5px] font-medium">
                {t("pages.uploadAssets.note.label")}{" "}
                <span className="text-muted-foreground ml-1 text-[10.5px] font-normal">
                  ({t("pages.uploadAssets.optional")})
                </span>
              </label>
              <textarea
                id="upload-note"
                value={note}
                rows={3}
                onChange={(ev) => {
                  setNote(ev.target.value);
                }}
                placeholder={t("pages.uploadAssets.note.placeholder")}
                className="border-input bg-card focus:border-latam-indigo focus:ring-latam-indigo/25 rounded-md border px-2 py-1.5 font-mono text-[12.5px] focus:ring-2 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label className="text-foreground text-[11.5px] font-medium">
                {t("pages.uploadAssets.tags.label")}{" "}
                <span className="text-muted-foreground ml-1 text-[10.5px] font-normal">
                  ({t("pages.uploadAssets.optional")})
                </span>
              </label>
              <div
                className={cn(
                  "border-input bg-card focus-within:border-latam-indigo focus-within:ring-latam-indigo/25 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2",
                )}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-latam-indigo/10 text-latam-indigo-deep inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => {
                        setTags(tags.filter((existing) => existing !== tag));
                      }}
                      className="hover:text-latam-pink"
                      aria-label={t("pages.uploadAssets.tags.remove", { tag })}
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(ev) => {
                    setTagDraft(ev.target.value);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      addTag();
                    } else if (ev.key === "Backspace" && !tagDraft && tags.length > 0) {
                      setTags(tags.slice(0, -1));
                    }
                  }}
                  placeholder={tags.length === 0 ? t("pages.uploadAssets.tags.placeholder") : ""}
                  className="placeholder:text-muted-foreground/60 min-w-[140px] flex-1 bg-transparent px-1 py-0.5 font-mono text-[12px] outline-none"
                />
              </div>
              <span className="text-muted-foreground text-[11px]">
                {t("pages.uploadAssets.tags.hint")}
              </span>
            </div>
          </NumberedSection>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-[68px] lg:self-start">
          <Card className="p-0">
            <div className="border-border/60 text-muted-foreground border-b px-4 py-2.5 text-[10.5px] font-medium tracking-wider uppercase">
              {t("pages.uploadAssets.summary.title")}
            </div>
            <dl className="grid grid-cols-[150px_1fr] gap-y-2 px-4 py-3 text-[12px]">
              <dt className="text-muted-foreground">{t("pages.uploadAssets.summary.namespace")}</dt>
              <dd className="font-mono">{nsSlug || "—"}</dd>
              <dt className="text-muted-foreground">{t("pages.uploadAssets.summary.files")}</dt>
              <dd className="font-mono tabular-nums">{files.length}</dd>
              <dt className="text-muted-foreground">{t("pages.uploadAssets.summary.totalSize")}</dt>
              <dd className="font-mono tabular-nums">{fmtBytes(totalBytes)}</dd>
              <dt className="text-muted-foreground truncate">
                {t("pages.uploadAssets.reference.typeLabel")}
              </dt>
              <dd className="truncate font-mono">{extType || "—"}</dd>
              <dt className="text-muted-foreground truncate">
                {t("pages.uploadAssets.reference.idLabel")}
              </dt>
              <dd className="truncate font-mono">{extId || "—"}</dd>
              <dt className="text-muted-foreground">{t("pages.uploadAssets.summary.tags")}</dt>
              <dd className="font-mono">{tags.length}</dd>
            </dl>
          </Card>

          <Card className="p-0">
            <div className="border-border/60 text-muted-foreground border-b px-4 py-2.5 text-[10.5px] font-medium tracking-wider uppercase">
              {t("pages.uploadAssets.pipeline.title")}
            </div>
            <ol className="space-y-2 px-4 py-3 text-[11.5px]">
              {[
                { key: "validate", icon: <Check size={11} /> },
                { key: "virusScan", icon: <Shield size={11} /> },
                { key: "stripExif", icon: <Tag size={11} /> },
                {
                  key: activePolicy?.contentModeration ? "moderation" : "noModeration",
                  icon: activePolicy?.contentModeration ? <Shield size={11} /> : <X size={11} />,
                },
                { key: "derivatives", icon: <ImageIcon size={11} /> },
                { key: "indexEmit", icon: <Check size={11} /> },
              ].map((step) => (
                <li key={step.key} className="flex items-center gap-2.5">
                  <span className="bg-latam-indigo/10 text-latam-indigo-deep grid size-5 place-items-center rounded-full">
                    {step.icon}
                  </span>
                  <span>{t(`pages.uploadAssets.pipeline.steps.${step.key}`)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>

      {/* Sticky footer */}
      <div className="border-border bg-card/95 sticky bottom-0 -mx-4 mt-6 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground flex items-center gap-3 text-[11.5px]">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", canSubmit ? "bg-ok" : "bg-warn")} />
              {canSubmit
                ? t("pages.uploadAssets.footer.ready", {
                    count: files.length,
                    size: fmtBytes(totalBytes),
                  })
                : files.length === 0
                  ? t("pages.uploadAssets.footer.addFiles")
                  : t("pages.uploadAssets.footer.resolveIssues")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/assets">
              <Button type="button" variant="outline" disabled={isUploading}>
                {t("pages.uploadAssets.footer.cancel")}
              </Button>
            </Link>
            <Button type="button" variant="indigo" disabled={!canSubmit} onClick={handleStart}>
              <Upload size={12} />{" "}
              {files.length > 0
                ? t("pages.uploadAssets.footer.uploadCount", { count: files.length })
                : t("pages.uploadAssets.footer.uploadEmpty")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface INumberedSectionProps {
  num: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

function NumberedSection(props: INumberedSectionProps): React.JSX.Element {
  const { num, title, hint, children } = props;
  const numStr = String(num).padStart(2, "0");
  return (
    <Card className="p-0">
      <div className="border-border/60 flex items-baseline gap-3 border-b px-6 py-4">
        <span className="text-latam-pink font-mono text-[11px] tabular-nums">{numStr}</span>
        <div className="flex-1">
          <h2 className="text-foreground m-0 text-[14px] font-semibold tracking-tight">{title}</h2>
          {hint ? <div className="text-muted-foreground mt-0.5 text-[11.5px]">{hint}</div> : null}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </Card>
  );
}

// Maps the SDK's structured error to an i18n key. For quarantined files the
// `kind` field carries the quarantine reason (e.g. "quarantined_virus"); for
// every other failure state the raw `message` is shown.
function humanizeFileError(
  error: { message: string; kind?: string },
  t: (key: string) => string,
): string {
  if (error.kind) {
    const knownKinds: Record<string, string> = {
      quarantined_invalid_format: "pages.uploadAssets.errors.quarantined.invalidFormat",
      quarantined_virus: "pages.uploadAssets.errors.quarantined.virus",
      quarantined_moderation: "pages.uploadAssets.errors.quarantined.moderation",
    };
    const key: string | undefined = knownKinds[error.kind];
    return key ? t(key) : t("pages.uploadAssets.errors.quarantined.generic");
  }
  // Legacy "quarantined: <state>" message format from older SDK builds.
  const QUARANTINE_PREFIX = "quarantined: ";
  if (error.message.startsWith(QUARANTINE_PREFIX)) {
    const state = error.message.slice(QUARANTINE_PREFIX.length);
    const knownKinds: Record<string, string> = {
      quarantined_invalid_format: "pages.uploadAssets.errors.quarantined.invalidFormat",
      quarantined_virus: "pages.uploadAssets.errors.quarantined.virus",
      quarantined_moderation: "pages.uploadAssets.errors.quarantined.moderation",
    };
    const key: string | undefined = knownKinds[state];
    return key ? t(key) : t("pages.uploadAssets.errors.quarantined.generic");
  }
  return error.message;
}

function FileStateOverlay({ state }: { state: IUploadFile["state"] }): React.JSX.Element | null {
  const { t } = useTranslation();
  // No overlay before the user starts the upload — `idle` and `preview` look
  // identical to the dropzone preview (just the thumbnail).
  if (state === "idle" || state === "preview") return null;

  const Icon =
    state === "ready"
      ? Check
      : TERMINAL_FAILURE_STATES.includes(state)
        ? X
        : state === "uploading"
          ? Upload
          : state === "processing"
            ? Upload
            : null;
  const ribbonClass: string =
    state === "ready"
      ? "bg-ok text-ok-fg"
      : TERMINAL_FAILURE_STATES.includes(state)
        ? "bg-warn text-warn-fg"
        : "bg-secondary text-foreground";
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 px-2 py-1 text-[10.5px] font-semibold tracking-wide uppercase",
        ribbonClass,
      )}
    >
      {Icon ? <Icon size={11} strokeWidth={2.5} /> : null}
      {t(`pages.uploadAssets.fileTile.state.${state}`)}
    </div>
  );
}
