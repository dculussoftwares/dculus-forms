"use client"

import * as React from "react"
import { cn } from "@dculus/utils"

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, disabled, children, ...props }, ref) => {
    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          ...child.props,
          checked: child.props.value === value,
          onChange: onValueChange,
          disabled: disabled || child.props.disabled,
        });
      }
      return child;
    });

    return (
      <div
        className={cn("grid gap-2", className)}
        {...props}
        ref={ref}
      >
        {childrenWithProps}
      </div>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  checked?: boolean
  onChange?: (value: string) => void
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, checked, onChange, disabled, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="radio"
          value={value}
          checked={checked}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            "peer sr-only"
          )}
          {...props}
        />
        <div className={cn(
          "aspect-square h-4 w-4 rounded-full border border-gray-300 ring-offset-background transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          "peer-checked:border-blue-600 peer-checked:text-blue-600",
          "peer-checked:bg-blue-600",
          className
        )}>
          <div className={cn(
            "flex items-center justify-center w-full h-full",
            "peer-checked:text-white"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full bg-white opacity-0 transition-opacity",
              "peer-checked:opacity-100"
            )} />
          </div>
        </div>
      </div>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }