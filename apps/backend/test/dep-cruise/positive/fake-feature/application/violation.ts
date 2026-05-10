// This file deliberately violates the dep-cruise rule
// "no-application-into-shared-infrastructure" so the rule's enforcement is testable.
// It is excluded from production builds via the test/ path and tsconfig.
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

export const violation = environmentConfiguration;
