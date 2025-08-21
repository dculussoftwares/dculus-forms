"use client"

import * as React from "react"
import { Table } from "@tanstack/react-table"
import { X, Search } from "lucide-react"

import { Button } from "./button"
import { Input } from "./input"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchPlaceholder?: string
  searchColumn?: string
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = "Search...",
  searchColumn,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0 || table.getState().globalFilter

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={searchPlaceholder}
            value={
              searchColumn
                ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""
                : table.getState().globalFilter ?? ""
            }
            onChange={(event) => {
              if (searchColumn) {
                table.getColumn(searchColumn)?.setFilterValue(event.target.value)
              } else {
                table.setGlobalFilter(event.target.value)
              }
            }}
            className="pl-10 max-w-sm"
          />
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter("")
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}