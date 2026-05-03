import type { Meta, StoryObj } from "@storybook/react-vite";

import { type AssetState, StatePill } from "./index";

const ALL_STATES: AssetState[] = [
  "pending",
  "uploaded",
  "processing",
  "ready",
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "processing_failed",
  "expired",
  "deleted",
];

const meta: Meta<typeof StatePill> = {
  title: "Components/Common/StatePill",
  component: StatePill,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    state: {
      control: { type: "select" },
      options: ALL_STATES,
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatePill>;

export const Pending: Story = {
  args: { state: "pending" },
};

export const Uploaded: Story = {
  args: { state: "uploaded" },
};

export const Processing: Story = {
  args: { state: "processing" },
};

export const Ready: Story = {
  args: { state: "ready" },
};

export const Rejected: Story = {
  args: { state: "rejected" },
};

export const QuarantinedVirus: Story = {
  args: { state: "quarantined_virus" },
};

export const QuarantinedModeration: Story = {
  args: { state: "quarantined_moderation" },
};

export const ProcessingFailed: Story = {
  args: { state: "processing_failed" },
};

export const Expired: Story = {
  args: { state: "expired" },
};

export const Deleted: Story = {
  args: { state: "deleted" },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL_STATES.map((state) => (
        <StatePill key={state} state={state} />
      ))}
    </div>
  ),
};
