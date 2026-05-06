import type {
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as useNamespacesModule from "@/features/namespaces/hooks/useNamespaces";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespaceDetailPage } from "./NamespaceDetailPage";

// Default mock — namespace not found in API; tests that need a real namespace
// mock `useNamespace` per-test via vi.spyOn.
vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
  useNamespace: () => ({ data: undefined, isLoading: false, error: new Error("Not found") }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
  useNamespacePresets: () => ({ data: [], isLoading: false }),
  useSetPresetActive: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateNamespaceMetadata: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnarchiveNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const aircraftPhotosNamespace = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  description: undefined,
  currentPolicyVersion: 7,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies NamespaceResponseDTO;

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => (
      <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ tab: "overview" }),
  };
});

function renderPage(props: {
  slug: string;
  tab?: "overview" | "policy" | "presets" | "assets";
  onTabChange?: () => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
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
      <NamespaceDetailPage slug={props.slug} tab={props.tab} onTabChange={props.onTabChange} />
    </Wrapper>,
  );
}

describe("NamespaceDetailPage — not found", () => {
  it("renders the not-found empty state when slug has no demo match", () => {
    renderPage({ slug: "no-such-namespace" });
    expect(screen.getByText(/namespace not found/i)).toBeInTheDocument();
  });

  it("renders the back-to-namespaces action link", () => {
    renderPage({ slug: "no-such-namespace" });
    expect(screen.getByText(/back to namespaces/i)).toBeInTheDocument();
  });
});

describe("NamespaceDetailPage — valid slug", () => {
  beforeEach(() => {
    vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: aircraftPhotosNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the namespace display name and slug in the header", () => {
    renderPage({ slug: "aircraft-photos" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Aircraft Photos");
    expect(screen.getByText("aircraft-photos")).toBeInTheDocument();
  });

  it("renders 4 tab triggers (overview, policy, presets, assets)", () => {
    renderPage({ slug: "aircraft-photos" });
    const tabList = screen.getByRole("tablist");
    const tabs = tabList.querySelectorAll("[role='tab']");
    expect(tabs).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /policy/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /presets/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /assets/i })).toBeInTheDocument();
  });

  it("does not render Webhooks or Quotas tabs", () => {
    renderPage({ slug: "aircraft-photos" });
    expect(screen.queryByRole("tab", { name: /webhooks/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /quotas/i })).not.toBeInTheDocument();
  });

  it("renders the overview stat grid by default with policy version, storage binding, presets active, and created", () => {
    renderPage({ slug: "aircraft-photos" });
    expect(screen.getByText(/policy version/i)).toBeInTheDocument();
    expect(screen.getByText(/storage binding/i)).toBeInTheDocument();
    expect(screen.getByText(/presets active/i)).toBeInTheDocument();
    expect(screen.getByText(/^created$/i)).toBeInTheDocument();
  });

  it("switches to policy tab when clicked", async () => {
    const onTabChange = vi.fn();
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="aircraft-photos" tab="overview" onTabChange={onTabChange} />
      </I18nProvider>,
    );
    const policyTab = screen.getByRole("tab", { name: /policy/i });
    await userEvent.click(policyTab);
    expect(onTabChange).toHaveBeenCalledWith("policy");
  });

  it("renders Edit metadata button on active namespace", () => {
    renderPage({ slug: "aircraft-photos" });
    expect(screen.getByRole("button", { name: /edit metadata/i })).toBeInTheDocument();
  });

  it("renders Edit policy as a Link on active namespace", () => {
    renderPage({ slug: "aircraft-photos" });
    // Active namespace: Edit policy renders as an anchor (Button asChild + Link), not a disabled button
    const editPolicyEl = screen.getByText(/^edit policy$/i);
    expect(editPolicyEl.tagName.toLowerCase()).toBe("a");
    expect(editPolicyEl).not.toBeDisabled();
  });

  it("renders Archive button on active namespace and opens dialog with archive mode on click", async () => {
    const user = userEvent.setup();
    renderPage({ slug: "aircraft-photos" });

    const archiveBtn = screen.getByRole("button", { name: /^archive$/i });
    expect(archiveBtn).toBeInTheDocument();

    await user.click(archiveBtn);

    // Dialog should open with archive copy
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(/archive aircraft photos\?/i);
  });
});

