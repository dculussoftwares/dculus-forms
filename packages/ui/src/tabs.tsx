"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@dculus/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-0.5 border-b border-[rgba(81,76,84,0.12)] dark:border-white/10",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      /* Exact Typeform: inactive = #655d67, active = #4c414e on rgba(87,84,91,0.06) */
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 h-8 text-sm font-medium text-[#655d67] ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
      "hover:text-[#4c414e] hover:bg-[rgba(87,84,91,0.06)]",
      "data-[state=active]:text-[#4c414e] data-[state=active]:bg-[rgba(87,84,91,0.06)]",
      /* Underline bar — Typeform uses a 2px dark bar below the active tab */
      "data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-[#3c323e] data-[state=active]:after:content-['']",
      "dark:text-[#8a8090] dark:hover:text-[#c0b8c2] dark:hover:bg-white/5 dark:data-[state=active]:text-foreground dark:data-[state=active]:bg-white/5 dark:data-[state=active]:after:bg-foreground",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
