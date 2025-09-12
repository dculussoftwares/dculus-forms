import { toast as sonnerToast } from "sonner"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  action?: {
    label: string
    onClick: () => void
  }
}

export const toast = ({ title, description, variant = "default", action }: ToastProps) => {
  const toastOptions = {
    description,
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
  }

  switch (variant) {
    case "destructive":
      sonnerToast.error(title || "Error", toastOptions)
      break
    case "success":
      sonnerToast.success(title || "Success", toastOptions)
      break
    default:
      sonnerToast(title || "Notification", toastOptions)
      break
  }
}

// Export additional toast methods for convenience
export const toastSuccess = (title: string, description?: string) => {
  toast({ title, description, variant: "success" })
}

export const toastError = (title: string, description?: string) => {
  toast({ title, description, variant: "destructive" })
}

export const toastInfo = (title: string, description?: string) => {
  toast({ title, description, variant: "default" })
}