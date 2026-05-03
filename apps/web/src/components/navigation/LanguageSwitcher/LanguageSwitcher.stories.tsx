import type { Meta, StoryObj } from "@storybook/react-vite";

import { LanguageSwitcher } from "./index";

const meta: Meta<typeof LanguageSwitcher> = {
  title: "Components/Common/LanguageSwitcher",
  component: LanguageSwitcher,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof LanguageSwitcher>;

export const Default: Story = {
  render: () => <LanguageSwitcher />,
};

export const WithDescription: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Click to switch between English, Spanish, and Portuguese
      </div>
      <LanguageSwitcher />
    </div>
  ),
};

export const InHeader: Story = {
  render: () => (
    <div className="w-full rounded-lg bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">App Header</div>
        <LanguageSwitcher />
      </div>
    </div>
  ),
};
