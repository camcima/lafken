import { AssetsService } from "@/services/AssetsService";
import { AuditService } from "@/services/AuditService";
import { DashboardService } from "@/services/DashboardService";
import { HealthService } from "@/services/HealthService";
import { LegalHoldsService } from "@/services/LegalHoldsService";
import { NamespacesService } from "@/services/NamespacesService";
import { QuarantineService } from "@/services/QuarantineService";
import { SystemService } from "@/services/SystemService";

export const healthService = new HealthService();
export const namespacesService = new NamespacesService();
export const assetsService = new AssetsService();
export const quarantineService = new QuarantineService();
export const legalHoldsService = new LegalHoldsService();
export const auditService = new AuditService();
export const systemService = new SystemService();
export const dashboardService = new DashboardService();
