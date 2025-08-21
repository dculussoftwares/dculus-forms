import * as React from "react"
import { cn } from "./utils"

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function TypographyH1({ className, children, ...props }: TypographyProps) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  )
}

export function TypographyH2({ className, children, ...props }: TypographyProps) {
  return (
    <h2
      className={cn(
        "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  )
}

export function TypographyH3({ className, children, ...props }: TypographyProps) {
  return (
    <h3
      className={cn(
        "scroll-m-20 text-2xl font-semibold tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

export function TypographyH4({ className, children, ...props }: TypographyProps) {
  return (
    <h4
      className={cn(
        "scroll-m-20 text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h4>
  )
}

export function TypographyP({ className, children, ...props }: TypographyProps) {
  return (
    <p
      className={cn(
        "leading-7 [&:not(:first-child)]:mt-6",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}






export function TypographyLarge({ className, children, ...props }: TypographyProps) {
  return (
    <div
      className={cn(
        "text-lg font-semibold",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function TypographySmall({ className, children, ...props }: TypographyProps) {
  return (
    <small
      className={cn(
        "text-sm font-medium leading-none",
        className
      )}
      {...props}
    >
      {children}
    </small>
  )
}

export function TypographyMuted({ className, children, ...props }: TypographyProps) {
  return (
    <p
      className={cn(
        "text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

// Table typography components
export function TypographyTable({ className, children, ...props }: TypographyProps) {
  return (
    <div className="my-6 w-full overflow-y-auto">
      <table
        className={cn(
          "w-full",
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export function TypographyTableRow({ className, children, ...props }: TypographyProps) {
  return (
    <tr
      className={cn(
        "m-0 border-t p-0 even:bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TypographyTableHead({ className, children, ...props }: TypographyProps) {
  return (
    <th
      className={cn(
        "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function TypographyTableCell({ className, children, ...props }: TypographyProps) {
  return (
    <td
      className={cn(
        "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
}
