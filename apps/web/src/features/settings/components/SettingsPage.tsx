import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { Tabs } from "@/components/common/Tabs";
import type { ITab } from "@/components/common/Tabs";

// Tables render against empty arrays until the BE slices land.

// Icon sizes
const BTN_ICON_SIZE = 12;

type ISettingsTab = "workspace" | "members" | "api" | "policies" | "danger";

function WorkspaceTab(): React.JSX.Element {
  const { t } = useTranslation();

  const fields: Array<{ key: string; label: string; value: React.ReactNode }> = [
    {
      key: "name",
      label: t("pages.settings.workspace.fields.name.label"),
      value: t("pages.settings.workspace.fields.name.value"),
    },
    {
      key: "slug",
      label: t("pages.settings.workspace.fields.slug.label"),
      value: <span className="font-mono">{t("pages.settings.workspace.fields.slug.value")}</span>,
    },
    {
      key: "region",
      label: t("pages.settings.workspace.fields.region.label"),
      value: t("pages.settings.workspace.fields.region.value"),
    },
    {
      key: "replica",
      label: t("pages.settings.workspace.fields.replica.label"),
      value: t("pages.settings.workspace.fields.replica.value"),
    },
    {
      key: "defaultNamespace",
      label: t("pages.settings.workspace.fields.defaultNamespace.label"),
      value: (
        <span className="font-mono">
          {t("pages.settings.workspace.fields.defaultNamespace.value")}
        </span>
      ),
    },
    {
      key: "reviewerSlo",
      label: t("pages.settings.workspace.fields.reviewerSlo.label"),
      value: t("pages.settings.workspace.fields.reviewerSlo.value"),
    },
    {
      key: "created",
      label: t("pages.settings.workspace.fields.created.label"),
      value: t("pages.settings.workspace.fields.created.value"),
    },
    {
      key: "plan",
      label: t("pages.settings.workspace.fields.plan.label"),
      value: <Badge variant="indigo-soft">{t("pages.settings.workspace.plan.label")}</Badge>,
    },
  ];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("pages.settings.tabs.workspace")}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-5 text-[12.5px] sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key}>
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {field.label}
              </div>
              <div className="mt-0.5">{field.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("pages.settings.branding.title")}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 items-start gap-5 px-5 py-5 sm:grid-cols-[120px_1fr]">
          <div className="bg-latam-indigo grid size-24 place-items-center rounded-lg text-[36px] font-bold text-white">
            L
          </div>
          <div className="text-[12.5px]">
            <div>{t("pages.settings.branding.description")}</div>
            <div className="text-muted-foreground mt-1.5">
              {t("pages.settings.branding.lastEdited")}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm">
                {t("pages.settings.branding.replaceLogo")}
              </Button>
              <Button variant="ghost" size="sm">
                {t("pages.settings.branding.reset")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MembersTab(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card className="overflow-x-auto">
      <CardHeader>
        <CardTitle>{t("pages.settings.members.title")}</CardTitle>
        <CardMeta>
          <Button variant="indigo" size="sm">
            <Plus size={BTN_ICON_SIZE} />
            {t("pages.settings.members.inviteMember")}
          </Button>
        </CardMeta>
      </CardHeader>
      <div className="min-w-[820px]">
        <div className="border-border/60 text-muted-foreground grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_120px_110px_60px] items-center gap-3 border-b px-5 py-2 text-[10.5px] font-medium tracking-wider uppercase">
          <span>{t("pages.settings.members.table.person")}</span>
          <span>{t("pages.settings.members.table.role")}</span>
          <span>{t("pages.settings.members.table.scope")}</span>
          <span>{t("pages.settings.members.table.mfa")}</span>
          <span>{t("pages.settings.members.table.lastActive")}</span>
          <span />
        </div>
        <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
          {t("pages.settings.members.empty")}
        </div>
      </div>
    </Card>
  );
}

function ApiKeysTab(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card className="overflow-x-auto">
      <CardHeader>
        <CardTitle>{t("pages.settings.api.title")}</CardTitle>
        <CardMeta>
          <Button variant="indigo" size="sm">
            <Plus size={BTN_ICON_SIZE} />
            {t("pages.settings.api.createKey")}
          </Button>
        </CardMeta>
      </CardHeader>
      <div className="min-w-[920px]">
        <div className="border-border/60 text-muted-foreground grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_110px_110px_120px_90px_60px] items-center gap-3 border-b px-5 py-2 text-[10.5px] font-medium tracking-wider uppercase">
          <span>{t("pages.settings.api.table.label")}</span>
          <span>{t("pages.settings.api.table.scopes")}</span>
          <span>{t("pages.settings.api.table.lastUsed")}</span>
          <span>{t("pages.settings.api.table.rotates")}</span>
          <span>{t("pages.settings.api.table.createdBy")}</span>
          <span>{t("pages.settings.api.table.status")}</span>
          <span />
        </div>
        <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
          {t("pages.settings.api.empty")}
        </div>
      </div>
    </Card>
  );
}

