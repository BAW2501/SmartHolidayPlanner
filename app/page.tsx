import Link from "next/link"
import { ArrowRight, Calendar, Coffee, Gift } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Home() {
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
      <main className="flex-1">
        <section className="container py-12 md:py-24 lg:py-32">
          <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
              Maximize Your Time Off With Smart Planning
            </h1>
            <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
              Strategically place your PTO days around public holidays and weekends to create the longest breaks
              possible.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/optimizer">
                <Button size="lg" className="gap-2">
                  Start Optimizing
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/support">
                <Button size="lg" variant="outline" className="gap-2">
                  <Coffee className="h-4 w-4" />
                  Support the Developer
                </Button>
              </Link>
            </div>
          </div>
        </section>
        <section className="container py-12 md:py-24 lg:py-32">
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-center space-y-4">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                Smart Algorithm
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Get More Days Off With Less PTO
              </h2>
              <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our intelligent algorithm analyzes public holidays and weekends to suggest the optimal placement of your
                precious PTO days.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="relative h-[350px] w-[350px] overflow-hidden rounded-xl border bg-muted/50 p-2">
                <div className="grid h-full grid-cols-7 grid-rows-6 gap-1 rounded-lg bg-background p-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={`header-${i}`}
                      className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
                    </div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => {
                    // Sample data for visualization
                    const isWeekend = i % 7 === 0 || i % 7 === 6
                    const isHoliday = i === 10 || i === 24
                    const isPTO = i === 11 || i === 12 || i === 13 || i === 25 || i === 26

                    let bgColor = "bg-background"
                    if (isWeekend) bgColor = "bg-blue-100"
                    if (isHoliday) bgColor = "bg-red-100"
                    if (isPTO) bgColor = "bg-green-100"

                    return (
                      <div
                        key={`day-${i}`}
                        className={`flex h-10 items-center justify-center rounded-md ${bgColor} text-sm`}
                      >
                        {i + 1}
                      </div>
                    )
                  })}
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
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
            </div>
          </div>
        </section>
        <section className="container py-12 md:py-24 lg:py-32">
          <div className="mx-auto grid max-w-5xl gap-6 py-12 lg:grid-cols-3">
            <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 text-center shadow-sm">
              <div className="rounded-full bg-primary/10 p-3">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Smart Holiday Optimization</h3>
              <p className="text-muted-foreground">
                Enter your country and PTO days to get the optimal vacation schedule.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 text-center shadow-sm">
              <div className="rounded-full bg-primary/10 p-3">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Automatic Holiday Fetching</h3>
              <p className="text-muted-foreground">We automatically load public holidays for your selected country.</p>
            </div>
            <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 text-center shadow-sm">
              <div className="rounded-full bg-primary/10 p-3">
                <Coffee className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Save & Share</h3>
              <p className="text-muted-foreground">Export your optimized leave plan or share it with your team.</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t">
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

