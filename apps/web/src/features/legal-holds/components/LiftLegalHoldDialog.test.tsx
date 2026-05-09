import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { LiftLegalHoldDialog } from "./LiftLegalHoldDialog";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mutateSpy = vi.fn();

vi.mock("@/features/legal-holds/hooks/useLegalHoldMutations", () => ({
  useLiftLegalHold: () => ({ mutate: mutateSpy, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ── Helper ─────────────────────────────────────────────────────────────────

function renderDialog(props: {
  open: boolean;
  holdId?: string;
  caseReference?: string;
  onClose?: () => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = props.onClose ?? vi.fn();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    );
  }
  return render(
    <Wrapper>
      <LiftLegalHoldDialog
        open={props.open}
        holdId={props.holdId ?? "lh_01HX2K7P8R"}
        caseReference={props.caseReference ?? "CHL-2026-AVN-014"}
        onClose={onClose}
      />
    </Wrapper>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LiftLegalHoldDialog", () => {
  beforeEach(() => {
    mutateSpy.mockReset();
  });

  it("renders null when open is false", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the dialog with warning copy and enabled cancel button when open is true", () => {
    renderDialog({ open: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Warning text
    expect(screen.getByRole("dialog")).toHaveTextContent(/cannot be undone/i);
    // Cancel button is enabled
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeEnabled();
  });

  it("submit button is disabled when reason has fewer than 10 characters", async () => {
    const user = userEvent.setup();
    renderDialog({ open: true });

    const textarea = screen.getByPlaceholderText(/investigation closed/i);
    await user.type(textarea, "short");

    const submitBtn = screen.getByRole("button", { name: /lift hold/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button becomes enabled when reason is at least 10 characters", async () => {
    const user = userEvent.setup();
    renderDialog({ open: true });

    const textarea = screen.getByPlaceholderText(/investigation closed/i);
    await user.type(textarea, "long enough reason here");

    const submitBtn = screen.getByRole("button", { name: /lift hold/i });
    expect(submitBtn).toBeEnabled();
  });

  it("calls mutate with id and liftReason, then invokes onClose on success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Simulate a successful mutation by calling the onSuccess callback
    mutateSpy.mockImplementation((_vars: unknown, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });

    renderDialog({ open: true, holdId: "lh_test_id", caseReference: "CHL-TEST", onClose });

    const textarea = screen.getByPlaceholderText(/investigation closed/i);
    await user.type(textarea, "Investigation closed; releasing per counsel.");

    await user.click(screen.getByRole("button", { name: /lift hold/i }));

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith(
        { id: "lh_test_id", liftReason: "Investigation closed; releasing per counsel." },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("cancel button calls onClose without mutating", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mutateSpy).not.toHaveBeenCalled();
  });
});
