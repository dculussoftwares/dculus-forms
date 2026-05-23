"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  OnChangeFn,
  RowSelectionState,
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
  // Controlled row selection (optional — falls back to internal state)
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: (row: TData) => string
  // Row density
  density?: 'compact' | 'default' | 'comfortable'
  // Controlled column sizing (optional — falls back to internal state for persistence)
  columnSizing?: ColumnSizingState
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>
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
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  getRowId,
  density = 'default',
  columnSizing: controlledColumnSizing,
  onColumnSizingChange,
}: ServerDataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [columnResizeMode, setColumnResizeMode] = React.useState<ColumnResizeMode>('onChange')

  const rowSelection = controlledRowSelection ?? internalRowSelection
  const setRowSelection = onRowSelectionChange ?? setInternalRowSelection

  const rowHeightMap: Record<string, number> = { compact: 40, default: 56, comfortable: 76 }
  const rowHeight = rowHeightMap[density]

  const [internalColumnSizing, setInternalColumnSizing] = React.useState<ColumnSizingState>({})
  const columnSizing = controlledColumnSizing ?? internalColumnSizing
  const setColumnSizing = onColumnSizingChange ?? setInternalColumnSizing
  
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
    ...(getRowId ? { getRowId } : {}),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
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
    onColumnSizingChange: setColumnSizing,
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
      <div className="bg-white flex-1 min-h-0 flex flex-col overflow-hidden" style={{ borderRadius: 'inherit' }}>
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
            <thead className="sticky top-0 z-20 bg-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        className="text-left align-middle bg-white whitespace-nowrap relative"
                        style={{
                          width: header.getSize(),
                          height: `${rowHeight}px`,
                          padding: '0px 2px 0px 1px',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#3c323e',
                          boxShadow: 'rgba(86, 82, 90, 0.08) 0px -1px 0px 0px inset',
                          borderRight: '1px solid rgba(86, 82, 90, 0.08)',
                        }}
                      >
                        <div className="flex items-center justify-between h-full">
                          <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </div>
                          {header.column.getCanResize() && (
                            <div className="absolute right-0 top-0 h-full w-2 flex items-center justify-center group/resize">
                              <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className="w-px h-5 bg-[rgba(86,82,90,0.2)] hover:bg-[rgba(86,82,90,0.5)] cursor-col-resize select-none touch-none opacity-0 group-hover/resize:opacity-100 transition-all duration-150"
                                style={{
                                  transform: header.column.getIsResizing()
                                    ? `translateX(${table.getState().columnSizingInfo.deltaOffset}px)`
                                    : '',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            
            <tbody className="bg-white relative">
              {/* Loading overlay for when data exists but is refreshing */}
              {loading && table.getRowModel().rows?.length > 0 && (
                <tr>
                  <td colSpan={columns.length} className="relative p-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/95 to-white/90 backdrop-blur-sm flex items-center justify-center z-10 min-h-[200px]">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-r-blue-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700">Updating...</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "group bg-white transition-colors hover:bg-[#f7f7f8] data-[state=selected]:bg-blue-50",
                      onRowClick && "cursor-pointer",
                      loading && "opacity-40"
                    )}
                    onClick={() => !loading && onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="align-middle [&:has([role=checkbox])]:pr-0"
                        style={{
                          width: cell.column.getSize(),
                          height: `${rowHeight}px`,
                          padding: density === 'compact' ? '4px 10px' : density === 'comfortable' ? '12px 10px' : '8px 10px',
                          fontSize: '14px',
                          color: '#4c414e',
                          borderBottom: '1px solid rgba(86, 82, 90, 0.08)',
                          borderRight: '1px solid rgba(86, 82, 90, 0.08)',
                        }}
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
              ) : loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-64 text-center"
                  >
                    <div className="flex flex-col items-center justify-center space-y-4 py-12">
                      <div className="relative">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-blue-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">Loading responses...</p>
                        <p className="text-xs text-slate-500 mt-1">Please wait while we fetch your data</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
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
                        <p className="text-sm font-medium text-slate-700">No data found</p>
                        <p className="text-xs text-slate-500 mt-1">No responses available or try adjusting your search filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      
      {/* Compact Pagination */}
      <div className="flex items-center justify-between px-4 py-2 bg-white flex-shrink-0" style={{ borderTop: '1px solid rgba(86, 82, 90, 0.08)' }}>
        {/* Rows per page */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 w-14 bg-white border border-slate-200/60 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
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