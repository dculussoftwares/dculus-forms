import * as React from "react"

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils";

/**
 * Input component props extending HTML input attributes
 * Following Dculus functional programming principles with complete TypeScript safety
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Functional Input component with full accessibility and TypeScript safety
 * Supports all standard input types with consistent styling
 * Following Dculus design principles: functional programming first, full type safety
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-[rgba(81,76,84,0.15)] bg-white/80 px-3 py-1.5 text-sm text-[#4c414e] ring-offset-background transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#655d67] focus-visible:outline-none focus-visible:border-[#3c323e] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:border-white/10 dark:text-foreground dark:placeholder:text-muted-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input } 