import type { Meta, StoryObj } from "@storybook/react-vite";

import { IdChip } from "./index";

const meta: Meta<typeof IdChip> = {
  title: "Components/Common/IdChip",
  component: IdChip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof IdChip>;

export const Default: Story = {
  args: {
    id: "01924b3c-7f2a-7d3e-9e1f-4a8b2c6d0e5f",
  },
};

export const ShortId: Story = {
  args: {
    id: "abc123",
  },
};

export const LongUUID: Story = {
  args: {
    id: "01924b3c-7f2a-7d3e-9e1f-4a8b2c6d0e5f",
  },
};
