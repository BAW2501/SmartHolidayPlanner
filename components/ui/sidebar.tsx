"use client"

import { Calendar } from "@/components/ui/calendar"

import * as React from "react"
import { createContext, useContext, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const sidebarVariants = cva("relative flex h-full flex-col border-r bg-background", {
  variants: {
    variant: {
      default: "w-[270px]",
      compact: "w-[70px]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof sidebarVariants> {}

const SidebarContext = createContext<{
  isCompact: boolean
  setIsCompact: React.Dispatch<React.SetStateAction<boolean>>
}>({
  isCompact: false,
  setIsCompact: () => {},
})

const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCompact, setIsCompact] = useState(false)

  return (
    <SidebarContext.Provider value={{ isCompact, setIsCompact }}>
      <div className="flex h-screen overflow-hidden">{children}</div>
    </SidebarContext.Provider>
  )
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(({ className, variant, children, ...props }, ref) => {
  const { isCompact } = useContext(SidebarContext)

  return (
    <div ref={ref} className={cn(sidebarVariants({ variant: isCompact ? "compact" : variant }), className)} {...props}>
      {children}
    </div>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { isCompact } = useContext(SidebarContext)

    return (
      <div ref={ref} className={cn("flex items-center", className)} {...props}>
        {isCompact ? (
          <div className="flex h-full w-full items-center justify-center">
            <Button variant="ghost" size="icon">
              <Calendar className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          children
        )}
      </div>
    )
  },
)
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex-1 overflow-auto", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("mt-auto", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarFooter.displayName = "SidebarFooter"

const SidebarRail = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isCompact, setIsCompact } = useContext(SidebarContext)

    return (
      <div
        ref={ref}
        className={cn(
          "absolute right-0 top-0 h-full w-1 -translate-x-1/2 cursor-ew-resize bg-transparent transition-all",
          className,
        )}
        {...props}
      >
        <div className="absolute right-0 top-1/2 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCompact(!isCompact)}>
            {isCompact ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    )
  },
)
SidebarRail.displayName = "SidebarRail"

const SidebarMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("px-2 py-2", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("my-1", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarMenuItem.displayName = "SidebarMenuItem"

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { isCompact } = useContext(SidebarContext)

    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn("w-full justify-start", isCompact && "h-9 w-9 justify-center p-0", className)}
        {...props}
      >
        {isCompact ? (
          <>
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child) && typeof child.type !== "string") {
                return React.cloneElement(child)
              }
              return null
            })}
          </>
        ) : (
          children
        )}
      </Button>
    )
  },
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <Separator ref={ref} className={cn("my-4", className)} {...props} />
  },
)
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex flex-1 flex-col overflow-hidden", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarInset.displayName = "SidebarInset"

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { setIsCompact } = useContext(SidebarContext)

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("h-9 w-9", className)}
        onClick={() => setIsCompact((prev) => !prev)}
        {...props}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    )
  },
)
SidebarTrigger.displayName = "SidebarTrigger"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
}

