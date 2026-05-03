import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { cn } from "@/lib/utils";

const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 100;

function Label(
  props: Readonly<
    Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "htmlFor"> & { htmlFor: string }
  >,
) {
  const { className, ...rest } = props;
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn("text-foreground text-sm font-medium", className)} {...rest} />;
}

function Input(props: Readonly<React.InputHTMLAttributes<HTMLInputElement>>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

function FormMessage({ children }: Readonly<{ children?: React.ReactNode }>) {
  if (!children) return null;
  return <p className="text-destructive mt-1 text-xs">{children}</p>;
}

const dashboardFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(NAME_MAX_LENGTH, { message: "Name must be at most 50 characters" }),
  email: z
    .email({ message: "Please enter a valid email" })
    .max(EMAIL_MAX_LENGTH, { message: "Email must be at most 100 characters" }),
});

type DashboardFormValues = z.infer<typeof dashboardFormSchema>;

type DashboardFormProps = Readonly<{
  className?: string;
  onSubmitSuccess?: (values: DashboardFormValues) => void;
}>;

export function DashboardForm(props: DashboardFormProps) {
  const { className, onSubmitSuccess } = props;
  const { t } = useTranslation();

  const form = useForm<DashboardFormValues>({
    resolver: zodResolver(dashboardFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
    mode: "onBlur",
  });

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    reset,
  } = form;

  function onSubmit(values: DashboardFormValues) {
    onSubmitSuccess?.(values);
    reset(values);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className={cn("space-y-4", className)}>
      <div className="grid gap-2">
        <Label htmlFor="name">{t("dashboard.quickForm.name")}</Label>
        <Input id="name" placeholder="Jane Doe" {...register("name")} />
        <FormMessage>{errors.name?.message}</FormMessage>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="jane@company.com" {...register("email")} />
        <FormMessage>{errors.email?.message}</FormMessage>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {t("dashboard.quickForm.submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
          }}
          disabled={isSubmitting}
        >
          {t("dashboard.quickForm.reset")}
        </Button>
      </div>
    </form>
  );
}

export type { DashboardFormValues };
