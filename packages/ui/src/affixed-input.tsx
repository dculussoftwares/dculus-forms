import * as React from "react"

import { cn } from "@dculus/utils"
import { Input, type InputProps } from "./input"
import { Textarea, type TextareaProps } from "./textarea"

interface AffixProps {
  /** Text rendered inside the control, before the value (e.g. "$"). */
  prefixText?: string
  /** Text rendered inside the control, after the value (e.g. "kg"). */
  suffixText?: string
  /** Paints the wrapper border red, including while focused. */
  invalid?: boolean
}

const focusControl = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget
    .querySelector<HTMLElement>("input, textarea")
    ?.focus()
}

const Addon: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={cn(
      "shrink-0 max-w-[40%] truncate select-none text-sm text-[#655d67] dark:text-muted-foreground",
      className
    )}
  >
    {children}
  </span>
)

/**
 * Input with an inline prefix/suffix addon. Lays the addons out in normal flow
 * (never absolutely positioned) so the typed value can never collide with them.
 * With no prefix and no suffix it renders a plain `Input`.
 */
const AffixedInput = React.forwardRef<HTMLInputElement, InputProps & AffixProps>(
  ({ prefixText, suffixText, invalid, className, disabled, ...props }, ref) => {
    if (!prefixText && !suffixText) {
      return <Input ref={ref} disabled={disabled} className={className} {...props} />
    }

    return (
      <div
        onClick={focusControl}
        className={cn(
          "flex h-9 w-full items-center rounded-lg border border-[rgba(81,76,84,0.15)] bg-white/80 transition-colors duration-150 focus-within:border-[#3c323e] dark:bg-white/5 dark:border-white/10",
          invalid && "border-[#ce5d55] focus-within:border-[#ce5d55]",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        {prefixText && <Addon className="pl-3">{prefixText}</Addon>}
        <Input
          ref={ref}
          disabled={disabled}
          className={cn(
            "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 disabled:opacity-100 dark:bg-transparent",
            prefixText && "pl-1.5",
            suffixText && "pr-1.5"
          )}
          {...props}
        />
        {suffixText && <Addon className="pr-3">{suffixText}</Addon>}
      </div>
    )
  }
)
AffixedInput.displayName = "AffixedInput"

/** Textarea counterpart of `AffixedInput`; addons align with the first line. */
const AffixedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps & AffixProps
>(({ prefixText, suffixText, invalid, className, disabled, ...props }, ref) => {
  if (!prefixText && !suffixText) {
    return <Textarea ref={ref} disabled={disabled} className={className} {...props} />
  }

  return (
    <div
      onClick={focusControl}
      className={cn(
        "flex w-full items-start rounded-xl border-2 border-gray-200 bg-white transition-colors duration-150 focus-within:border-primary dark:bg-gray-900 dark:border-gray-700",
        invalid && "border-[#ce5d55] focus-within:border-[#ce5d55]",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {prefixText && <Addon className="pl-4 pt-3">{prefixText}</Addon>}
      <Textarea
        ref={ref}
        disabled={disabled}
        className={cn(
          "min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 disabled:opacity-100 dark:bg-transparent",
          prefixText && "pl-2",
          suffixText && "pr-2",
          className
        )}
        {...props}
      />
      {suffixText && <Addon className="pr-4 pt-3">{suffixText}</Addon>}
    </div>
  )
})
AffixedTextarea.displayName = "AffixedTextarea"

export { AffixedInput, AffixedTextarea }
