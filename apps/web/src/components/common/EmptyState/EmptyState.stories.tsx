import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderOpen, Search } from "lucide-react";

import { EmptyState } from "./index";

const meta: Meta<typeof EmptyState> = {
  title: "Components/Common/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No items found",
  },
};

export const WithDescription: Story = {
  args: {
    title: "No assets found",
    description: "There are no assets matching your criteria.",
  },
};

export const WithIcon: Story = {
  args: {
    title: "No assets found",
    description: "Upload an asset to get started.",
    icon: FolderOpen,
  },
};

export const WithAction: Story = {
  args: {
    title: "No assets found",
    description: "Upload an asset to get started.",
    icon: FolderOpen,
    action: (
      <button
        type="button"
        className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm"
      >
        Upload asset
      </button>
    ),
  },
};

export const SearchEmpty: Story = {
  args: {
    title: "No results",
    description: "Try adjusting your search terms.",
    icon: Search,
  },
};
