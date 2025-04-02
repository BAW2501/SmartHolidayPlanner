"use client"

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { Calendar, ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import Holidays from "date-holidays";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Helper Functions ---

// Helper function to check if two dates are the same day (ignoring time)
const isSameDay = (date1: Date, date2: Date): boolean => {
    if (!date1 || !date2) return false;
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
};

// Helper function to add days to a date
const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// --- Define Types ---
interface Holiday {
    date: Date;
    name: string;
    type: string;
}

interface OptimizationResult {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    ptoDays: Date[];
    holidays: Holiday[]; // Specific holidays within the result range
    weekends: Date[];   // Specific weekends within the result range
}

interface CountryOption {
    code: string;
    name: string;
}

// --- Improved Algorithm ---
const findOptimalPTOPlacements = (
    allHolidaysOfYear: Holiday[], // All public holidays for the year
    allWeekendsOfYear: Date[], // All weekend days for the year
    ptoDaysCount: number,
    year: number
): OptimizationResult[] => {
    const results: OptimizationResult[] = [];
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    // 1. Create a set of all non-work days (holidays + weekends) for quick lookup
    const nonWorkDaySet = new Set<string>();
    const holidayMap = new Map<string, Holiday>(); // Store holiday details

    allHolidaysOfYear.forEach(h => {
        const dateStr = h.date.toDateString();
        nonWorkDaySet.add(dateStr);
        holidayMap.set(dateStr, h);
    });
    allWeekendsOfYear.forEach(w => {
        nonWorkDaySet.add(w.toDateString());
    });

    // 2. Iterate through all possible start dates in the year
    for (let d = new Date(yearStart); d <= yearEnd; d = addDays(d, 1)) {

        // 3. For each potential start date, try to build the longest sequence
        let ptoUsed = 0;
        let currentSequence: Date[] = []; // Stores all consecutive days off (non-work or PTO)

        // Iterate forward from the potential start date 'd'
        for (let currentDay = new Date(d); currentDay <= yearEnd; currentDay = addDays(currentDay, 1)) {
            const currentDayStr = currentDay.toDateString();
            const isNonWorkDay = nonWorkDaySet.has(currentDayStr);

            if (isNonWorkDay) {
                // If it's a holiday or weekend, just add it to the sequence
                currentSequence.push(new Date(currentDay));
            } else {
                // It's a workday. Can we use PTO?
                if (ptoUsed < ptoDaysCount) {
                    // Yes, use a PTO day
                    ptoUsed++;
                    currentSequence.push(new Date(currentDay));
                } else {
                    // No more PTO days left, this sequence ends here
                    break;
                }
            }

            // Check if this sequence (ending *now*) is a candidate
            if (currentSequence.length > 0) {
                const startDate = currentSequence[0];
                const endDate = currentSequence[currentSequence.length - 1];
                const totalDays = currentSequence.length;

                // Extract PTO days, holidays, weekends from the current sequence
                const ptoDaysInSequence: Date[] = [];
                const holidaysInSequence: Holiday[] = [];
                const weekendsInSequence: Date[] = [];

                currentSequence.forEach(seqDay => {
                    const seqDayStr = seqDay.toDateString();
                    const holidayDetails = holidayMap.get(seqDayStr);
                    const dayOfWeek = seqDay.getDay();
                    const isActualWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    if (holidayDetails) {
                        holidaysInSequence.push(holidayDetails);
                        // Note: A holiday can also be a weekend
                        if (isActualWeekend) {
                             weekendsInSequence.push(new Date(seqDay));
                        }
                    } else if (isActualWeekend) {
                        weekendsInSequence.push(new Date(seqDay));
                    } else {
                        // If it's not a holiday and not a weekend, it *must* be a PTO day we added
                        ptoDaysInSequence.push(new Date(seqDay));
                    }
                });

                // We only consider a result valid if it potentially uses PTO,
                // or if the user requested 0 PTO days and it's a natural long weekend/holiday block.
                // The number of PTO days *actually identified* in this sequence must not exceed the budget.
                if (ptoDaysInSequence.length <= ptoDaysCount && totalDays > 0) {
                    // Only add if it uses PTO, OR if ptoDaysCount is 0 and it's just holidays/weekends
                   if (ptoDaysInSequence.length > 0 || (ptoDaysCount === 0 && totalDays > 1 && holidaysInSequence.length + weekendsInSequence.length === totalDays)) {
                        results.push({
                            startDate: startDate,
                            endDate: endDate,
                            totalDays: totalDays,
                            ptoDays: ptoDaysInSequence,
                            holidays: holidaysInSequence,
                            weekends: weekendsInSequence, // Capture specific weekends in the range
                        });
                    }
                }
            }
        } // End inner loop (extending sequence)
    } // End outer loop (potential start dates)

    // 4. Post-process the results
    const uniqueResults = new Map<string, OptimizationResult>();

    results.forEach(res => {
        const key = `${res.startDate.toDateString()}-${res.endDate.toDateString()}`;
        const existing = uniqueResults.get(key);

        // Keep the result for a given period if it's the first one found,
        // or if it achieves the same period length potentially using a number of PTO days
        // that aligns better with how it was constructed (this logic might need refinement
        // based on exact preference, e.g., always prefer fewer PTO for same length).
        // For now, simplest is to just store one per unique period, the first one encountered
        // which is usually the longest extension found starting earliest.
        // Let's refine to store the one with the MOST days for that key (should be redundant if key includes end date)
        // or FEWER PTO days for the exact same start/end dates.
       if (!existing || res.totalDays > existing.totalDays || (res.totalDays === existing.totalDays && res.ptoDays.length < existing.ptoDays.length) ) {
           uniqueResults.set(key, res);
       }
    });

    // Filter again to ensure PTO count constraint is strictly met after deduplication
    const finalResults = Array.from(uniqueResults.values())
       .filter(res => res.ptoDays.length <= ptoDaysCount);


    // Sort:
    // 1. Longest total duration (descending)
    // 2. Number of PTO days used (descending - prioritize using the budget for a given length)
    // 3. Start date (ascending)
    finalResults.sort((a, b) => {
        if (b.totalDays !== a.totalDays) {
            return b.totalDays - a.totalDays;
        }
        // For same total length, prioritize results using more PTO (closer to budget)
        if (b.ptoDays.length !== a.ptoDays.length) {
           return b.ptoDays.length - a.ptoDays.length;
        }
        // // Alternative: Prioritize results using fewer PTO days for the same length
        // if (a.ptoDays.length !== b.ptoDays.length) {
        //     return a.ptoDays.length - b.ptoDays.length;
        // }
        return a.startDate.getTime() - b.startDate.getTime(); // Earlier start date first
    });

    // Limit to top N results (e.g., top 10)
    return finalResults.slice(0, 10);
};


// --- React Component ---
export default function OptimizerPage() {
    const [countries, setCountries] = useState<CountryOption[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [ptoDaysCount, setPtoDaysCount] = useState<number>(10);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [results, setResults] = useState<OptimizationResult[]>([]);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
    const [activeTab, setActiveTab] = useState<string>("option-0"); // Track active tab

    // Ref for the calendar element of the currently active tab
    const calendarRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Function to set ref for a specific tab index
    const setCalendarRef = useCallback((el: HTMLDivElement | null, index: number) => {
        calendarRefs.current[index] = el;
    }, []);


    // Initialize countries list
    useEffect(() => {
        const hd = new Holidays();
        const countryCodes = hd.getCountries();
        const countryOptions: CountryOption[] = [];

        for (const code in countryCodes) {
            // Basic filtering for countries likely to have data
            if (code.length === 2) { // Often primary countries have 2-letter codes
                 countryOptions.push({
                    code,
                    name: countryCodes[code],
                });
            }
        }

        setCountries(countryOptions.sort((a, b) => a.name.localeCompare(b.name)));

        // Set default country if available - Try US, then GB, then first in list
        const defaultCountries = ["US", "GB"];
        let foundDefault = false;
        for(const code of defaultCountries) {
            if (countryOptions.some(c => c.code === code)) {
                 setSelectedCountry(code);
                 foundDefault = true;
                 break;
            }
        }
        if (!foundDefault && countryOptions.length > 0) {
             setSelectedCountry(countryOptions[0].code);
        }

    }, []);

    const calculateOptimalPTO = () => {
        if (!selectedCountry || ptoDaysCount < 0) return; // Allow 0 PTO days

        setIsCalculating(true);
        setResults([]); // Clear previous results immediately

        // Use setTimeout for visual feedback, calculation itself might be fast
        setTimeout(() => {
            try {
                const hd = new Holidays();
                // Ensure the country is initialized before getting holidays
                // This might fetch subdivisions if needed, depending on the library version/country
                hd.init(selectedCountry);

                // Get all public holidays for the year
                const rawHolidays = hd.getHolidays(year);
                const publicHolidays: Holiday[] = rawHolidays
                    .filter((h) => h.type === "public")
                    .map((h) => ({
                        date: new Date(h.date), // Ensure Date object
                        name: h.name,
                        type: h.type,
                    }))
                    // Sort holidays just in case they aren't
                    .sort((a, b) => a.date.getTime() - b.date.getTime());

                // Generate all weekends for the year
                const weekends: Date[] = [];
                const yearStartDate = new Date(year, 0, 1);
                const yearEndDate = new Date(year, 11, 31);
                for (let d = new Date(yearStartDate); d <= yearEndDate; d = addDays(d, 1)) {
                    const day = d.getDay();
                    if (day === 0 || day === 6) { // Sunday or Saturday
                        weekends.push(new Date(d));
                    }
                }

                // *** Use the new algorithm ***
                const optimizations: OptimizationResult[] = findOptimalPTOPlacements(
                    publicHolidays,
                    weekends,
                    ptoDaysCount,
                    year
                );

                console.log("Optimization Results:", optimizations); // Debugging log

                setResults(optimizations);
                setIsCalculating(false);

                if (optimizations.length > 0) {
                    setCurrentMonth(optimizations[0].startDate.getMonth());
                    setActiveTab("option-0"); // Reset to first tab on new calculation
                } else {
                    setCurrentMonth(new Date().getMonth()); // Reset month if no results
                }
            } catch (error) {
                console.error("Error calculating optimal PTO:", error);
                // Consider showing an error message to the user
                setResults([]); // Clear results on error
                setIsCalculating(false);
            }
        }, 50); // Short delay for UI feedback
    };

    const formatDate = (date: Date | null | undefined): string => {
        if (!date) return "";
        return date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const handleShareImage = async () => {
        // Find the index of the active tab
        const activeIndex = parseInt(activeTab.split('-')[1] || '0', 10);
        const activeCalendarRef = calendarRefs.current[activeIndex];

        if (!activeCalendarRef) {
            console.error("Active calendar ref not found for tab:", activeTab);
            // Optionally show an error message to the user
            return;
        }

        try {
            // Ensure styles are applied before capture (might need slight delay or specific library options)
            const dataUrl = await toPng(activeCalendarRef, {
                // Options to improve quality or include styles if needed
                 backgroundColor: '#ffffff', // Set background for transparency issues
                 pixelRatio: 2, // Increase resolution
                 style: {
                    // Ensure styles that might be applied via cascade are included if necessary
                 }
            });

            // Create a temporary link element
            const link = document.createElement("a");
            link.download = `holiday-plan-${year}-opt${activeIndex + 1}.png`;
            link.href = dataUrl;
            document.body.appendChild(link); // Required for Firefox
            link.click();
            document.body.removeChild(link); // Clean up
        } catch (error) {
            console.error("Error generating image:", error);
            // Optionally show an error message to the user
        }
    };

    const renderCalendar = (result: OptimizationResult | null, month: number, year: number) => {
        if (!result) return null; // Should not happen if called correctly, but safe guard

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonthDate = new Date(year, month, 1);
        const firstDayOfMonthWeekday = firstDayOfMonthDate.getDay(); // 0=Sun, 1=Mon, ...

        // Create array of Date objects for the current month
        const days: Date[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        // Add empty cells for days before the first day of the month
        const emptyCells = Array(firstDayOfMonthWeekday).fill(null);

        return (
            <div className="mt-4 border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-lg">
                        {firstDayOfMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h3>
                    {/* Month navigation could be added here if needed within the calendar itself */}
                </div>
                <div className="grid grid-cols-7 gap-px text-center text-xs"> {/* Use gap-px for fine lines */}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="pb-1 font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}

                    {emptyCells.map((_, index) => (
                        <div key={`empty-${index}`} className="h-16" /> // Adjust height as needed
                    ))}

                    {days.map((day) => {
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const holidayInfo = result.holidays.find(h => isSameDay(h.date, day));
                        const isHoliday = !!holidayInfo;
                        const isPTO = result.ptoDays.some(p => isSameDay(p, day));
                        const isInRange = day >= result.startDate && day <= result.endDate;

                        let bgColor = "bg-white"; // Default background
                        let textColor = "text-gray-700";
                        let ringClass = "";
                        let fontWeight = "font-normal";

                        // Determine background color - PTO takes precedence
                        if (isPTO) {
                            bgColor = "bg-green-100 hover:bg-green-200";
                            textColor = "text-green-800";
                        } else if (isHoliday) {
                            bgColor = "bg-red-100 hover:bg-red-200";
                             textColor = "text-red-800";
                        } else if (isWeekend && isInRange) {
                            bgColor = "bg-blue-100 hover:bg-blue-200";
                             textColor = "text-blue-800";
                        } else if (isWeekend) {
                             bgColor = "bg-gray-50"; // Subtle grey for weekends outside range
                             textColor = "text-gray-500";
                        } else if (!isInRange) {
                             textColor = "text-gray-400"; // Dim workdays outside range
                        }


                        if (isInRange) {
                            ringClass = "ring-1 ring-primary/60 ring-inset"; // Inset ring within the cell
                        }

                        const isToday = isSameDay(day, new Date());
                        if (isToday) {
                            fontWeight = "font-bold";
                            textColor = isPTO ? textColor : (isHoliday ? textColor : (isWeekend ? textColor : "text-primary")); // Highlight today's number
                        }


                        return (
                            <TooltipProvider key={day.toISOString()} delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className={`h-16 p-1 ${ringClass} ${bgColor} transition-colors duration-150 flex flex-col items-center justify-start border border-gray-100`}>
                                                <span className={`text-sm ${fontWeight} ${textColor} mb-0.5`}>
                                                    {day.getDate()}
                                                </span>
                                                {isHoliday && !isPTO && (
                                                    <span className="text-[10px] leading-tight text-red-700 font-medium truncate max-w-full px-0.5 text-center block">
                                                        {holidayInfo.name.length > 12 ? `${holidayInfo.name.substring(0,10)}...` : holidayInfo.name}
                                                    </span>
                                                )}
                                                {isPTO && (
                                                    <span className="text-[10px] leading-tight text-green-700 font-bold px-0.5 text-center block">
                                                        PTO
                                                    </span>
                                                )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs max-w-xs">
                                        <p className="font-semibold">{formatDate(day)}</p>
                                        {isHoliday && <p>Holiday: {holidayInfo.name}</p>}
                                        {isPTO && <p>PTO Day</p>}
                                        {isWeekend && !isHoliday && !isPTO && <p>Weekend</p>}
                                        {!isHoliday && !isPTO && !isWeekend && <p>Work Day</p>}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex gap-3 sm:gap-4 mt-4 justify-center flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-blue-100 border border-blue-200"></div>
                        <span className="text-xs text-muted-foreground">Weekend (in range)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-red-100 border border-red-200"></div>
                        <span className="text-xs text-muted-foreground">Holiday</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-green-100 border border-green-200"></div>
                        <span className="text-xs text-muted-foreground">PTO Used</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                         <div className="h-3 w-3 rounded-full bg-white border border-gray-300"></div>
                        <span className="text-xs text-muted-foreground">Work Day (in range)</span>
                    </div>
                </div>
            </div>
        );
    };

    // Main Component Return
    return (
        <div className="flex min-h-screen flex-col bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span>SmartHolidayPlanner</span>
                    </Link>
                    {/* <nav className="flex items-center gap-4">
                        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary">Home</Link>
                        <Link href="/optimizer" className="text-sm font-medium text-primary" aria-current="page">Optimizer</Link>
                        <Link href="/support" className="text-sm font-medium text-muted-foreground hover:text-primary">Support</Link>
                    </nav> */}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container py-8 md:py-12">
                <h1 className="text-3xl font-bold mb-8 text-center md:text-left">Holiday Optimizer</h1>

                <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
                    {/* Input Section */}
                    <div className="lg:col-span-1">
                        <Card className="sticky top-20"> {/* Make inputs sticky */}
                            <CardHeader>
                                <CardTitle>Plan Your Break</CardTitle>
                                <CardDescription>
                                    Find the longest possible holiday using your available PTO days.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Select value={selectedCountry} onValueChange={setSelectedCountry} required>
                                        <SelectTrigger id="country">
                                            <SelectValue placeholder="Select a country" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {countries.length === 0 && <SelectItem value="loading" disabled>Loading countries...</SelectItem>}
                                            {countries.map((country) => (
                                                <SelectItem key={country.code} value={country.code}>
                                                    {country.name} ({country.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="year">Year</Label>
                                        <Select value={year.toString()} onValueChange={(value) => setYear(Number.parseInt(value))}>
                                            <SelectTrigger id="year">
                                                <SelectValue placeholder="Select year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((y) => (
                                                    <SelectItem key={y} value={y.toString()}>
                                                        {y}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pto-days">PTO Days</Label>
                                        <Input
                                            id="pto-days"
                                            type="number"
                                            min="0" // Allow 0 PTO days
                                            max="50" // Reasonable max
                                            value={ptoDaysCount}
                                            onChange={(e) => setPtoDaysCount(Math.max(0, Number.parseInt(e.target.value) || 0))}
                                            required
                                        />
                                    </div>
                                </div>


                            </CardContent>
                            <CardFooter>
                                <Button
                                    onClick={calculateOptimalPTO}
                                    disabled={!selectedCountry || ptoDaysCount < 0 || isCalculating}
                                    className="w-full"
                                    size="lg"
                                >
                                    {isCalculating ? "Calculating..." : "Find Longest Holiday"}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    {/* Results Section */}
                    <div className="lg:col-span-2">
                        {isCalculating ? (
                            <div className="flex flex-col items-center justify-center h-64 p-8 text-center border rounded-lg bg-card">
                                <Calendar className="h-12 w-12 text-primary animate-pulse mb-4" />
                                <h3 className="text-lg font-medium mb-2">Calculating Optimal Options...</h3>
                                <p className="text-muted-foreground">Please wait while we crunch the numbers.</p>
                            </div>
                        ) : results.length > 0 ? (
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="mb-4 grid w-full grid-cols-3">
                                    {results.slice(0, 3).map((_, index) => (
                                        <TabsTrigger key={index} value={`option-${index}`} disabled={!results[index]}>
                                            Option {index + 1}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>

                                {results.slice(0, 3).map((result, index) => (
                                    <TabsContent key={index} value={`option-${index}`} className="mt-0">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Optimization Option {index + 1}: {result.totalDays}-Day Break</CardTitle>
                                                <CardDescription>
                                                    From {formatDate(result.startDate)} to {formatDate(result.endDate)} using {result.ptoDays.length} PTO day(s).
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="grid gap-4 sm:grid-cols-3 text-center">
                                                    <div className="flex flex-col items-center justify-center rounded-lg border p-4 bg-gray-50/50">
                                                        <span className="text-3xl font-bold">{result.totalDays}</span>
                                                        <span className="text-sm text-muted-foreground mt-1">Total Days Off</span>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center rounded-lg border p-4 bg-gray-50/50">
                                                        <span className="text-3xl font-bold">{result.ptoDays.length}</span>
                                                        <span className="text-sm text-muted-foreground mt-1">PTO Days Used</span>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center rounded-lg border p-4 bg-gray-50/50">
                                                         <span className="text-3xl font-bold">
                                                            {/* Avoid division by zero */}
                                                             {result.ptoDays.length > 0 ? (result.totalDays / result.ptoDays.length).toFixed(1) : 'N/A' }
                                                         </span>
                                                         <span className="text-sm text-muted-foreground mt-1">Ratio (Days Off / PTO)</span>
                                                    </div>
                                                </div>

                                                {/* Calendar Section with Ref */}
                                                 <div ref={(el) => setCalendarRef(el, index)}>
                                                     {renderCalendar(result, result.startDate.getMonth(), year)}
                                                     {/* Optionally render next month if range spans across months */}
                                                     {result.startDate.getMonth() !== result.endDate.getMonth() &&
                                                      result.endDate.getFullYear() === year && /* Only if end is in same year */ (
                                                        <div className="mt-4">
                                                          {renderCalendar(result, result.endDate.getMonth(), year)}
                                                        </div>
                                                      )}
                                                 </div>


                                                <div className="space-y-3 pt-4 border-t">
                                                    <h4 className="font-semibold text-base">Breakdown:</h4>
                                                     {result.ptoDays.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            <h5 className="font-medium text-sm">PTO Days ({result.ptoDays.length}):</h5>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {result.ptoDays.map((day, i) => (
                                                                    <div key={`pto-${i}`} className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-800 border border-green-200">
                                                                        {formatDate(day)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                     )}

                                                    {result.holidays.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            <h5 className="font-medium text-sm">Holidays ({result.holidays.length}):</h5>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {result.holidays.map((holiday, i) => (
                                                                    <TooltipProvider key={`hol-${i}`} delayDuration={100}>
                                                                       <Tooltip>
                                                                           <TooltipTrigger asChild>
                                                                               <div className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-800 border border-red-200 cursor-default">
                                                                                    {formatDate(holiday.date)}
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent className="text-xs">
                                                                                {holiday.name}
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {result.weekends.length > 0 && (
                                                         <div className="space-y-1.5">
                                                            <h5 className="font-medium text-sm">Weekends ({result.weekends.length}):</h5>
                                                             <div className="flex flex-wrap gap-1.5">
                                                                 {result.weekends.map((day, i) => (
                                                                    <div key={`wknd-${i}`} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-800 border border-blue-200">
                                                                        {formatDate(day)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                     )}
                                                </div>
                                            </CardContent>
                                            <CardFooter className="flex justify-end gap-2">
                                                <Button variant="outline" onClick={handleShareImage}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Download Image
                                                </Button>
                                                {/* Share button functionality needs implementation */}
                                                {/* <Button disabled>
                                                    <Share2 className="mr-2 h-4 w-4" />
                                                    Share
                                                </Button> */}
                                            </CardFooter>
                                        </Card>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-64 p-8 text-center border rounded-lg bg-card">
                                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">Ready to Plan?</h3>
                                <p className="text-muted-foreground mb-4">
                                    Select your country, year, and available PTO days, then click "Find Longest Holiday" to see your options.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t mt-12 bg-background">
                <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-20 md:flex-row md:py-0">
                    <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                        <Calendar className="h-5 w-5 text-primary hidden md:block" />
                        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                            © {new Date().getFullYear()} SmartHolidayPlanner. Optimize wisely.
                        </p>
                    </div>
                    {/* <div className="flex gap-4">
                        <Link href="/support" className="text-sm font-medium text-muted-foreground hover:text-primary">
                            Support the Developer
                        </Link>
                    </div> */}
                </div>
            </footer>
        </div>
    );
}