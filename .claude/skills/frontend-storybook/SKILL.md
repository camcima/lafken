---
name: frontend-storybook
description: Creates Storybook stories for React components following the project conventions. Covers story file structure, variant stories, autodocs, MSW handlers for network requests, and when Storybook is required vs optional. Use when creating stories for reusable or complex components.
---

# Frontend Storybook

## When Required

- **Required**: Reusable components in `src/components/common/`
- **Recommended**: Complex business components in `src/features/*/components/`
- **Optional**: Simple wrapper components, layouts, pages

## File Location

Colocate stories with components:

```
components/common/Button/
  index.tsx
  Button.test.tsx
  Button.stories.tsx    ← Story file
```

## Story Structure

```typescript
// components/common/Button/Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./index";

const meta: Meta<typeof Button> = {
  title: "Components/UI/Button",         // Category/Subcategory/Name
  component: Button,
  parameters: { layout: "centered" },     // or "padded", "fullscreen"
  tags: ["autodocs"],                      // Auto-generate docs page
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: { type: "select" },
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: { type: "boolean" } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: { children: "Button" },
};

// Variant stories
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

// Composition story
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// Loading state
export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <span className="animate-spin">&#8987;</span>
        <span>Loading...</span>
      </>
    ),
  },
};
```

## Form Component Stories

```typescript
// features/Dashboard/components/DashboardForm/DashboardForm.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DashboardForm } from "./index";

const meta: Meta<typeof DashboardForm> = {
  title: "Components/UI/DashboardForm",
  component: DashboardForm,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    onSubmitSuccess: { action: "submitted" },    // Log action in Storybook
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onSubmitSuccess: (data) => console.log("Submitted:", data) },
};

export const InCard: Story = {
  args: { onSubmitSuccess: (data) => console.log("Submitted:", data) },
  render: (args) => (
    <div className="w-full max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">User Information</h2>
      <DashboardForm {...args} />
    </div>
  ),
};
```

## MSW Handlers for Stories

When components make API calls:

```typescript
import { http, HttpResponse } from "msw";

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/v1/work-centers", () => {
          return HttpResponse.json({
            data: [
              { id: "1", name: "Santiago" },
              { id: "2", name: "Lima" },
            ],
            page: 1,
            lastPage: 1,
            total: 2,
          });
        }),
      ],
    },
  },
};
```

## Title Convention

```
Components/UI/<ComponentName>          → Reusable UI components
Components/Forms/<FormName>            → Form components
Components/Navigation/<Name>           → Navigation components
Features/<FeatureName>/<ComponentName> → Feature-specific components
```
