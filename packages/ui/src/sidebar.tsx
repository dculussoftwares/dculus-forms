import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "./utils"

const SidebarContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  toggleSidebar: () => void
}>({
  open: true,
  setOpen: () => {},
  toggleSidebar: () => {},
})

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ className, defaultOpen = false, open, onOpenChange, children, ...props }, ref) => {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const isOpen = open ?? openState
  const setOpen = React.useCallback((value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value)
    } else {
      setOpenState(value)
    }
  }, [onOpenChange])

  const toggleSidebar = React.useCallback(() => {
    setOpen(!isOpen)
  }, [isOpen, setOpen])

  return (
    <SidebarContext.Provider value={{ open: isOpen, setOpen, toggleSidebar }}>
      <div
        ref={ref}
        className={cn(
          "group/sidebar-wrapper flex min-h-screen w-full has-[[data-variant=inset]]:bg-sidebar",
          className
        )}
        data-sidebar-open={isOpen}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
})
SidebarProvider.displayName = "SidebarProvider"

const useSidebar = () => {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(({ className, side = "left", variant = "sidebar", collapsible = "offcanvas", ...props }, ref) => {
  const { open } = useSidebar()
  
  return (
    <div
      ref={ref}
      data-sidebar={variant}
      data-collapsible={collapsible}
      data-side={side}
      data-state={open ? "open" : "closed"}
      className={cn(
        "group peer hidden md:block sticky top-0",
        variant === "sidebar" && "h-screen bg-sidebar text-sidebar-foreground",
        variant === "floating" && "h-screen bg-sidebar text-sidebar-foreground rounded-lg border border-sidebar-border shadow-lg",
        variant === "inset" && "h-[calc(100vh-2rem)] bg-sidebar text-sidebar-foreground rounded-lg",
        side === "left" && "border-r border-sidebar-border",
        side === "right" && "border-l border-sidebar-border",
        collapsible === "offcanvas" && "transition-[width] duration-200 ease-in-out",
        collapsible === "icon" && "transition-[width] duration-200 ease-in-out",
        open ? "w-64" : collapsible === "icon" ? "w-16" : "w-0",
        className
      )}
      {...props}
    />
  )
})
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 p-4", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-1 flex-col gap-2 p-4 overflow-y-auto", className)}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("p-4", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
})
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => {
  return (
    <li
      ref={ref}
      className={cn("list-none", className)}
      {...props}
    />
  )
})
SidebarMenuItem.displayName = "SidebarMenuItem"

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string
    size?: "default" | "sm" | "lg"
  }
>(({ className, asChild = false, isActive = false, size = "default", ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const { open } = useSidebar()

  return (
    <Comp
      ref={ref}
      className={cn(
        "flex w-full items-center rounded-md text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        open ? "gap-2 px-3 py-2" : "justify-center px-2 py-2",
        size === "lg" && (open ? "h-12 px-4" : "h-12 px-2 justify-center"),
        size === "sm" && (open ? "h-8 px-2 text-xs" : "h-8 px-1 text-xs justify-center"),
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-sm p-0 text-sidebar-foreground outline-none transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-3 [&>svg]:shrink-0",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("relative flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean
  }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  const { open } = useSidebar()

  return (
    <Comp
      ref={ref}
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        !open && "sr-only",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
})
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex h-screen flex-1 flex-col bg-background peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<"button">,
  React.ComponentProps<"button">
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()
  
  return (
    <button
      ref={ref}
      data-sidebar="trigger"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-7 w-7",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

export {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
}
