import * as React from "react"

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils";

/**
 * Card component props extending HTML div attributes
 * Following Dculus functional programming principles
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Main Card container component
 * Functional component with semantic structure and accessibility
 * Following Dculus design principles: functional programming first, full type safety
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-[rgba(81,76,84,0.10)] bg-card text-[#4c414e] shadow-[0_1px_4px_rgba(60,50,62,0.06)] dark:border-white/[0.08] dark:text-foreground",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

/**
 * CardHeader component props extending HTML div attributes
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card header section component
 * Provides consistent spacing and layout for card headers
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

/**
 * CardTitle component props extending HTML heading attributes
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Card title component using semantic h3 element
 * Provides consistent typography and spacing
 */
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-xl font-semibold leading-tight tracking-tight",
        className
      )}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

/**
 * CardDescription component props extending HTML paragraph attributes
 */
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

/**
 * Card description component for supplementary text
 * Uses muted styling for visual hierarchy
 */
const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

/**
 * CardContent component props extending HTML div attributes
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card content area component
 * Main content area with consistent padding
 */
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

/**
 * CardFooter component props extending HTML div attributes
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card footer component for actions and supplementary content
 * Uses flexbox layout for consistent alignment
 */
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } 