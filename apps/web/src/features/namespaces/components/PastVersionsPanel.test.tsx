import type { NamespacePolicyResponseDTO } from "@shared/backend-api";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { PastVersionsPanel } from "./PastVersionsPanel";

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

const policies: NamespacePolicyResponseDTO[] = [makePolicy(1), makePolicy(3), makePolicy(2)];

function renderPanel(props: {
  policies?: NamespacePolicyResponseDTO[];
  currentVersion?: number;
  selectedVersion?: number;
  onSelectVersion?: (v: number) => void;
}) {
  return render(
    <I18nProvider>
      <PastVersionsPanel
        policies={props.policies ?? policies}
        currentVersion={props.currentVersion ?? 3}
        selectedVersion={props.selectedVersion ?? 3}
        onSelectVersion={props.onSelectVersion ?? vi.fn()}
      />
    </I18nProvider>,
  );
}

describe("PastVersionsPanel", () => {
  it("renders all policies sorted by version descending", () => {
    renderPanel({});
    const buttons = screen.getAllByRole("button", { name: /^v\d/ });
    const labels = buttons.map((b) => b.textContent?.trim().slice(0, 2));
    expect(labels[0]).toBe("v3");
    expect(labels[1]).toBe("v2");
    expect(labels[2]).toBe("v1");
  });

  it("marks the selected version with aria-pressed", () => {
    renderPanel({ selectedVersion: 2 });
    const buttons = screen.getAllByRole("button", { name: /^v\d/ });
    const pressedBtn = buttons.find((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressedBtn).toBeTruthy();
    expect(pressedBtn?.textContent).toMatch(/v2/);

    const unpressedBtns = buttons.filter((b) => b.getAttribute("aria-pressed") === "false");
    expect(unpressedBtns).toHaveLength(2);
  });

  it("calls onSelectVersion when a row is clicked", async () => {
    const onSelectVersion = vi.fn();
    renderPanel({ onSelectVersion });
    const v1Btn = screen.getByRole("button", { name: /v1/ });
    await userEvent.click(v1Btn);
    expect(onSelectVersion).toHaveBeenCalledWith(1);
  });

  it("shows 'Back to current' only when selectedVersion !== currentVersion", () => {
    const { rerender } = renderPanel({ selectedVersion: 3, currentVersion: 3 });
    expect(screen.queryByText(/back to current/i)).not.toBeInTheDocument();

    rerender(
      <I18nProvider>
        <PastVersionsPanel
          policies={policies}
          currentVersion={3}
          selectedVersion={1}
          onSelectVersion={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(/back to current/i)).toBeInTheDocument();
  });
});
