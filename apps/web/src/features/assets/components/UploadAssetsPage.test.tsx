import type {
  IUploadDropzoneRenderProps,
  IUploadFile,
} from "@lafken/react";
import type { NamespaceResponseDTO, PaginatedResult } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Stub the namespaces hook with a single non-archived namespace so the page
// renders the body instead of the loading state.
const NAMESPACE: NamespaceResponseDTO = {
  slug: "fleet-photos",
  displayName: "Fleet Photos",
  description: undefined,
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const NAMESPACES_PAGE: PaginatedResult<NamespaceResponseDTO> = {
  data: [NAMESPACE],
  total: 1,
  page: 1,
  limit: 100,
  lastPage: 1,
};

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({ data: NAMESPACES_PAGE, isLoading: false }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/lib/lafken-client", () => ({
  getLafkenClient: () => ({}),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
  useNavigate: () => () => {},
}));

// Drives the UploadDropzone render-prop with a fixed list of files so the
// test can verify how each lifecycle state is rendered.
const filesState: { value: IUploadFile[] } = { value: [] };

vi.mock("@lafken/react", () => ({
  AssetImage: () => null,
  UploadDropzone: ({
    render: renderProp,
  }: {
    render: (props: IUploadDropzoneRenderProps) => React.ReactNode;
  }) =>
    renderProp({
      files: filesState.value,
      rejections: [],
      dismissRejection: () => {},
      isDragOver: false,
      isUploading: false,
      startUpload: () => Promise.resolve(),
      removeFile: () => {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getInputProps: () => ({ ref: () => {} }) as any,
      getRootProps: () => ({}),
    }),
}));

// Import after mocks so the component picks up the mocked module graph.
// eslint-disable-next-line import/order
import { UploadAssetsPage } from "./UploadAssetsPage";

function makeFile(state: IUploadFile["state"], overrides: Partial<IUploadFile> = {}): IUploadFile {
  return {
    id: `file-${state}`,
    name: `${state}.jpg`,
    size: 1024,
    type: "image/jpeg",
    state,
    publicId: null,
    error: null,
    previewUrl: null,
    terminalAsset: null,
    ...overrides,
  };
}

function renderPage(): ReturnType<typeof render> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <UploadAssetsPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  filesState.value = [];
});

function getStateBadgeText(): string {
  const overlay = document.querySelector(
    'div[class*="absolute"][class*="inset-x-0"][class*="bottom-0"]',
  );
  return overlay?.textContent?.trim() ?? "";
}

describe("UploadAssetsPage lifecycle states", () => {
  it("renders a quarantined badge for files in the quarantined state", () => {
    filesState.value = [makeFile("quarantined", { error: { message: "quarantined: virus" } })];
    renderPage();
    expect(getStateBadgeText().toLowerCase()).toContain("quarantined");
  });

  it("renders a processing indicator for files in the processing state", () => {
    filesState.value = [makeFile("processing")];
    renderPage();
    expect(getStateBadgeText().toLowerCase()).toContain("processing");
  });

  it("renders a ready badge for files in the ready state", () => {
    filesState.value = [makeFile("ready")];
    renderPage();
    expect(getStateBadgeText().toLowerCase()).toContain("ready");
  });

  it("renders a rejected badge for files in the rejected state", () => {
    filesState.value = [makeFile("rejected")];
    renderPage();
    expect(getStateBadgeText().toLowerCase()).toContain("rejected");
  });

  it("renders a failed badge for files in the failed state", () => {
    filesState.value = [makeFile("failed", { error: { message: "polling-timeout" } })];
    renderPage();
    expect(getStateBadgeText().toLowerCase()).toContain("failed");
  });
});
