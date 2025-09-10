import * as React from "react"

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils"

/**
 * Separator component props extending HTML div attributes
 * Following Dculus functional programming principles with complete TypeScript safety
 */
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The orientation of the separator
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical"
  /**
   * Whether the separator is decorative or semantic
   * @default true
   */
  decorative?: boolean
}

/**
 * Functional Separator component for visual division
 * Supports both horizontal and vertical orientations with proper ARIA attributes
 * Following Dculus design principles: functional programming first, full type safety
 */
const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = "Separator"

export { Separator }
