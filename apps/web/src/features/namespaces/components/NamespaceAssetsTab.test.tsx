import type {
  AssetResponseDTO,
  ListAssetsQueryDTO,
  NamespaceResponseDTO,
  PaginatedResult,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespaceAssetsTab } from "./NamespaceAssetsTab";

const listMock =
  vi.fn<(query: Partial<ListAssetsQueryDTO>) => Promise<PaginatedResult<AssetResponseDTO>>>();

vi.mock("@/services", () => ({
  assetsService: {
    list: (query: Partial<ListAssetsQueryDTO>) => listMock(query),
  },
}));

vi.mock("./UploadAssetsDialog", () => ({
  UploadAssetsDialog: () => null,
}));

const NAMESPACE: NamespaceResponseDTO = {
  slug: "active-ns",
  displayName: "Active",
  description: undefined,
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function withClient(node: React.ReactElement): React.ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <I18nProvider>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </I18nProvider>
  );
}

describe("NamespaceAssetsTab", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("renders the empty state when no assets exist", async () => {
    listMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      lastPage: 1,
    });
    render(withClient(<NamespaceAssetsTab namespace={NAMESPACE} />));
    await waitFor(() => {
      expect(screen.getByText(/no assets/i)).toBeInTheDocument();
    });
  });

  it("renders the asset list", async () => {
    const asset: AssetResponseDTO = {
      publicId: "11111111-1111-1111-1111-111111111111",
      namespaceSlug: "active-ns",
      policyVersion: 1,
      state: "uploaded",
      customMetadata: {},
      legalHold: false,
      stateChangedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    listMock.mockResolvedValue({
      data: [asset],
      total: 1,
      page: 1,
      limit: 50,
      lastPage: 1,
    });
    render(withClient(<NamespaceAssetsTab namespace={NAMESPACE} />));
    await waitFor(() => {
      expect(screen.getByText(/uploaded/i)).toBeInTheDocument();
    });
  });
});
