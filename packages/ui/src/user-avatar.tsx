import * as React from "react"
import { Avatar, AvatarImage, AvatarFallback } from "./avatar"
import { cn } from "./utils"

const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-blue-600",
  "bg-violet-600",
  "bg-pink-600",
]

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-2xl",
} as const

function hashStr(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h)
  }
  return Math.abs(h)
}

function getInitials(name?: string | null, email?: string | null): string {
  const src = name?.trim() || email?.trim() || "?"
  if (!name?.trim() && email?.trim()) {
    return email[0].toUpperCase()
  }
  return src
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export interface UserAvatarProps {
  name?: string | null
  email?: string | null
  image?: string | null
  size?: keyof typeof SIZE_CLASSES
  className?: string
  shape?: "circle" | "square"
}

export function UserAvatar({
  name,
  email,
  image,
  size = "md",
  className,
  shape = "circle",
}: UserAvatarProps) {
  const [imgFailed, setImgFailed] = React.useState(false)

  React.useEffect(() => {
    setImgFailed(false)
  }, [image])

  const initials = getInitials(name, email)
  const colorBg = COLORS[hashStr(name || email || "?") % COLORS.length]
  const rounded = shape === "square" ? "rounded-lg" : "rounded-full"
  const showImage = !!image && !imgFailed

  return (
    <Avatar className={cn(SIZE_CLASSES[size], rounded, className)}>
      {showImage && (
        <AvatarImage
          src={image}
          alt={name || email || "User"}
          className={cn("object-cover", rounded)}
          onError={() => setImgFailed(true)}
        />
      )}
      <AvatarFallback className={cn(rounded, colorBg, "text-white font-medium")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
