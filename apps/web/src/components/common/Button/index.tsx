import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium cursor-pointer transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "bg-card text-foreground border border-border hover:bg-secondary hover:border-latam-indigo/30",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "bg-transparent text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        pink: "bg-latam-pink text-white border border-latam-pink hover:bg-[#C8004F] hover:border-[#C8004F]",
        indigo:
          "bg-latam-indigo text-white border border-latam-indigo hover:bg-latam-indigo-deep hover:border-latam-indigo-deep",
        danger: "bg-card text-danger border border-danger-line hover:bg-danger-soft",
        glass: "bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm",
      },
      size: {
        default: "h-8 px-3 text-[12.5px] has-[>svg]:px-3",
        sm: "h-7 rounded-md gap-1.5 px-2.5 text-[12px] has-[>svg]:px-2",
        lg: "h-9 rounded-md px-4 has-[>svg]:px-3",
        icon: "size-8",
        "icon-sm": "size-6",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
