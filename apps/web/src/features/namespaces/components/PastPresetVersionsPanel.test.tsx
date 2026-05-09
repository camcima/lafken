import type { NamespacePresetResponseDTO } from "@shared/backend-api";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { PastPresetVersionsPanel } from "./PastPresetVersionsPanel";

function makePreset(
  version: number,
  overrides?: Partial<NamespacePresetResponseDTO>,
): NamespacePresetResponseDTO {
  return {
    name: "thumbnail",
    version,
    params: { fit: "cover", format: "webp", quality: 80, width: 1080, height: 720 },
    active: version === 2,
    createdAt: `2026-01-0${version}T10:00:00.000Z`,
    ...overrides,
  };
}

const presets: NamespacePresetResponseDTO[] = [
  makePreset(1),
  makePreset(3),
  makePreset(2, { active: true }),
];

function renderPanel(props: {
  presets?: NamespacePresetResponseDTO[];
  selectedVersion?: number;
  onSelectVersion?: (v: number) => void;
}) {
  return render(
    <I18nProvider>
      <PastPresetVersionsPanel
        presets={props.presets ?? presets}
        selectedVersion={props.selectedVersion ?? 3}
        onSelectVersion={props.onSelectVersion ?? vi.fn()}
      />
    </I18nProvider>,
  );
}

describe("PastPresetVersionsPanel", () => {
  it("renders all versions sorted by version descending", () => {
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

  it("shows 'Back to latest' only when selectedVersion !== latest", () => {
    const { rerender } = renderPanel({ selectedVersion: 3 });
    expect(screen.queryByText(/back to latest/i)).not.toBeInTheDocument();

    rerender(
      <I18nProvider>
        <PastPresetVersionsPanel presets={presets} selectedVersion={1} onSelectVersion={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByText(/back to latest/i)).toBeInTheDocument();
  });
});
