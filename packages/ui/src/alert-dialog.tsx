import React from 'react';

// Following Dculus design principles: import UI components only from @dculus/ui
import { Button } from './button';
import { Card } from './card';

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils"

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
}

interface AlertDialogActionProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

interface AlertDialogCancelProps {
  onClick?: () => void;
  children: React.ReactNode;
}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

export function AlertDialogContent({ children, className = "" }: AlertDialogContentProps) {
  return (
    <Card className={`max-w-lg w-full mx-auto ${className}`}>
      <div className="p-6">
        {children}
      </div>
    </Card>
  );
}

export function AlertDialogHeader({ children }: AlertDialogHeaderProps) {
  return <div className="mb-4">{children}</div>;
}

export function AlertDialogTitle({ children }: AlertDialogTitleProps) {
  return <h2 className="text-lg font-semibold leading-none tracking-tight">{children}</h2>;
}

export function AlertDialogDescription({ children }: AlertDialogDescriptionProps) {
  return <p className="text-sm text-muted-foreground mt-2">{children}</p>;
}

export function AlertDialogFooter({ children }: AlertDialogFooterProps) {
  return <div className="flex justify-end space-x-2 mt-6">{children}</div>;
}

export function AlertDialogAction({ onClick, children, variant = "default", className = "" }: AlertDialogActionProps) {
  return (
    <Button onClick={onClick} variant={variant} className={className}>
      {children}
    </Button>
  );
}

export function AlertDialogCancel({ onClick, children }: AlertDialogCancelProps) {
  return (
    <Button onClick={onClick} variant="outline">
      {children}
    </Button>
  );
}