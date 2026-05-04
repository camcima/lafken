export * from "./shared/errors-response-dto-factories";
export type * from "./shared/paginated-result.interface";
export {
  makePaginatedRequestInputDto,
  makePaginatedResponseDto,
} from "./shared/pagination-dto-factories";

export * from "./presentation/health-dtos/health-check-result.dto";
export * from "./presentation/auth/unauthorized-error-response.dto";
export * from "./presentation/auth/forbidden-error-response.dto";

export * from "./presentation/namespaces/namespace-response.dto";
export * from "./presentation/namespaces/namespace-policy-response.dto";
export * from "./presentation/namespaces/namespace-preset-response.dto";
export * from "./presentation/namespaces/create-namespace-request.dto";
export * from "./presentation/namespaces/update-namespace-metadata-request.dto";

export * from "./presentation/assets/asset-response.dto";
export * from "./presentation/assets/asset-state-transition-response.dto";
export * from "./presentation/assets/asset-analysis-response.dto";
export * from "./presentation/assets/processing-job-response.dto";
export * from "./presentation/assets/list-assets-query.dto";

export * from "./presentation/quarantine/quarantined-asset-response.dto";
export * from "./presentation/quarantine/list-quarantine-query.dto";

export * from "./presentation/legal-holds/legal-hold-response.dto";

export * from "./presentation/audit/audit-entry-response.dto";
export * from "./presentation/audit/list-audit-query.dto";

export * from "./presentation/system/storage-binding-response.dto";
export * from "./presentation/system/create-storage-binding-request.dto";
export * from "./presentation/system/update-storage-binding-request.dto";
export * from "./presentation/system/integration-status-response.dto";
export * from "./presentation/system/system-health-response.dto";

export * from "./presentation/dashboard/dashboard-overview-response.dto";
