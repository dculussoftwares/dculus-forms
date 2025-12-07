import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn } from "@dculus/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean | string
  /** HTML id attribute for the hidden input (for E2E testing and form labels) */
  id?: string
  /** HTML name attribute for the hidden input (for form submission) */
  name?: string
}

/**
 * DatePicker Component
 *
 * A date picker with calendar popup that provides a better UX than native `<input type="date">`.
 *
 * @example
 * const [date, setDate] = useState<Date>()
 *
 * <DatePicker
 *   date={date}
 *   onDateChange={setDate}
 *   placeholder="Select a date"
 *   minDate={new Date()}
 * />
 */
export function DatePicker({
  date,
  onDateChange,
  minDate,
  maxDate,
  placeholder = "Pick a date",
  disabled = false,
  className,
  error = false,
  id,
  name,
}: DatePickerProps) {
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDateChange?.(undefined)
  }

  // Handle native input changes (for E2E testing)
  const handleNativeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value) {
      onDateChange?.(new Date(value))
    } else {
      onDateChange?.(undefined)
    }
  }

  // Format date as ISO string for the hidden input (YYYY-MM-DD)
  const dateValue = date ? date.toISOString().split('T')[0] : ''

  return (
    <div className="relative">
      {/* Hidden input for E2E testing and form submission */}
      <input
        type="date"
        id={id}
        name={name}
        value={dateValue}
        onChange={handleNativeInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "flex w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              error && "border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500",
              date && "pr-8", // Make room for clear button
              className
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={date}
            onSelect={onDateChange}
            disabled={(date) => {
              if (minDate && date < minDate) return true
              if (maxDate && date > maxDate) return true
              return false
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {date && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

interface DateRangePickerProps {
  from?: Date
  to?: Date
  onDateRangeChange?: (from: Date | undefined, to: Date | undefined) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean | string
}

/**
 * DateRangePicker Component
 *
 * A date range picker for selecting start and end dates.
 *
 * @example
 * const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
 *
 * <DateRangePicker
 *   from={dateRange.from}
 *   to={dateRange.to}
 *   onDateRangeChange={(from, to) => setDateRange({ from, to })}
 *   placeholder="Select date range"
 * />
 */
export function DateRangePicker({
  from,
  to,
  onDateRangeChange,
  minDate,
  maxDate,
  placeholder = "Pick a date range",
  disabled = false,
  className,
  error = false,
}: DateRangePickerProps) {
  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    onDateRangeChange?.(range?.from, range?.to)
  }

  const formatDateRange = () => {
    if (from) {
      if (to) {
        return `${format(from, "LLL dd, y")} - ${format(to, "LLL dd, y")}`
      }
      return format(from, "LLL dd, y")
    }
    return placeholder
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "flex w-full justify-start text-left font-normal",
            !from && "text-muted-foreground",
            error && "border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>{formatDateRange()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true
            if (maxDate && date > maxDate) return true
            return false
          }}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