describe("NamespaceDetailPage — overview stat tiles", () => {
  function makePreset(
    name: string,
    version: number,
    overrides?: Partial<NamespacePresetResponseDTO>,
  ): NamespacePresetResponseDTO {
    return {
      name,
      version,
      params: {},
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user@example.com",
      ...overrides,
    } as NamespacePresetResponseDTO;
  }

  const liveNamespace = {
    slug: "live-ns",
    displayName: "Live Namespace",
    description: undefined,
    currentPolicyVersion: 4,
    storageBindingName: "gcs-binding-x",
    archivedAt: undefined,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies NamespaceResponseDTO;

  it("counts only the latest version per preset name when reporting active presets", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: liveNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    // thumb has v1=active, v2=inactive (latest wins → not counted)
    // tile has v1=active, v2=active (latest wins → counted)
    // hero has only v1=active → counted
    const presetsSpy = vi.spyOn(useNamespacesModule, "useNamespacePresets").mockReturnValue({
      data: [
        makePreset("thumb", 1, { active: true }),
        makePreset("thumb", 2, { active: false }),
        makePreset("tile", 1, { active: true }),
        makePreset("tile", 2, { active: true }),
        makePreset("hero", 1, { active: true }),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useNamespacesModule.useNamespacePresets>);

    renderPage({ slug: "live-ns" });

    // The "Presets active" tile should report 2 (tile + hero, but not thumb).
    const presetsLabel = screen.getByText(/presets active/i);
    const tile = presetsLabel.parentElement;
    expect(tile?.textContent).toMatch(/2/);

    nsSpy.mockRestore();
    presetsSpy.mockRestore();
  });

  it("renders policy version and storage binding values from the namespace DTO", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: liveNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "live-ns" });

    expect(screen.getByText("v4")).toBeInTheDocument();
    expect(screen.getByText("gcs-binding-x")).toBeInTheDocument();

    nsSpy.mockRestore();
  });

  it("omits the Updated tile when updatedAt equals createdAt", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: liveNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "live-ns" });

    expect(screen.queryByText(/^updated$/i)).not.toBeInTheDocument();

    nsSpy.mockRestore();
  });

  it("renders the Updated tile when updatedAt differs from createdAt", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: {
        ...liveNamespace,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-15T00:00:00.000Z",
      },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "live-ns" });

    expect(screen.getByText(/^updated$/i)).toBeInTheDocument();

    nsSpy.mockRestore();
  });

  it("renders the description above the stat grid when present", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: { ...liveNamespace, description: "Photos captured during line maintenance." },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "live-ns" });

    expect(screen.getByText(/photos captured during line maintenance/i)).toBeInTheDocument();

    nsSpy.mockRestore();
  });

  it("renders an Archived state badge when the namespace is archived", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: { ...liveNamespace, archivedAt: "2026-02-01T00:00:00.000Z" },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "live-ns" });

    // The state tile should contain an "Archived" badge — the header also renders
    // an "archived" badge, so we assert at least one match exists.
    const archived = screen.getAllByText(/archived/i);
    expect(archived.length).toBeGreaterThanOrEqual(1);

    nsSpy.mockRestore();
  });
});

describe("NamespaceDetailPage — archived namespace", () => {
  it("renders Unarchive button and archived badge when namespace is archived", () => {
    // Temporarily override useNamespace to return an archived namespace
    const spy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: {
        slug: "aircraft-photos",
        displayName: "Aircraft Photos",
        description: undefined,
        currentPolicyVersion: 7,
        storageBindingName: "gcs-prod",
        archivedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "aircraft-photos" });

    expect(screen.getByRole("button", { name: /^unarchive$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/archived/i).length).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });

  it("renders Edit policy as disabled with archived tooltip on archived namespace", () => {
    const spy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: {
        slug: "aircraft-photos",
        displayName: "Aircraft Photos",
        description: undefined,
        currentPolicyVersion: 7,
        storageBindingName: "gcs-prod",
        archivedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "aircraft-photos" });

    const editPolicyBtn = screen.getByRole("button", { name: /edit policy/i });
    expect(editPolicyBtn).toBeDisabled();
    expect(editPolicyBtn).toHaveAttribute("aria-disabled", "true");
    expect(editPolicyBtn.getAttribute("title")).toMatch(/archived/i);

    spy.mockRestore();
  });
});

