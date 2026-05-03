import { useAuth as useAuthContext } from "@/contexts/AuthContext";

/**
 * Custom hook for authentication state and actions
 * Re-exports the auth context for easier imports
 */
export const useAuth = useAuthContext;

/**
 * Hook to check if user has specific roles
 * Works with the abstracted AuthUser interface
 */
export function useHasRole(requiredRoles: string[]): boolean {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return false;
  }

  const userRoles = user.roles ?? [];

  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Hook to check if user belongs to specific groups
 * Works with the abstracted AuthUser interface
 */
export function useHasGroup(requiredGroups: string[]): boolean {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return false;
  }

  const userGroups = user.groups ?? [];

  return requiredGroups.some((group) => userGroups.includes(group));
}

/**
 * Hook to get user permissions
 * Combine roles and groups for comprehensive permission checking
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return {
      roles: [],
      groups: [],
      hasPermission: () => false,
    };
  }

  const roles = user.roles ?? [];
  const groups = user.groups ?? [];

  const hasPermission = (permission: string): boolean => {
    return roles.includes(permission) || groups.includes(permission);
  };

  return {
    roles,
    groups,
    hasPermission,
  };
}
