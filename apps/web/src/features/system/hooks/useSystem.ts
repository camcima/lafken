import type {
  CreateStorageBindingRequestDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { systemKeys } from "@/features/system/keys";

export function useStorageBindings() {
  const c = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.storageBindings(),
    queryFn: () => c.system.listStorageBindings(),
  });
}

export function useStorageBinding(name: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.storageBinding(name),
    queryFn: () => c.system.getStorageBinding(name),
    enabled: Boolean(name),
  });
}

export function useIntegrations() {
  const c = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.integrations(),
    queryFn: () => c.system.listIntegrations(),
  });
}

export function useSystemHealth() {
  const c = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: () => c.system.getHealth(),
  });
}

export function useCreateStorageBinding() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStorageBindingRequestDTO) => c.system.createStorageBinding(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}

export function useUpdateStorageBinding() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { name: string; input: UpdateStorageBindingRequestDTO }) =>
      c.system.updateStorageBinding(variables.name, variables.input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: systemKeys.storageBinding(variables.name),
      });
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}

export function useDeleteStorageBinding() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => c.system.deleteStorageBinding(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}