function PoliciesTab(): React.JSX.Element {
  const { t } = useTranslation();

  type IPolicyDefault = {
    key: string;
    label: string;
    value: string;
    note: string;
  };

  const defaults: IPolicyDefault[] = [
    {
      key: "retention",
      label: t("pages.settings.policies.defaults.retention.label"),
      value: t("pages.settings.policies.defaults.retention.value"),
      note: t("pages.settings.policies.defaults.retention.note"),
    },
    {
      key: "maxUpload",
      label: t("pages.settings.policies.defaults.maxUpload.label"),
      value: t("pages.settings.policies.defaults.maxUpload.value"),
      note: t("pages.settings.policies.defaults.maxUpload.note"),
    },
    {
      key: "allowedMimes",
      label: t("pages.settings.policies.defaults.allowedMimes.label"),
      value: t("pages.settings.policies.defaults.allowedMimes.value"),
      note: t("pages.settings.policies.defaults.allowedMimes.note"),
    },
    {
      key: "moderation",
      label: t("pages.settings.policies.defaults.moderation.label"),
      value: t("pages.settings.policies.defaults.moderation.value"),
      note: t("pages.settings.policies.defaults.moderation.note"),
    },
    {
      key: "exif",
      label: t("pages.settings.policies.defaults.exif.label"),
      value: t("pages.settings.policies.defaults.exif.value"),
      note: t("pages.settings.policies.defaults.exif.note"),
    },
    {
      key: "retentionWarning",
      label: t("pages.settings.policies.defaults.retentionWarning.label"),
      value: t("pages.settings.policies.defaults.retentionWarning.value"),
      note: t("pages.settings.policies.defaults.retentionWarning.note"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.settings.policies.title")}</CardTitle>
      </CardHeader>
      <div className="space-y-4 px-5 py-5 text-[12.5px]">
        {defaults.map((policyDefault) => (
          <div
            key={policyDefault.key}
            className="border-border/40 flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
          >
            <div>
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {policyDefault.label}
              </div>
              <div className="mt-0.5 font-mono">{policyDefault.value}</div>
              {policyDefault.note ? (
                <div className="text-muted-foreground mt-0.5 text-[11px]">{policyDefault.note}</div>
              ) : null}
            </div>
            <Button variant="outline" size="sm">
              {t("pages.settings.policies.edit")}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DangerTab(): React.JSX.Element {
  const { t } = useTranslation();

  type IDangerAction = {
    key: string;
    label: string;
    note: string;
    btn: string;
  };

  const actions: IDangerAction[] = [
    {
      key: "pauseUploads",
      label: t("pages.settings.danger.actions.pauseUploads.label"),
      note: t("pages.settings.danger.actions.pauseUploads.note"),
      btn: t("pages.settings.danger.actions.pauseUploads.btn"),
    },
    {
      key: "rotateKey",
      label: t("pages.settings.danger.actions.rotateKey.label"),
      note: t("pages.settings.danger.actions.rotateKey.note"),
      btn: t("pages.settings.danger.actions.rotateKey.btn"),
    },
    {
      key: "disableConsole",
      label: t("pages.settings.danger.actions.disableConsole.label"),
      note: t("pages.settings.danger.actions.disableConsole.note"),
      btn: t("pages.settings.danger.actions.disableConsole.btn"),
    },
  ];

  return (
    <Card className="border-danger-line">
      <CardHeader>
        <CardTitle className="text-danger">{t("pages.settings.danger.title")}</CardTitle>
      </CardHeader>
      <div className="space-y-3 px-5 py-5 text-[12.5px]">
        {actions.map((a) => (
          <div
            key={a.key}
            className="border-border bg-secondary/20 flex items-center justify-between gap-4 rounded border px-4 py-3"
          >
            <div>
              <div className="text-[12.5px] font-medium">{a.label}</div>
              <div className="text-muted-foreground mt-0.5 text-[11px]">{a.note}</div>
            </div>
            <Button variant="danger">{a.btn}</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { tab } = useSearch({ from: "/_protected/settings" });
  const navigate = useNavigate({ from: "/settings" });
  const setTab = (next: ISettingsTab): void => {
    void navigate({ search: { tab: next } });
  };

  const tabs: ITab<ISettingsTab>[] = [
    { id: "workspace", label: t("pages.settings.tabs.workspace") },
    { id: "members", label: t("pages.settings.tabs.members") },
    { id: "api", label: t("pages.settings.tabs.api") },
    { id: "policies", label: t("pages.settings.tabs.policies") },
    { id: "danger", label: t("pages.settings.tabs.danger") },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.settings.title")}</h1>
        <div className="text-muted-foreground mt-1 text-[12.5px]">
          {t("pages.settings.subtitle")}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} items={tabs} />

      {tab === "workspace" && <WorkspaceTab />}
      {tab === "members" && <MembersTab />}
      {tab === "api" && <ApiKeysTab />}
      {tab === "policies" && <PoliciesTab />}
      {tab === "danger" && <DangerTab />}
    </div>
  );
}
