/* eslint-disable no-console */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { DashboardForm } from ".";
import type { DashboardFormValues } from ".";

const meta: Meta<typeof DashboardForm> = {
  title: "Components/UI/DashboardForm",
  component: DashboardForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    onSubmitSuccess: {
      action: "submitted",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DashboardForm>;

export const Default: Story = {
  args: {
    onSubmitSuccess: (data: DashboardFormValues) => {
      console.log("Form submitted with data:", data);
    },
  },
};

export const WithInitialData: Story = {
  args: {
    onSubmitSuccess: (data: DashboardFormValues) => {
      console.log("Form submitted with data:", data);
    },
  },
};

export const WithValidation: Story = {
  args: {
    onSubmitSuccess: (data: DashboardFormValues) => {
      console.log("Form submitted with data:", data);
    },
  },
  render: (args) => (
    <div className="w-full max-w-md">
      <DashboardForm {...args} />
    </div>
  ),
};

export const InCard: Story = {
  args: {
    onSubmitSuccess: (data: DashboardFormValues) => {
      console.log("Form submitted with data:", data);
    },
  },
  render: (args) => (
    <div className="w-full max-w-2xl">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">User Information</h2>
        <DashboardForm {...args} />
      </div>
    </div>
  ),
};

export const WithCustomStyling: Story = {
  args: {
    onSubmitSuccess: (data: DashboardFormValues) => {
      console.log("Form submitted with data:", data);
    },
  },
  render: (args) => (
    <div className="w-full max-w-lg">
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Create New User</h2>
        <DashboardForm {...args} />
      </div>
    </div>
  ),
};

export const Responsive: Story = {
  args: {
    onSubmitSuccess: (data: DashboardFormValues) => {
      console.log("Form submitted with data:", data);
    },
  },
  render: (args) => (
    <div className="w-full max-w-4xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Personal Information</h3>
          <DashboardForm {...args} />
        </div>
        <div className="rounded-lg border bg-gray-50 p-6">
          <h3 className="mb-4 text-lg font-semibold">Form Preview</h3>
          <p className="text-sm text-gray-600">
            This form includes validation and handles user input for creating or updating user
            profiles.
          </p>
        </div>
      </div>
    </div>
  ),
};
