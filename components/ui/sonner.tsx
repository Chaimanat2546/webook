"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      {...props}
      theme="dark"
      expand
    />
  )
}

export { Toaster }
