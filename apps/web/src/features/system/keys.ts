export const systemKeys = {
  all: ["system"] as const,
  storageBindings: () => [...systemKeys.all, "storage-bindings"] as const,
  storageBinding: (name: string) => [...systemKeys.storageBindings(), name] as const,
  integrations: () => [...systemKeys.all, "integrations"] as const,
  health: () => [...systemKeys.all, "health"] as const,
};
