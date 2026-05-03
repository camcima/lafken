import { useQuery } from "@tanstack/react-query";

import { systemKeys } from "@/features/system/keys";
import { systemService } from "@/services";

export function useStorageBindings() {
  return useQuery({
    queryKey: systemKeys.storageBindings(),
    queryFn: () => systemService.listStorageBindings(),
  });
}

export function useStorageBinding(name: string) {
  return useQuery({
    queryKey: systemKeys.storageBinding(name),
    queryFn: () => systemService.getStorageBindingByName(name),
    enabled: Boolean(name),
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: systemKeys.integrations(),
    queryFn: () => systemService.listIntegrations(),
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: () => systemService.getHealth(),
  });
}
