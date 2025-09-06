"use client"

import * as React from "react"
import { cn } from "@dculus/utils"
import { Check } from "lucide-react"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e)
      onCheckedChange?.(e.target.checked)
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className={cn(
            "peer sr-only"
          )}
          {...props}
        />
        <div className={cn(
          "flex h-4 w-4 items-center justify-center rounded-sm border border-gray-300 ring-offset-background transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          "peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white",
          "hover:border-gray-400 peer-checked:hover:border-blue-700 peer-checked:hover:bg-blue-700",
          className
        )}>
          <Check 
            className={cn(
              "h-3 w-3 transition-opacity",
              checked ? "opacity-100" : "opacity-0"
            )}
            strokeWidth={3}
          />
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }