"use client"

import * as React from "react"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Calendar({ className, classNames, showOutsideDays = true, buttonVariant = "ghost", components, ...props }: React.ComponentProps<typeof DayPicker> & { buttonVariant?: React.ComponentProps<typeof Button>["variant"] }) {
  const defaults = getDefaultClassNames()

  return <DayPicker
    showOutsideDays={showOutsideDays}
    className={cn("bg-background p-2", className)}
    classNames={{
      root: cn("w-fit", defaults.root),
      months: cn("flex flex-col", defaults.months),
      month: cn("flex w-full flex-col gap-3", defaults.month),
      nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", defaults.nav),
      button_previous: cn(buttonVariants({ variant: buttonVariant, size: "icon-sm" }), "size-7", defaults.button_previous),
      button_next: cn(buttonVariants({ variant: buttonVariant, size: "icon-sm" }), "size-7", defaults.button_next),
      month_caption: cn("flex h-7 items-center justify-center px-9 text-sm font-medium", defaults.month_caption),
      month_grid: cn("w-full border-collapse", defaults.month_grid),
      weekdays: cn("flex", defaults.weekdays),
      weekday: cn("flex-1 text-center text-xs font-normal text-muted-foreground", defaults.weekday),
      week: cn("mt-1 flex w-full", defaults.week),
      day: cn("relative size-8 p-0 text-center", defaults.day),
      range_start: cn("rounded-l-md bg-muted", defaults.range_start),
      range_middle: cn("rounded-none bg-muted", defaults.range_middle),
      range_end: cn("rounded-r-md bg-muted", defaults.range_end),
      outside: cn("text-muted-foreground opacity-50", defaults.outside),
      disabled: cn("text-muted-foreground opacity-50", defaults.disabled),
      ...classNames,
    }}
    components={{
      Chevron: ({ orientation }) => orientation === "left" ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />,
      DayButton: props => <CalendarDayButton {...props} />,
      ...components,
    }}
    {...props}
  />
}

function CalendarDayButton({ className, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  return <Button
    className={cn("size-8 rounded-md p-0 font-normal data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground", className)}
    data-range-end={modifiers.range_end}
    data-range-middle={modifiers.range_middle}
    data-range-start={modifiers.range_start}
    data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
    size="icon"
    variant="ghost"
    {...props}
  />
}

export { Calendar }
