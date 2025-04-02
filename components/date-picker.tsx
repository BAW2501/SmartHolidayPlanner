"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"

export function DatePicker() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <div className="p-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
        components={{
          IconLeft: () => <ChevronLeft className="h-4 w-4" />,
          IconRight: () => <ChevronRight className="h-4 w-4" />,
        }}
      />
    </div>
  )
}

