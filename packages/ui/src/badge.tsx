import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "./utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        /* Default — Typeform "Completed" pill: neutral bg, #4c414e text, subtle border */
        default:
          "bg-[#f7f7f8] text-[#4c414e] border border-[#dedcde] dark:bg-white/8 dark:text-foreground dark:border-white/10",
        /* Primary — dark aubergine pill (#3c323e) */
        primary:
          "bg-[#3c323e] text-white border border-[#3c323e] dark:bg-[#d4ccd6] dark:text-[#1a141b]",
        /* Secondary — slightly more muted neutral */
        secondary:
          "bg-[#f7f7f8] text-[#655d67] border border-[#dedcde] dark:bg-white/5 dark:text-muted-foreground dark:border-white/8",
        destructive:
          "bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
        outline:
          "border border-[rgba(81,76,84,0.20)] text-[#4c414e] dark:border-white/12 dark:text-foreground",
        /* Accent — Typeform lavender/purple ("NEW", "Demo" tags): #ddd6fa bg */
        accent:
          "bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe] dark:bg-[#ddd6fa]/20 dark:text-[#ddd6fa] dark:border-[#ddd6fa]/30",
        /* Salmon — for field-type icons background context */
        salmon:
          "bg-[#f8cdd8] text-[#3c323e] border border-[#f8cdd8]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }