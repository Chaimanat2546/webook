"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({
  className,
  container,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  ...props
}: PopoverPrimitive.Popup.Props & Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & { container?: HTMLElement | null }) {
  return <PopoverPrimitive.Portal container={container}>
    <PopoverPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset} className="isolate z-50">
      <PopoverPrimitive.Popup data-slot="popover-content" className={cn("relative z-50 w-(--anchor-width) min-w-72 origin-(--transform-origin) rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)} {...props} />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
}

export { Popover, PopoverContent, PopoverTrigger }
