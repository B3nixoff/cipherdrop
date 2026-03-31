import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110",
        secondary:
          "border border-white/10 bg-secondary/75 px-5 text-secondary-foreground hover:bg-secondary",
        ghost:
          "px-4 text-foreground/80 hover:bg-white/5 hover:text-foreground",
        destructive:
          "bg-destructive px-5 text-destructive-foreground shadow-lg shadow-destructive/20 hover:brightness-110",
        outline:
          "border border-white/12 bg-white/5 px-5 text-foreground hover:bg-white/10",
      },
      size: {
        default: "h-11",
        sm: "h-10 px-4 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
