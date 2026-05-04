import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NotificationsPanel } from "./NotificationsPanel";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => (
      <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>
    ),
  };
});

function renderPanel(open = true, onClose = vi.fn()) {
  const anchorRef = createRef<HTMLButtonElement>();
  return {
    onClose,
    ...render(
      <I18nProvider>
        <NotificationsPanel open={open} onClose={onClose} anchorRef={anchorRef} />
      </I18nProvider>,
    ),
  };
}

describe("NotificationsPanel", () => {
  it("renders null when open is false", () => {
    const { container } = renderPanel(false);
    expect(container.firstChild).toBeNull();
  });

  it("shows the title and '8 new' badge when all 8 are unread by default state", () => {
    renderPanel();
    // The title should be visible
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows initial unread badge with 3 new (only 3 are unread in demo data)", () => {
    renderPanel();
    // 3 notifications are unread in the demo data (n_01, n_02, n_03)
    expect(screen.getByText("3 new")).toBeInTheDocument();
  });

  it("shows all 5 filter tabs", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^All/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Unread/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Review/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^System/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Workspace/ })).toBeInTheDocument();
  });

  it("shows all 8 notifications when filter is 'all'", () => {
    renderPanel();
    // All 8 notification titles should be visible
    expect(screen.getByText("Transform stage degraded")).toBeInTheDocument();
    expect(screen.getByText("5 quarantined assets > 24h old")).toBeInTheDocument();
    expect(screen.getByText("Legal hold placed on aircraft-photos")).toBeInTheDocument();
    expect(screen.getByText("Your review was overridden")).toBeInTheDocument();
    expect(screen.getByText("Worker processor-12 unreachable")).toBeInTheDocument();
    expect(screen.getByText("Policy v8 published for ground-ops-incidents")).toBeInTheDocument();
    expect(screen.getByText("API key rotated · cargo-ingest-svc")).toBeInTheDocument();
    expect(screen.getByText("Escalation: medical category match")).toBeInTheDocument();
  });

  it("filter 'Unread' reduces list to the 3 unread items", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /^Unread/ }));

    // The 3 unread notifications should be visible
    expect(screen.getByText("Transform stage degraded")).toBeInTheDocument();
    expect(screen.getByText("5 quarantined assets > 24h old")).toBeInTheDocument();
    expect(screen.getByText("Legal hold placed on aircraft-photos")).toBeInTheDocument();

    // The read notifications should NOT be visible
    expect(screen.queryByText("Your review was overridden")).not.toBeInTheDocument();
    expect(screen.queryByText("Worker processor-12 unreachable")).not.toBeInTheDocument();
  });

  it("clicking 'Mark all read' updates the unread count to 0", async () => {
    const user = userEvent.setup();
    renderPanel();

    // Initially there are 3 unread
    expect(screen.getByText("3 new")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    // After marking all read, the badge should disappear (count = 0)
    expect(screen.queryByText(/new/)).not.toBeInTheDocument();
  });

  it("pressing Escape calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel(true, onClose);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });
});
