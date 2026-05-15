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
          "flex h-12 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 ring-offset-background transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500",
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