describe("NamespaceDetailPage — presets tab", () => {
  it("renders the RealPresetsTab empty state when the namespace has no presets", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: {
        slug: "real-namespace",
        displayName: "Real Namespace",
        description: undefined,
        currentPolicyVersion: 1,
        storageBindingName: "gcs-prod",
        archivedAt: undefined,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    const presetsSpy = vi
      .spyOn(useNamespacesModule, "useNamespacePresets")
      .mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<
        typeof useNamespacesModule.useNamespacePresets
      >);

    renderPage({ slug: "real-namespace", tab: "presets" });

    // RealPresetsTab renders the empty state CTA when no presets
    expect(screen.getByText(/no presets defined yet/i)).toBeInTheDocument();

    nsSpy.mockRestore();
    presetsSpy.mockRestore();
  });
});

const realNamespace: NamespaceResponseDTO = {
  slug: "real-namespace",
  displayName: "Real Namespace",
  description: undefined,
  currentPolicyVersion: 3,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makePolicy(
  version: number,
  overrides?: Partial<NamespacePolicyResponseDTO>,
): NamespacePolicyResponseDTO {
  return {
    version,
    retentionMode: "none",
    maxFileSizeBytes: 52_428_800,
    allowedMimeTypes: ["image/jpeg"],
    exifHandling: "strip",
    virusScanRequired: true,
    immutable: false,
    servingMode: "signed",
    createdAt: `2026-01-0${version}T10:00:00.000Z`,
    createdBy: `user-${version}@example.com`,
    ...overrides,
  };
}

const samplePolicies: NamespacePolicyResponseDTO[] = [makePolicy(3), makePolicy(2), makePolicy(1)];

describe("NamespaceDetailPage — real namespace policy tab", () => {
  it("renders RealPolicyTab with current-version values when slug is not in demo data", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: realNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);
    const policySpy = vi.spyOn(useNamespacesModule, "useNamespacePolicies").mockReturnValue({
      data: samplePolicies,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespacePolicies>);

    renderPage({ slug: "real-namespace", tab: "policy" });

    // Should show the current version fields label (card title "Policy v3")
    const policyCardTitles = screen.getAllByText(/policy v3/i);
    expect(policyCardTitles.length).toBeGreaterThanOrEqual(1);
    // Should show version history section
    expect(screen.getByText(/version history/i)).toBeInTheDocument();

    nsSpy.mockRestore();
    policySpy.mockRestore();
  });

  it("renders the past-versions panel listing all returned policies", () => {
    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: realNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);
    const policySpy = vi.spyOn(useNamespacesModule, "useNamespacePolicies").mockReturnValue({
      data: samplePolicies,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespacePolicies>);

    renderPage({ slug: "real-namespace", tab: "policy" });

    // Version history panel should list v3, v2, v1 (buttons in the panel)
    const v3Buttons = screen.getAllByRole("button", { name: /v3/ });
    const v2Buttons = screen.getAllByRole("button", { name: /v2/ });
    const v1Buttons = screen.getAllByRole("button", { name: /v1/ });
    expect(v3Buttons.length).toBeGreaterThanOrEqual(1);
    expect(v2Buttons.length).toBeGreaterThanOrEqual(1);
    expect(v1Buttons.length).toBeGreaterThanOrEqual(1);

    nsSpy.mockRestore();
    policySpy.mockRestore();
  });

  it("replaces the policy panel with the selected version's values when a past version is clicked", async () => {
    const user = userEvent.setup();

    const nsSpy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: realNamespace,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);
    const policySpy = vi.spyOn(useNamespacesModule, "useNamespacePolicies").mockReturnValue({
      data: samplePolicies,
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespacePolicies>);

    renderPage({ slug: "real-namespace", tab: "policy" });

    // Initially shows v3 in the card title (CardTitle)
    expect(screen.getAllByText(/policy v3/i).length).toBeGreaterThanOrEqual(1);

    // Click v1 in the version history
    const v1Btn = screen.getByRole("button", { name: /v1/ });
    await user.click(v1Btn);

    // Now card title should show v1
    expect(screen.getAllByText(/policy v1/i).length).toBeGreaterThanOrEqual(1);
    // "Back to current" should appear
    expect(screen.getByText(/back to current/i)).toBeInTheDocument();

    nsSpy.mockRestore();
    policySpy.mockRestore();
  });
});
