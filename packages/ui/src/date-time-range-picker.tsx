"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, X, Check } from "lucide-react"

import { cn } from "@dculus/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"

export type SubmittedAtPreset = "last1d" | "last7d" | "last30d"

export type DateTimeRangeValue =
  | { preset: SubmittedAtPreset }
  | { preset: "custom"; from: Date; to: Date }

export interface DateTimeRangePickerLabels {
  allTime: string
  last24Hours: string
  last7Days: string
  last30Days: string
  customRange: string
  apply: string
  cancel: string
  fromTime: string
  toTime: string
}

interface DateTimeRangePickerProps {
  value: DateTimeRangeValue | null
  onChange: (value: DateTimeRangeValue | null) => void
  labels: DateTimeRangePickerLabels
  disabled?: boolean
  className?: string
}

const PRESET_ORDER: SubmittedAtPreset[] = ["last1d", "last7d", "last30d"]

function formatTimeForInput(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hoursStr, minutesStr] = time.split(":")
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  const combined = new Date(date)
  combined.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  )
  return combined
}

/**
 * DateTimeRangePicker
 *
 * Toolbar-style dropdown for the responses table's submission-date filter.
 * Rolling presets ("last1d"/"last7d"/"last30d") carry no from/to — the
 * backend resolves them against its own clock via DATE_LAST_N_DAYS, so
 * they're immune to browser timezone drift. Only "custom" carries explicit
 * from/to Date objects (already combined with the user's chosen time-of-day
 * in the browser's local timezone) for the backend's DATE_BETWEEN operator.
 *
 * @example
 * <DateTimeRangePicker
 *   value={submittedAtFilter}
 *   onChange={setSubmittedAtFilter}
 *   labels={{ allTime: 'All time', last24Hours: 'Last 24 hours', ... }}
 * />
 */
export function DateTimeRangePicker({
  value,
  onChange,
  labels,
  disabled = false,
  className,
}: DateTimeRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [showCustom, setShowCustom] = React.useState(value?.preset === "custom")
  const [draftRange, setDraftRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>(
    value?.preset === "custom"
      ? { from: value.from, to: value.to }
      : { from: undefined, to: undefined }
  )
  const [draftFromTime, setDraftFromTime] = React.useState(
    value?.preset === "custom" ? formatTimeForInput(value.from) : "00:00"
  )
  const [draftToTime, setDraftToTime] = React.useState(
    value?.preset === "custom" ? formatTimeForInput(value.to) : "23:59"
  )

  const presetLabel: Record<SubmittedAtPreset, string> = {
    last1d: labels.last24Hours,
    last7d: labels.last7Days,
    last30d: labels.last30Days,
  }

  const triggerLabel = React.useMemo(() => {
    if (!value) return labels.allTime
    if (value.preset === "custom") {
      return `${format(value.from, "MMM d, h:mm a")} - ${format(value.to, "MMM d, h:mm a")}`
    }
    return presetLabel[value.preset]
  }, [value, labels])

  const resetDraftFromValue = React.useCallback(() => {
    setShowCustom(value?.preset === "custom")
    setDraftRange(
      value?.preset === "custom"
        ? { from: value.from, to: value.to }
        : { from: undefined, to: undefined }
    )
    setDraftFromTime(value?.preset === "custom" ? formatTimeForInput(value.from) : "00:00")
    setDraftToTime(value?.preset === "custom" ? formatTimeForInput(value.to) : "23:59")
  }, [value])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) resetDraftFromValue()
  }

  const handlePresetClick = (preset: SubmittedAtPreset) => {
    onChange({ preset })
    setOpen(false)
  }

  const handleAllTimeClick = () => {
    onChange(null)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const handleApplyCustom = () => {
    if (!draftRange.from || !draftRange.to) return
    onChange({
      preset: "custom",
      from: combineDateAndTime(draftRange.from, draftFromTime),
      to: combineDateAndTime(draftRange.to, draftToTime),
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className={cn("relative inline-flex", className)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn("h-8 justify-start gap-1.5 text-xs font-normal", value && "pr-7")}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[220px]">{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={labels.allTime}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        {!showCustom ? (
          <div className="flex flex-col p-1.5 min-w-[180px]">
            <button
              type="button"
              onClick={handleAllTimeClick}
              className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
            >
              {labels.allTime}
              {!value && <Check className="h-3.5 w-3.5" />}
            </button>
            {PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
              >
                {presetLabel[preset]}
                {value?.preset === preset && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
            >
              {labels.customRange}
              {value?.preset === "custom" && <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={(range) => setDraftRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              initialFocus
            />
            <div className="flex items-center gap-2 border-t p-3">
              <InputGroup className="h-8 w-28">
                <InputGroupAddon>
                  <Clock className="h-3.5 w-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="time"
                  aria-label={labels.fromTime}
                  value={draftFromTime}
                  onChange={(e) => setDraftFromTime(e.target.value)}
                />
              </InputGroup>
              <span className="text-muted-foreground text-xs">-</span>
              <InputGroup className="h-8 w-28">
                <InputGroupAddon>
                  <Clock className="h-3.5 w-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="time"
                  aria-label={labels.toTime}
                  value={draftToTime}
                  onChange={(e) => setDraftToTime(e.target.value)}
                />
              </InputGroup>
            </div>
            <div className="flex items-center justify-end gap-2 border-t p-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCustom(false)}>
                {labels.cancel}
              </Button>
              <Button
                size="sm"
                disabled={!draftRange.from || !draftRange.to}
                onClick={handleApplyCustom}
              >
                {labels.apply}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
