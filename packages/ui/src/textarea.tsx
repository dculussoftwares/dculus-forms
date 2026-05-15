import * as React from "react"

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils";

/**
 * Textarea component props extending HTML textarea attributes
 * Following Dculus functional programming principles with complete TypeScript safety
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Functional Textarea component with full accessibility and TypeScript safety
 * Multi-line text input with consistent styling and auto-resize capabilities
 * Following Dculus design principles: functional programming first, full type safety
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 ring-offset-background transition-colors duration-150 placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea } 