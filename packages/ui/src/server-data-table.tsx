"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnResizeMode,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"

interface ServerDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  onRowClick?: (row: TData) => void
  className?: string
  maxHeight?: string
  // Server-side pagination props
  pageCount: number
  currentPage: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  // Server-side sorting props
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSortingChange?: (column: string) => void
  loading?: boolean
}

export function ServerDataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  onRowClick,
  className,
  maxHeight = "600px",
  pageCount,
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortOrder,
  onSortingChange,
  loading = false,
}: ServerDataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [columnResizeMode, setColumnResizeMode] = React.useState<ColumnResizeMode>('onChange')
  
  // Convert server sorting to TanStack format for display
  const sorting = React.useMemo((): SortingState => {
    if (sortBy) {
      return [{ id: sortBy, desc: sortOrder === 'desc' }]
    }
    return []
  }, [sortBy, sortOrder])
  
  // Note: Global filter is applied client-side on the current page data
  // For true server-side search, you would need to pass the search term to the backend

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize,
      },
    },
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Table Container - Only this part scrolls horizontally */}
      <div className="bg-white border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Table wrapper with horizontal scroll ONLY for table content */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div 
            className="overflow-auto absolute inset-0" 
            style={{ maxHeight }}
          >
            <table 
              className="relative" 
              style={{ 
                width: table.getCenterTotalSize(),
                minWidth: '100%'
              }}
            >
            {/* Enhanced Header */}
            <thead className="sticky top-0 z-20 bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 backdrop-blur-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200">
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        className="h-14 px-6 text-left align-middle font-semibold text-slate-700 [&:has([role=checkbox])]:pr-0 whitespace-nowrap bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b border-slate-200/80 first:pl-8 last:pr-8 relative"
                        style={{ width: header.getSize() }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </div>
                          {/* Enhanced Resize handle */}
                          {header.column.getCanResize() && (
                            <div className="absolute right-0 top-0 h-full w-2 flex items-center justify-center group/resize">
                              <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className="w-1 h-8 bg-slate-300 hover:bg-blue-500 cursor-col-resize select-none touch-none opacity-0 group-hover/resize:opacity-100 transition-all duration-200 rounded-full"
                                style={{
                                  transform: header.column.getIsResizing()
                                    ? `translateX(${table.getState().columnSizingInfo.deltaOffset}px)`
                                    : '',
                                }}
                              />
                              {/* Resize icon indicator */}
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/resize:opacity-70 transition-opacity duration-200 pointer-events-none">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            
            {/* Enhanced Body */}
            <tbody className="bg-white relative divide-y divide-slate-100">
              {/* Premium Loading overlay */}
              {loading && (
                <tr>
                  <td colSpan={columns.length} className="relative p-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/95 to-white/90 backdrop-blur-sm flex items-center justify-center z-10 min-h-[300px]">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-r-blue-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700">Loading responses...</p>
                          <p className="text-xs text-slate-500 mt-1">Preparing your data</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "group transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 data-[state=selected]:bg-blue-50 hover:shadow-sm",
                      onRowClick && "cursor-pointer",
                      loading && "opacity-40",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    )}
                    onClick={() => !loading && onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-6 py-4 align-middle text-sm transition-all duration-200 group-hover:text-slate-900",
                          "[&:has([role=checkbox])]:pr-0",
                          cellIndex === 0 ? "pl-8" : "",
                          cellIndex === row.getVisibleCells().length - 1 ? "pr-8" : ""
                        )}
                        style={{ width: cell.column.getSize() }}
                      >
                        <div className="break-words">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : !loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3 py-8">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">No results found</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your search or filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      
      {/* Compact Pagination */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 flex-shrink-0">
        {/* Rows per page */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 w-14 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            disabled={loading}
          >
            {[10, 20, 30, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600">{currentPage} of {pageCount}</span>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === pageCount || loading}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}