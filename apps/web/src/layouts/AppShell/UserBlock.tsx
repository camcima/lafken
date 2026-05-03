import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { useAuth } from "@/hooks/useAuth";

export function UserBlock() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const displayRole = user?.roles?.[0] ?? t("user.noRole");

  return (
    <div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-3">
      {/* Avatar */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-semibold text-white">
        {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user?.name ?? user?.email}</p>
        <p className="truncate text-xs text-neutral-400">{displayRole}</p>
      </div>

      {/* Sign out */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("user.signOut")}
        onClick={() => void logout()}
        className="shrink-0 text-neutral-400 hover:bg-neutral-800 hover:text-white"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
