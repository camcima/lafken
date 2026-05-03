---
name: frontend-forms
description: Implements forms using react-hook-form with Zod validation schemas. Covers form structure, validation patterns, error display, and integration with the API layer. Use when building forms, adding validation, or handling form submissions.
---

# Frontend Forms (react-hook-form + Zod)

## Form Structure

```typescript
// features/Dashboard/components/DashboardForm/index.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/common/Button";

// 1. Define schema OUTSIDE the component
const dashboardFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  currentBase: z.string().min(1, "Base is required").optional(),
});

// 2. Infer type from schema
type DashboardFormData = z.infer<typeof dashboardFormSchema>;

interface DashboardFormProps {
  onSubmitSuccess: (data: DashboardFormData) => void;
}

export function DashboardForm({ onSubmitSuccess }: DashboardFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DashboardFormData>({
    resolver: zodResolver(dashboardFormSchema),
    defaultValues: { email: "", currentBase: "" },
  });

  const onSubmit = async (data: DashboardFormData) => {
    try {
      onSubmitSuccess(data);
      reset();
    } catch (error) {
      // Handle submission error
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t("form.email")}
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="currentBase" className="block text-sm font-medium text-gray-700">
          {t("form.base")}
        </label>
        <input
          id="currentBase"
          {...register("currentBase")}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.currentBase && (
          <p className="mt-1 text-sm text-red-600">{errors.currentBase.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
```

## Key Patterns

### Schema Definition

Always define Zod schemas **outside** the component:

```typescript
const userFormSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["admin", "user", "viewer"]),
  age: z.coerce.number().min(18).max(120).optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;
```

### Form with Mutation

```typescript
function CreateUserForm() {
  const mutation = useMutation({
    mutationFn: (data: UserFormData) => userService.registerUser(data),
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.body.detail ?? "Failed to create user");
      }
    },
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
      {/* fields */}
    </form>
  );
}
```

## Rules

- **Schema outside component** - prevents re-creation on each render
- **`z.infer<typeof schema>`** - derive types from schema (single source of truth)
- **Display errors below inputs** - use `errors.fieldName?.message`
- **Use `zodResolver`** - integrates Zod with react-hook-form
- **i18n for labels** - use `useTranslation()` for all user-facing text
- **Accessibility**: associate labels with `htmlFor`/`id`, use `aria-invalid` for errors
