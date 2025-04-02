import Link from "next/link"
import { ArrowLeft, Calendar, Coffee, Github, Heart, Twitter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function SupportPage() {
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
      <main className="flex-1 container py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold mb-4">Support the Developer</h1>
            <p className="text-muted-foreground">
              SmartHolidayPlanner is a free tool created to help you maximize your time off. If you find it useful,
              please consider supporting the development.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-primary" />
                  Buy Me a Coffee
                </CardTitle>
                <CardDescription>Support the development with a one-time donation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Your support helps cover hosting costs and enables me to dedicate more time to improving the app.
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  <Coffee className="mr-2 h-4 w-4" />
                  Buy Me a Coffee
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Become a Sponsor
                </CardTitle>
                <CardDescription>Support the project with a monthly contribution</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Recurring donations help plan for the future and ensure continuous improvements to the app.
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  <Heart className="mr-2 h-4 w-4" />
                  Become a Sponsor
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <h2 className="text-xl font-bold mb-4">About the Developer</h2>
            <p className="text-muted-foreground mb-6">
              Hi! I'm a developer passionate about creating tools that make life easier. SmartHolidayPlanner was created
              to help people maximize their time off and plan better vacations.
            </p>

            <div className="flex justify-center gap-4">
              <Button variant="outline" size="icon">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Github className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-12 border-t pt-8">
            <h2 className="text-xl font-bold mb-4">Feature Requests & Feedback</h2>
            <p className="text-muted-foreground mb-6">
              Have ideas for improving SmartHolidayPlanner? I'd love to hear from you! Send your suggestions, feedback,
              or report bugs via email or social media.
            </p>

            <div className="flex justify-center">
              <Button variant="outline">Send Feedback</Button>
            </div>
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

