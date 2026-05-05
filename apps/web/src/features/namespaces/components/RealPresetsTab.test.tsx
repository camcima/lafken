import type { NamespacePresetResponseDTO, NamespaceResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { RealPresetsTab } from "./RealPresetsTab";

// ── Mock hooks ─────────────────────────────────────────────
const mockMutate = vi.fn();
let mockPresets: NamespacePresetResponseDTO[] = [];

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespacePresets: () => ({
    data: mockPresets,
    isLoading: false,
  }),
  useSetPresetActive: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: ReactNode;
      to: string;
      params?: Record<string, string>;
      [k: string]: unknown;
    }) => {
      const href = params ? to.replace(/\$(\w+)/g, (_, key: string) => params[key] ?? "") : to;
      return (
        <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    },
  };
});

// ── Fixtures ───────────────────────────────────────────────
function makePreset(
  name: string,
  version: number,
  overrides?: Partial<NamespacePresetResponseDTO>,
): NamespacePresetResponseDTO {
  return {
    name,
    version,
    params: { fit: "cover", format: "webp", quality: 80, width: 1080, height: 720 },
    active: true,
    preGenerate: false,
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

const activeNamespace: NamespaceResponseDTO = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  description: undefined,
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const archivedNamespace: NamespaceResponseDTO = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  description: undefined,
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Render helper ──────────────────────────────────────────
function renderTab(namespace: NamespaceResponseDTO) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    );
  }
  return render(
    <Wrapper>
      <RealPresetsTab namespace={namespace} />
    </Wrapper>,
  );
}

// ── Tests ──────────────────────────────────────────────────
describe("RealPresetsTab", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockPresets = [];
  });

  it("groups presets by name and shows latest version per group", () => {
    mockPresets = [
      makePreset("thumbnail", 1, { active: false }),
      makePreset("thumbnail", 2, { active: true }),
      makePreset("banner", 1, { active: true }),
    ];

    renderTab(activeNamespace);

    // Each name appears once (thumbnail v2 and banner v1)
    expect(screen.getAllByText("thumbnail")).toHaveLength(1);
    expect(screen.getAllByText("banner")).toHaveLength(1);

    // Latest version chips
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });

  it("shows active badge when preset.active is true", () => {
    mockPresets = [makePreset("thumb", 1, { active: true })];

    renderTab(activeNamespace);

    expect(screen.getByText(/^active$/i)).toBeInTheDocument();
  });

  it("disables the new preset button on archived namespace", () => {
    mockPresets = [makePreset("thumb", 1)];

    renderTab(archivedNamespace);

    const newPresetBtn = screen.getByRole("button", { name: /new preset/i });
    expect(newPresetBtn).toBeDisabled();
    expect(newPresetBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("disables the active switch on archived namespace", () => {
    mockPresets = [makePreset("thumb", 1)];

    renderTab(archivedNamespace);

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-disabled", "true");
  });

  it("calls useSetPresetActive when the switch is toggled", async () => {
    const user = userEvent.setup();
    mockPresets = [makePreset("thumb", 1, { active: true })];

    renderTab(activeNamespace);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(mockMutate).toHaveBeenCalledWith({
      slug: "aircraft-photos",
      name: "thumb",
      input: { active: false },
    });
  });

  it("renders an empty-state CTA when no presets exist", () => {
    mockPresets = [];

    renderTab(activeNamespace);

    expect(screen.getByText(/no presets defined yet/i)).toBeInTheDocument();
  });
});
