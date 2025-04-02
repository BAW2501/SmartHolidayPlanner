"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toPng } from "html-to-image"
import { Calendar, ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react"
import Holidays from "date-holidays"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Define types
interface Holiday {
  date: Date
  name: string
  type: string
}

interface OptimizationResult {
  startDate: Date
  endDate: Date
  totalDays: number
  ptoDays: Date[]
  holidays: Holiday[]
  weekends: Date[]
}

interface CountryOption {
  code: string
  name: string
}

export default function OptimizerPage() {
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [ptoDaysCount, setPtoDaysCount] = useState<number>(10)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [results, setResults] = useState<OptimizationResult[]>([])
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth())
  const [calendarRef, setCalendarRef] = useState<HTMLDivElement | null>(null)

  // Initialize countries list
  useEffect(() => {
    const hd = new Holidays()
    const countryCodes = hd.getCountries()
    const countryOptions: CountryOption[] = []

    for (const code in countryCodes) {
      countryOptions.push({
        code,
        name: countryCodes[code],
      })
    }

    setCountries(countryOptions.sort((a, b) => a.name.localeCompare(b.name)))

    // Set default country if available
    if (countryOptions.length > 0) {
      // Try to detect user's country or default to US
      const defaultCountry = "US"
      setSelectedCountry(defaultCountry)
    }
  }, [])

  const calculateOptimalPTO = () => {
    if (!selectedCountry || ptoDaysCount <= 0) return

    setIsCalculating(true)

    setTimeout(() => {
      try {
        const hd = new Holidays(selectedCountry)
        hd.init(selectedCountry)

        // Get all holidays for the year
        const rawHolidays = hd.getHolidays(year)
        const holidays: Holiday[] = rawHolidays
          .map((h) => ({
            date: new Date(h.date),
            name: h.name,
            type: h.type,
          }))
          .filter((h) => h.type === "public")

        // Generate all weekends for the year
        const weekends: Date[] = []
        const startDate = new Date(year, 0, 1)
        const endDate = new Date(year, 11, 31)

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const day = d.getDay()
          if (day === 0 || day === 6) {
            // Sunday or Saturday
            weekends.push(new Date(d))
          }
        }

        // Find optimal PTO placement
        const optimizations: OptimizationResult[] = findOptimalPTOPlacements(holidays, weekends, ptoDaysCount, year)

        setResults(optimizations)
        setIsCalculating(false)

        // Update calendar to show the first result's month
        if (optimizations.length > 0) {
          setCurrentMonth(optimizations[0].startDate.getMonth())
        }
      } catch (error) {
        console.error("Error calculating optimal PTO:", error)
        setIsCalculating(false)
      }
    }, 500) // Small delay to show loading state
  }

  const findOptimalPTOPlacements = (
    holidays: Holiday[],
    weekends: Date[],
    ptoDaysCount: number,
    year: number,
  ): OptimizationResult[] => {
    // This is a simplified algorithm for demonstration
    // In a real implementation, we would use a more sophisticated approach

    const results: OptimizationResult[] = []

    // Convert holidays to dates only
    const holidayDates = holidays.map((h) => h.date)

    // Get all workdays (non-weekends, non-holidays)
    const workdays: Date[] = []
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      const isWeekend = day === 0 || day === 6
      const isHoliday = holidayDates.some(
        (h) => h.getFullYear() === d.getFullYear() && h.getMonth() === d.getMonth() && h.getDate() === d.getDate(),
      )

      if (!isWeekend && !isHoliday) {
        workdays.push(new Date(d))
      }
    }

    // Find clusters of holidays and weekends
    const clusters: { start: Date; end: Date; days: Date[] }[] = []

    // Combine holidays and weekends
    const nonWorkDays = [...holidayDates, ...weekends].sort((a, b) => a.getTime() - b.getTime())

    let currentCluster: Date[] = []

    for (let i = 0; i < nonWorkDays.length; i++) {
      const currentDate = nonWorkDays[i]

      if (i === 0) {
        currentCluster.push(currentDate)
        continue
      }

      const prevDate = nonWorkDays[i - 1]
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays <= 3) {
        // If dates are close (potential for bridging)
        currentCluster.push(currentDate)
      } else {
        if (currentCluster.length > 0) {
          clusters.push({
            start: new Date(currentCluster[0]),
            end: new Date(currentCluster[currentCluster.length - 1]),
            days: [...currentCluster],
          })
        }
        currentCluster = [currentDate]
      }
    }

    if (currentCluster.length > 0) {
      clusters.push({
        start: new Date(currentCluster[0]),
        end: new Date(currentCluster[currentCluster.length - 1]),
        days: [...currentCluster],
      })
    }

    // For each significant cluster, try to extend it with PTO days
    for (const cluster of clusters) {
      // Skip small clusters
      if (cluster.days.length < 2) continue

      // Find workdays that could be used as PTO to extend this cluster
      const potentialPTODays: Date[] = []

      // Look for workdays before the cluster
      const clusterStart = new Date(cluster.start)
      clusterStart.setDate(clusterStart.getDate() - 5) // Look up to 5 days before

      for (let d = new Date(clusterStart); d < cluster.start; d.setDate(d.getDate() + 1)) {
        const isWorkday = workdays.some(
          (w) => w.getFullYear() === d.getFullYear() && w.getMonth() === d.getMonth() && w.getDate() === d.getDate(),
        )

        if (isWorkday) {
          potentialPTODays.push(new Date(d))
        }
      }

      // Look for workdays after the cluster
      const clusterEnd = new Date(cluster.end)
      const afterEnd = new Date(clusterEnd)
      afterEnd.setDate(afterEnd.getDate() + 5) // Look up to 5 days after

      for (let d = new Date(clusterEnd); d <= afterEnd; d.setDate(d.getDate() + 1)) {
        const isWorkday = workdays.some(
          (w) => w.getFullYear() === d.getFullYear() && w.getMonth() === d.getMonth() && w.getDate() === d.getDate(),
        )

        if (isWorkday) {
          potentialPTODays.push(new Date(d))
        }
      }

      // If we have enough potential PTO days
      if (potentialPTODays.length >= ptoDaysCount) {
        // Sort by proximity to the cluster
        potentialPTODays.sort((a, b) => {
          const aDist = Math.min(
            Math.abs(a.getTime() - cluster.start.getTime()),
            Math.abs(a.getTime() - cluster.end.getTime()),
          )
          const bDist = Math.min(
            Math.abs(b.getTime() - cluster.start.getTime()),
            Math.abs(b.getTime() - cluster.end.getTime()),
          )
          return aDist - bDist
        })

        // Take the closest PTO days
        const selectedPTODays = potentialPTODays.slice(0, ptoDaysCount)

        // Calculate the new extended range
        const allDays = [...cluster.days, ...selectedPTODays].sort((a, b) => a.getTime() - b.getTime())

        const extendedStart = allDays[0]
        const extendedEnd = allDays[allDays.length - 1]

        // Calculate total consecutive days (including all days between start and end)
        const totalDays = Math.round((extendedEnd.getTime() - extendedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

        results.push({
          startDate: extendedStart,
          endDate: extendedEnd,
          totalDays,
          ptoDays: selectedPTODays,
          holidays: holidays.filter((h) => h.date >= extendedStart && h.date <= extendedEnd),
          weekends: weekends.filter((w) => w >= extendedStart && w <= extendedEnd),
        })
      }
    }

    // Sort results by total days (descending)
    return results.sort((a, b) => b.totalDays - a.totalDays)
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const handleShareImage = async () => {
    if (!calendarRef) return

    try {
      const dataUrl = await toPng(calendarRef)

      // Create a temporary link element
      const link = document.createElement("a")
      link.download = "holiday-plan.png"
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error("Error generating image:", error)
    }
  }

  const renderCalendar = (result: OptimizationResult | null) => {
    const daysInMonth = new Date(year, currentMonth + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, currentMonth, 1).getDay()

    // Create array of days for the current month
    const days = []
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, currentMonth, i))
    }

    // Add empty cells for days before the first day of the month
    const emptyCells = Array(firstDayOfMonth).fill(null)

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">
            {new Date(year, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => (prev - 1 + 12) % 12)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => (prev + 1) % 12)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}

          {emptyCells.map((_, index) => (
            <div key={`empty-${index}`} className="h-12 p-1" />
          ))}

          {days.map((day) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            const isHoliday = result?.holidays.some(
              (h) => h.date.getDate() === day.getDate() && h.date.getMonth() === day.getMonth(),
            )

            const isPTO = result?.ptoDays.some((p) => p.getDate() === day.getDate() && p.getMonth() === day.getMonth())

            const isInRange = result && day >= result.startDate && day <= result.endDate

            let bgColor = "bg-background"
            let textColor = ""

            if (isWeekend && isInRange) bgColor = "bg-blue-100"
            if (isHoliday) bgColor = "bg-red-100"
            if (isPTO) bgColor = "bg-green-100"

            // Current day
            const isToday = day.toDateString() === new Date().toDateString()
            if (isToday) textColor = "font-bold"

            const holiday = result?.holidays.find(
              (h) => h.date.getDate() === day.getDate() && h.date.getMonth() === day.getMonth(),
            )

            return (
              <TooltipProvider key={day.toString()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`h-12 p-1 ${isInRange ? "ring-1 ring-primary/20" : ""}`}>
                      <div
                        className={`h-full w-full rounded-md ${bgColor} flex flex-col items-center justify-center ${textColor}`}
                      >
                        <span className="text-sm">{day.getDate()}</span>
                        {isHoliday && (
                          <span className="text-[10px] leading-tight text-red-600 truncate max-w-full px-1">
                            {holiday?.name.length > 10 ? `${holiday?.name.substring(0, 10)}...` : holiday?.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  {(isHoliday || isPTO || isWeekend) && (
                    <TooltipContent>
                      {isHoliday && <p>{holiday?.name}</p>}
                      {isPTO && <p>PTO Day</p>}
                      {isWeekend && !isHoliday && !isPTO && <p>Weekend</p>}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>

        <div className="flex gap-4 mt-4 justify-center">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-100"></div>
            <span className="text-xs">Weekend</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-red-100"></div>
            <span className="text-xs">Holiday</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-green-100"></div>
            <span className="text-xs">PTO</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Calendar className="h-5 w-5 text-primary" />
            <span>SmartHolidayPlanner</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium">
              Home
            </Link>
            <Link href="/optimizer" className="text-sm font-medium">
              Optimizer
            </Link>
            <Link href="/support" className="text-sm font-medium">
              Support
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container py-8">
        <h1 className="text-3xl font-bold mb-8">Holiday Optimizer</h1>

        <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Input Parameters</CardTitle>
              <CardDescription>
                Select your country and enter the number of PTO days you have available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={year.toString()} onValueChange={(value) => setYear(Number.parseInt(value))}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pto-days">Number of PTO Days</Label>
                <Input
                  id="pto-days"
                  type="number"
                  min="1"
                  max="30"
                  value={ptoDaysCount}
                  onChange={(e) => setPtoDaysCount(Number.parseInt(e.target.value) || 0)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={calculateOptimalPTO}
                disabled={!selectedCountry || ptoDaysCount <= 0 || isCalculating}
                className="w-full"
              >
                {isCalculating ? "Calculating..." : "Calculate Optimal PTO"}
              </Button>
            </CardFooter>
          </Card>

          <div>
            {results.length > 0 ? (
              <Tabs defaultValue="option-0">
                <TabsList className="mb-4">
                  {results.slice(0, 3).map((_, index) => (
                    <TabsTrigger key={index} value={`option-${index}`}>
                      Option {index + 1}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {results.slice(0, 3).map((result, index) => (
                  <TabsContent key={index} value={`option-${index}`}>
                    <Card>
                      <CardHeader>
                        <CardTitle>Optimization Option {index + 1}</CardTitle>
                        <CardDescription>
                          {formatDate(result.startDate)} - {formatDate(result.endDate)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="flex flex-col items-center justify-center rounded-lg border p-4">
                              <span className="text-2xl font-bold">{result.totalDays}</span>
                              <span className="text-sm text-muted-foreground">Total Days Off</span>
                            </div>
                            <div className="flex flex-col items-center justify-center rounded-lg border p-4">
                              <span className="text-2xl font-bold">{result.ptoDays.length}</span>
                              <span className="text-sm text-muted-foreground">PTO Days Used</span>
                            </div>
                            <div className="flex flex-col items-center justify-center rounded-lg border p-4">
                              <span className="text-2xl font-bold">
                                {(result.totalDays / result.ptoDays.length).toFixed(1)}
                              </span>
                              <span className="text-sm text-muted-foreground">Days Off Per PTO</span>
                            </div>
                          </div>

                          <div ref={index === 0 ? setCalendarRef : undefined}>{renderCalendar(result)}</div>

                          <div className="space-y-2">
                            <h4 className="font-medium">PTO Days</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.ptoDays.map((day, i) => (
                                <div key={i} className="rounded-md bg-green-100 px-2 py-1 text-xs">
                                  {formatDate(day)}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-medium">Holidays</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.holidays.map((holiday, i) => (
                                <div key={i} className="rounded-md bg-red-100 px-2 py-1 text-xs">
                                  {formatDate(holiday.date)}: {holiday.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={handleShareImage}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                        <Button>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </Button>
                      </CardFooter>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Results Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Select your country and PTO days, then click Calculate to see optimization options.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="border-t mt-12">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
          <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
            <Calendar className="h-5 w-5 text-primary" />
            <p className="text-center text-sm leading-loose md:text-left">
              © 2024 SmartHolidayPlanner. All rights reserved.
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/support" className="text-sm font-medium">
              Support the Developer
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

