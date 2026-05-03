import React from "react";
import { useTranslation } from "react-i18next";

interface IIntegrationRowProps {
  port: string;
  adapter: string;
  status: "configured" | "not_configured";
}

export function IntegrationRow({ port, adapter, status }: IIntegrationRowProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-neutral-900">{port}</span>
        <span className="font-mono text-xs text-neutral-500">{adapter}</span>
      </div>
      <span
        className={`text-xs font-medium ${
          status === "configured" ? "text-teal-700" : "text-neutral-400"
        }`}
      >
        {t(`pages.system.integrationStatus.${status}`)}
      </span>
    </div>
  );
}
