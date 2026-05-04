import type {
  CreateStorageBindingRequestDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export function useCreateStorageBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStorageBindingRequestDTO) =>
      systemService.createStorageBinding(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}

export function useUpdateStorageBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { name: string; input: UpdateStorageBindingRequestDTO }) =>
      systemService.updateStorageBinding(variables.name, variables.input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: systemKeys.storageBinding(variables.name),
      });
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}

export function useDeleteStorageBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => systemService.deleteStorageBinding(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}
