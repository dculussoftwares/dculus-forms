import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@dculus/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        /* Primary — exact Typeform #3c323e aubergine dark button */
        default:
          "bg-[#3c323e] text-white hover:bg-[#2e2530] dark:bg-[#d4ccd6] dark:text-[#1a141b] dark:hover:bg-[#c4bac6]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /* Outline — exact Typeform ghost: rgba(255,255,255,0.8) bg + rgba(81,76,84,0.15) border */
        outline:
          "bg-white/80 text-[#655d67] border border-[rgba(81,76,84,0.15)] hover:bg-[#f7f7f8] hover:text-[#4c414e] dark:bg-white/5 dark:text-[#8a8090] dark:border-white/10 dark:hover:bg-white/10",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        /* Ghost — Typeform inactive nav/toolbar: transparent + subtle hover */
        ghost:
          "text-[#655d67] hover:bg-[rgba(87,84,91,0.06)] hover:text-[#4c414e] dark:text-[#8a8090] dark:hover:bg-white/5 dark:hover:text-[#c0b8c2]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 rounded-lg px-4 py-1.5 text-sm",
        sm: "h-8 rounded-lg px-3 text-sm",
        lg: "h-11 rounded-lg px-6 text-sm",
        pill: "h-11 rounded-full px-7 text-sm shadow-sm hover:shadow-md",
        icon: "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
