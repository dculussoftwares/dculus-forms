import React from "react"

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800", className)}
      {...props}
    />
  )
}

export { Skeleton }
