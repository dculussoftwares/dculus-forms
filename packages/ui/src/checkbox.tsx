import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils"

/**
 * Checkbox component props extending Radix UI Checkbox primitive
 * Following Dculus functional programming principles with complete TypeScript safety
 */
export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

/**
 * Functional Checkbox component with full accessibility and TypeScript safety
 * Built on Radix UI primitives for best-in-class accessibility
 * Following Dculus design principles: functional programming first, full type safety
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      /* Exact Typeform: 20x20, 4px radius, 0.5px border rgba(132,126,133), inset shadow, checked = #3c323e */
      "peer h-5 w-5 shrink-0 rounded-[4px] border-[0.5px] border-[rgba(132,126,133,0.7)] bg-white/80 shadow-[inset_0_0_0_2px_rgba(83,78,86,0.12)] transition-all duration-150 hover:border-[rgba(81,76,84,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c323e] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#3c323e] data-[state=checked]:border-[#3c323e] data-[state=checked]:text-white data-[state=checked]:shadow-none dark:bg-white/5 dark:border-white/20 dark:data-[state=checked]:bg-[#d4ccd6] dark:data-[state=checked]:border-[#d4ccd6] dark:data-[state=checked]:text-[#1a141b]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }