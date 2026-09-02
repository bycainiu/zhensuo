import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-line focus:ring-2 focus:ring-accent/30",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
