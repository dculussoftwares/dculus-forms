"use client"

import * as React from "react"
import { Column } from "@tanstack/react-table"
import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn("flex items-center space-x-2 group/col", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-[#4c414e]" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-[#4c414e]" />
        ) : (
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-[#655d67] opacity-0 group-hover/col:opacity-60 transition-opacity" />
        )}
      </Button>
    </div>
  )
}