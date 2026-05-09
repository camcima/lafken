import { useLafkenClient } from "@lafken/react";
import type {
  CreateStorageBindingRequestDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { systemKeys } from "@/features/system/keys";

export function useStorageBindings() {
  const client = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.storageBindings(),
    queryFn: () => client.system.listStorageBindings(),
  });
}

export function useStorageBinding(name: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.storageBinding(name),
    queryFn: () => client.system.getStorageBinding(name),
    enabled: Boolean(name),
  });
}

export function useIntegrations() {
  const client = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.integrations(),
    queryFn: () => client.system.listIntegrations(),
  });
}

export function useSystemHealth() {
  const client = useLafkenClient();
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: () => client.system.getHealth(),
  });
}

export function useCreateStorageBinding() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStorageBindingRequestDTO) =>
      client.system.createStorageBinding(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}

export function useUpdateStorageBinding() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { name: string; input: UpdateStorageBindingRequestDTO }) =>
      client.system.updateStorageBinding(variables.name, variables.input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: systemKeys.storageBinding(variables.name),
      });
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}

export function useDeleteStorageBinding() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => client.system.deleteStorageBinding(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.storageBindings() });
    },
  });
}
