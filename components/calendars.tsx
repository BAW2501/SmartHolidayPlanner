import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface CalendarsProps {
  calendars: {
    name: string
    items: string[]
  }[]
}

export function Calendars({ calendars }: CalendarsProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="px-4 text-sm font-medium">Calendars</div>
      <div className="space-y-1">
        {calendars.map((calendar, i) => (
          <Collapsible key={i} defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex w-full justify-between px-4 py-2 h-auto">
                <span className="text-sm font-medium">{calendar.name}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 px-4">
                {calendar.items.map((item, j) => (
                  <div key={j} className="flex items-center space-x-2 py-1">
                    <Checkbox id={`calendar-${i}-${j}`} defaultChecked />
                    <label
                      htmlFor={`calendar-${i}-${j}`}
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}

