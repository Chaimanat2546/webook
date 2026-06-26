"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      className="toaster group"
      position="top-center"
      theme={theme as ToasterProps["theme"]}
      {...props}
    />
  )
}

export { Toaster }
