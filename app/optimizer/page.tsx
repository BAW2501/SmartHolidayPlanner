"use client"

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { Calendar, ChevronLeft, ChevronRight, Download, Info, ListChecks } from "lucide-react";
import Holidays from "date-holidays";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- Configuration ---
const MIN_DESIRED_VACATION_LENGTH = 4; // Vacations shorter than this are de-prioritized in DP

// --- Helper Functions ---
const isSameDay = (date1: Date, date2: Date): boolean => {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const formatDate = (date: Date | null | undefined): string => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
};

// --- Define Types ---
interface Holiday {
    date: Date;
    name: string;
    type: string;
}

interface CountryOption {
    code: string;
    name: string;
}

interface VacationCandidate {
    id: number;
    startDate: Date;
    endDate: Date;
    totalDays: number;
    ptoUsed: number;
    holidays: Holiday[];
    weekends: Date[];
    nonOverlappingIndex: number;
}

interface DpResult {
    maxTotalDays: number; // Stores the potentially adjusted value used for maximization
    chosenVacationIds: number[];
}

interface MultiOptimizationResult {
    chosenVacations: VacationCandidate[];
    totalDaysOff: number; // Stores the ACTUAL total days off
    totalPtoUsed: number;
}

// --- Candidate Generation (Same as before) ---
function generateVacationCandidates(
    allHolidaysOfYear: Holiday[],
    allWeekendsOfYear: Date[],
    maxPtoPerCandidate: number,
    year: number
): VacationCandidate[] {
    const candidates: Omit<VacationCandidate, 'nonOverlappingIndex' | 'id'>[] = [];
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const nonWorkDaySet = new Set<string>();
    const holidayMap = new Map<string, Holiday>();
    allHolidaysOfYear.forEach(h => { const d = h.date.toDateString(); nonWorkDaySet.add(d); holidayMap.set(d, h); });
    allWeekendsOfYear.forEach(w => nonWorkDaySet.add(w.toDateString()));

    for (let d = new Date(yearStart); d <= yearEnd; d = addDays(d, 1)) {
        let ptoUsed = 0;
        let currentSequence: Date[] = [];
        for (let currentDay = new Date(d); currentDay <= yearEnd; currentDay = addDays(currentDay, 1)) {
            const isNonWorkDay = nonWorkDaySet.has(currentDay.toDateString());
            if (isNonWorkDay) {
                currentSequence.push(new Date(currentDay));
            } else {
                if (ptoUsed < maxPtoPerCandidate) {
                    ptoUsed++;
                    currentSequence.push(new Date(currentDay));
                } else { break; }
            }

            if (currentSequence.length > 0 && ptoUsed > 0) {
                const startDate = currentSequence[0];
                const endDate = currentSequence[currentSequence.length - 1];
                const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                let actualPtoInSequence = 0;
                const holidaysInSequence: Holiday[] = [];
                const weekendsInSequence: Date[] = [];
                for (let dayInSeq = new Date(startDate); dayInSeq <= endDate; dayInSeq = addDays(dayInSeq, 1)) {
                    const dayStr = dayInSeq.toDateString();
                    const dayOfWeek = dayInSeq.getDay();
                    const isActualWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const holidayDetails = holidayMap.get(dayStr);
                    if (!holidayDetails && !isActualWeekend) actualPtoInSequence++;
                    if (holidayDetails) holidaysInSequence.push(holidayDetails);
                    if (isActualWeekend) weekendsInSequence.push(new Date(dayInSeq));
                }
                if (actualPtoInSequence === ptoUsed) {
                    candidates.push({ startDate, endDate, totalDays, ptoUsed, holidays: holidaysInSequence, weekends: weekendsInSequence });
                }
            }
        }
    }

    const uniqueCandidatesMap = new Map<string, Omit<VacationCandidate, 'nonOverlappingIndex' | 'id'>>();
    candidates.forEach(c => {
        const key = `${c.startDate.toDateString()}-${c.endDate.toDateString()}`;
        const existing = uniqueCandidatesMap.get(key);
        if (!existing || c.totalDays > existing.totalDays || (c.totalDays === existing.totalDays && c.ptoUsed < existing.ptoUsed)) {
            uniqueCandidatesMap.set(key, c);
        }
    });

    let idCounter = 0;
    const sortedCandidatesWithId = Array.from(uniqueCandidatesMap.values())
        .map(c => ({ ...c, id: idCounter++ }))
        .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

    const finalCandidates: VacationCandidate[] = sortedCandidatesWithId.map((candidate, i, arr) => {
        let latestNonOverlapping = -1;
        for (let j = i - 1; j >= 0; j--) {
            if (arr[j].endDate.getTime() < candidate.startDate.getTime()) { latestNonOverlapping = j; break; }
        }
        return { ...candidate, nonOverlappingIndex: latestNonOverlapping };
    });

    return finalCandidates;
}


// --- Modified Dynamic Programming Solution (De-prioritizes short vacations) ---
function findOptimalVacationSet(
    candidates: VacationCandidate[],
    totalPtoBudget: number
): MultiOptimizationResult {
    const n = candidates.length;
    if (n === 0 || totalPtoBudget < 0) {
        return { chosenVacations: [], totalDaysOff: 0, totalPtoUsed: 0 };
    }

    // dp[i][p] = { maxTotalDays (adjusted), chosenVacationIds }
    const dp: DpResult[][] = Array(n + 1).fill(null).map(() =>
        Array(totalPtoBudget + 1).fill({ maxTotalDays: 0, chosenVacationIds: [] })
    );

    for (let i = 1; i <= n; i++) {
        const currentVacation = candidates[i - 1];
        const ptoCost = currentVacation.ptoUsed;
        const originalDaysValue = currentVacation.totalDays;
        // *** De-prioritization Logic ***
        const adjustedDaysValue = originalDaysValue >= MIN_DESIRED_VACATION_LENGTH
            ? originalDaysValue // Use full value if long enough
            : 0; // Assign 0 value if too short for DP maximization
        // *** End De-prioritization Logic ***

        const nonOverlappingArrIdx = currentVacation.nonOverlappingIndex;
        const dpNonOverlappingRowIdx = nonOverlappingArrIdx + 1;

        for (let p = 0; p <= totalPtoBudget; p++) {
            const option1 = dp[i - 1][p]; // Exclude current
            let option2: DpResult = { maxTotalDays: -1, chosenVacationIds: [] }; // Include current

            if (p >= ptoCost) {
                const remainingBudget = p - ptoCost;
                const prevValue = (dpNonOverlappingRowIdx >= 0 && dpNonOverlappingRowIdx < dp.length)
                    ? dp[dpNonOverlappingRowIdx][remainingBudget]
                    : { maxTotalDays: 0, chosenVacationIds: [] };
                option2 = {
                    maxTotalDays: adjustedDaysValue + prevValue.maxTotalDays, // Use ADJUSTED value
                    chosenVacationIds: [...prevValue.chosenVacationIds, currentVacation.id]
                };
            }

            dp[i][p] = (option1.maxTotalDays >= option2.maxTotalDays) ? option1 : option2;
        }
    }

    // Find best result in last row based on the (adjusted) maxTotalDays tracked by DP
    let bestDpResult: DpResult = { maxTotalDays: 0, chosenVacationIds: [] };
    for (let p = 0; p <= totalPtoBudget; p++) {
        if (dp[n][p].maxTotalDays > bestDpResult.maxTotalDays) {
            bestDpResult = dp[n][p];
        }
    }

    // Reconstruct the result using ACTUAL values
    const chosenVacationMap = new Map<number, VacationCandidate>();
    candidates.forEach(c => chosenVacationMap.set(c.id, c));

    let finalActualTotalDaysOff = 0;
    let finalPtoUsed = 0;
    const finalChosenVacations: VacationCandidate[] = [];

    bestDpResult.chosenVacationIds.forEach(id => {
        const vacation = chosenVacationMap.get(id);
        if (vacation) {
            finalChosenVacations.push(vacation);
            finalPtoUsed += vacation.ptoUsed;
            finalActualTotalDaysOff += vacation.totalDays; // Sum ACTUAL days
        }
    });

    finalChosenVacations.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    return {
        chosenVacations: finalChosenVacations,
        totalDaysOff: finalActualTotalDaysOff, // Report ACTUAL total days
        totalPtoUsed: finalPtoUsed
    };
}


// --- React Component ---
export default function OptimizerPage() {
    // State Variables
    const [countries, setCountries] = useState<CountryOption[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [ptoDaysCount, setPtoDaysCount] = useState<number>(10);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [multiResult, setMultiResult] = useState<MultiOptimizationResult | null>(null);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
    const calendarRef = useRef<HTMLDivElement | null>(null);

    // Initialize countries list
    useEffect(() => {
        const hd = new Holidays();
        const countryCodes = hd.getCountries();
        const countryOptions: CountryOption[] = [];
        for (const code in countryCodes) { if (code.length === 2) countryOptions.push({ code, name: countryCodes[code] }); }
        setCountries(countryOptions.sort((a, b) => a.name.localeCompare(b.name)));
        const defaultCountries = ["US", "GB", "CA", "AU", "DE"];
        let foundDefault = false;
        for (const code of defaultCountries) { if (countryOptions.some(c => c.code === code)) { setSelectedCountry(code); foundDefault = true; break; } }
        if (!foundDefault && countryOptions.length > 0) setSelectedCountry(countryOptions[0].code);
    }, []);

    // Calculation Function
    const calculateOptimalPTO = () => {
        if (!selectedCountry || ptoDaysCount < 0) return;
        setIsCalculating(true);
        setMultiResult(null);
        setTimeout(() => {
            try {
                console.time("Calculation");
                const hd = new Holidays(); hd.init(selectedCountry);
                const rawHolidays = hd.getHolidays(year);
                const publicHolidays: Holiday[] = rawHolidays.filter(h => h.type === "public").map(h => ({ date: new Date(h.date), name: h.name, type: h.type })).sort((a, b) => a.date.getTime() - b.date.getTime());
                const weekends: Date[] = [];
                const s = new Date(year, 0, 1); const e = new Date(year, 11, 31);
                for (let d = s; d <= e; d = addDays(d, 1)) { const day = d.getDay(); if (day === 0 || day === 6) weekends.push(new Date(d)); }

                console.time("Candidate Generation");
                const MAX_PTO_PER_CANDIDATE = Math.min(10, ptoDaysCount > 0 ? ptoDaysCount : 5);
                const candidates = generateVacationCandidates(publicHolidays, weekends, MAX_PTO_PER_CANDIDATE, year);
                console.timeEnd("Candidate Generation");
                console.log(`Generated ${candidates.length} candidates.`);

                console.time("DP Optimization");
                // *** Use the modified DP function ***
                const optimalSetResult = findOptimalVacationSet(candidates, ptoDaysCount);
                console.timeEnd("DP Optimization");
                console.log("Optimal Set Result:", optimalSetResult);

                setMultiResult(optimalSetResult);
                if (optimalSetResult.chosenVacations.length > 0) setCurrentMonth(optimalSetResult.chosenVacations[0].startDate.getMonth());
                else setCurrentMonth(new Date().getMonth());

            } catch (error) { console.error("Error calculating optimal PTO:", error); setMultiResult(null); }
            finally { setIsCalculating(false); console.timeEnd("Calculation"); }
        }, 50);
    };

    // Image Download Function
    const handleShareImage = async () => {
        const resultsElement = document.getElementById('results-area');
        if (!resultsElement) return;
        try {
            const dataUrl = await toPng(resultsElement, { backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement("a"); link.download = `multi-holiday-plan-${year}.png`; link.href = dataUrl;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch (error) { console.error("Error generating image:", error); }
    };

    // Calendar Rendering Function (no changes needed here)
    const renderCalendar = (month: number, year: number, result: MultiOptimizationResult | null) => {
        // ... (Keep the exact same renderCalendar function from the previous version) ...
        // ... It correctly uses the 'result' data to highlight days ...
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonthDate = new Date(year, month, 1);
        const firstDayOfMonthWeekday = firstDayOfMonthDate.getDay();

        const days: Date[] = [];
        for (let i = 1; i <= daysInMonth; i++) { days.push(new Date(year, month, i)); }
        const emptyCells = Array(firstDayOfMonthWeekday).fill(null);

        const ptoDaysInMonth = new Set<string>(); const holidayDaysInMonth = new Set<string>();
        const holidayNamesMap = new Map<string, string>(); const weekendDaysInMonth = new Set<string>();
        const inRangeDaysInMonth = new Set<string>();

        result?.chosenVacations.forEach(vac => {
            for (let d = new Date(vac.startDate); d <= vac.endDate; d = addDays(d, 1)) {
                if (d.getMonth() === month && d.getFullYear() === year) {
                    const dayStr = d.toDateString(); inRangeDaysInMonth.add(dayStr);
                    const isActualWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const holidayInfo = vac.holidays.find(h => isSameDay(h.date, d));
                    if (!holidayInfo && !isActualWeekend) ptoDaysInMonth.add(dayStr);
                    else if (holidayInfo) { holidayDaysInMonth.add(dayStr); holidayNamesMap.set(dayStr, holidayInfo.name); }
                    else if (isActualWeekend) weekendDaysInMonth.add(dayStr);
                }
            }
        });

        return (
            <div className="mt-4 border rounded-lg p-4 bg-card shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-lg">{firstDayOfMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
                    <div className="flex gap-1">
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => (prev - 1 + 12) % 12)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => (prev + 1) % 12)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-px text-center text-xs">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="pb-1 font-medium text-muted-foreground">{day}</div>)}
                    {emptyCells.map((_, index) => <div key={`empty-${index}`} className="h-16" />)}
                    {days.map((day) => {
                        const dayStr = day.toDateString(); const isSystemWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isPTO = ptoDaysInMonth.has(dayStr); const isHoliday = holidayDaysInMonth.has(dayStr);
                        const isMarkedWeekend = weekendDaysInMonth.has(dayStr); const isInRange = inRangeDaysInMonth.has(dayStr);
                        let bgColor = "bg-white"; let textColor = "text-gray-700"; let fontWeight = "font-normal";
                        if (isPTO) { bgColor = "bg-green-100 hover:bg-green-200"; textColor = "text-green-800"; }
                        else if (isHoliday) { bgColor = "bg-red-100 hover:bg-red-200"; textColor = "text-red-800"; }
                        else if (isMarkedWeekend) { bgColor = "bg-blue-100 hover:bg-blue-200"; textColor = "text-blue-800"; }
                        else if (isSystemWeekend) { bgColor = "bg-gray-50"; textColor = "text-gray-400"; }
                        else if (isInRange) { bgColor = "bg-yellow-50"; textColor = "text-yellow-800"; } // Should be rare
                        else { textColor = "text-gray-400"; }
                        const isToday = isSameDay(day, new Date()); if (isToday) { fontWeight = "font-bold"; textColor = "text-primary"; }
                        const holidayName = holidayNamesMap.get(dayStr);
                        return (
                            <TooltipProvider key={dayStr} delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                                <div className={`relative h-16 p-1 ${bgColor} transition-colors duration-150 flex flex-col items-center justify-start border border-gray-100 rounded-sm`}>
                                    <span className={`text-sm ${fontWeight} ${textColor} mb-0.5`}>{day.getDate()}</span>
                                    {isHoliday && !isPTO && holidayName && (<span className="text-[9px] leading-tight text-red-700 font-medium truncate max-w-full px-0.5 text-center block" title={holidayName}>{holidayName.length > 10 ? `${holidayName.substring(0, 8)}...` : holidayName}</span>)}
                                    {isPTO && (<span className="text-[10px] leading-tight text-green-700 font-bold px-0.5 text-center block">PTO</span>)}
                                </div>
                            </TooltipTrigger> <TooltipContent className="text-xs max-w-xs">
                                    <p className="font-semibold">{formatDate(day)}</p>
                                    {isHoliday && holidayName && <p>Holiday: {holidayName}</p>} {isPTO && <p>PTO Day</p>}
                                    {isMarkedWeekend && <p>Weekend (During Vacation)</p>} {isSystemWeekend && !isMarkedWeekend && <p>Weekend</p>}
                                    {!isSystemWeekend && !isHoliday && !isPTO && <p>Work Day</p>}
                                </TooltipContent> </Tooltip> </TooltipProvider>);
                    })}
                </div>
                <div className="flex gap-3 sm:gap-4 mt-4 justify-center flex-wrap border-t pt-3">
                    <div className="flex items-center gap-1.5"> <div className="h-3 w-3 rounded-full bg-blue-100 border border-blue-200"></div> <span className="text-xs text-muted-foreground">Weekend (in plan)</span> </div>
                    <div className="flex items-center gap-1.5"> <div className="h-3 w-3 rounded-full bg-red-100 border border-red-200"></div> <span className="text-xs text-muted-foreground">Holiday (in plan)</span> </div>
                    <div className="flex items-center gap-1.5"> <div className="h-3 w-3 rounded-full bg-green-100 border border-green-200"></div> <span className="text-xs text-muted-foreground">PTO Used</span> </div>
                    <div className="flex items-center gap-1.5"> <div className="h-3 w-3 rounded-full bg-gray-50 border border-gray-200"></div> <span className="text-xs text-muted-foreground">Weekend (outside plan)</span> </div>
                </div>
            </div>);
    };

    // Main Component Return (JSX Structure remains largely the same)
    return (
        <div className="flex min-h-screen flex-col bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-lg"> <Calendar className="h-5 w-5 text-primary" /> <span>SmartHolidayPlanner</span> </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container py-8 md:py-12">
                <h1 className="text-3xl font-bold mb-2 text-center md:text-left">Multi-Vacation Optimizer</h1>
                <p className="text-center md:text-left text-muted-foreground mb-8">Maximize your total time off (preferring breaks of {MIN_DESIRED_VACATION_LENGTH}+ days) within your PTO budget.</p>

                <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
                    {/* Input Section */}
                    <div className="lg:col-span-1">
                        <Card className="sticky top-20 shadow-md">
                            <CardHeader><CardTitle>Plan Your Year</CardTitle><CardDescription>Set details to find the optimal vacation combination.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Select value={selectedCountry} onValueChange={setSelectedCountry} required> <SelectTrigger id="country"><SelectValue placeholder="Select a country" /></SelectTrigger> <SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}</SelectContent> </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"> <Label htmlFor="year">Year</Label> <Select value={year.toString()} onValueChange={(v) => setYear(Number.parseInt(v))}> <SelectTrigger id="year"><SelectValue /></SelectTrigger> <SelectContent>{[new Date().getFullYear(), new Date().getFullYear() + 1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent> </Select> </div>
                                    <div className="space-y-2"> <Label htmlFor="pto-days">PTO Budget</Label> <Input id="pto-days" type="number" min="0" max="100" value={ptoDaysCount} onChange={(e) => setPtoDaysCount(Math.max(0, Number.parseInt(e.target.value) || 0))} required /> </div>
                                </div>
                            </CardContent>
                            <CardFooter> <Button onClick={calculateOptimalPTO} disabled={!selectedCountry || ptoDaysCount < 0 || isCalculating} className="w-full" size="lg">{isCalculating ? "Optimizing..." : "Optimize My Year"}</Button> </CardFooter>
                        </Card>
                    </div>

                    {/* Results Section */}
                    <div className="lg:col-span-2">
                        {isCalculating ? ( /* Loading State */
                            <div className="flex flex-col items-center justify-center h-64 p-8 text-center border rounded-lg bg-card shadow-sm"> <Calendar className="h-12 w-12 text-primary animate-spin mb-4" /> <h3 className="text-lg font-medium mb-2">Calculating Optimal Plan...</h3> <p className="text-muted-foreground">Finding the best combination of longer breaks...</p> </div>
                        ) : multiResult ? ( /* Results Display */
                            <div id="results-area" className="space-y-6">
                                {/* Summary Card */}
                                <Card className="shadow-md">
                                    <CardHeader><CardTitle className="text-xl">Optimal Vacation Plan Summary</CardTitle></CardHeader>
                                    <CardContent className="grid gap-4 sm:grid-cols-3 text-center">
                                        <div className="flex flex-col items-center justify-center rounded-lg border p-4 bg-gray-50/50"> <span className="text-3xl font-bold text-primary">{multiResult.totalDaysOff}</span> <span className="text-sm text-muted-foreground mt-1">Total Days Off</span> </div>
                                        <div className="flex flex-col items-center justify-center rounded-lg border p-4 bg-gray-50/50"> <span className="text-3xl font-bold">{multiResult.totalPtoUsed} / {ptoDaysCount}</span> <span className="text-sm text-muted-foreground mt-1">PTO Days Used</span> </div>
                                        <div className="flex flex-col items-center justify-center rounded-lg border p-4 bg-gray-50/50"> <span className="text-3xl font-bold">{multiResult.totalPtoUsed > 0 ? (multiResult.totalDaysOff / multiResult.totalPtoUsed).toFixed(1) : 'N/A'}</span> <span className="text-sm text-muted-foreground mt-1">Overall Ratio</span> </div>
                                    </CardContent>
                                    {multiResult.chosenVacations.some(v => v.totalDays < MIN_DESIRED_VACATION_LENGTH) && (
                                        <CardFooter><Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800"><Info className="h-4 w-4 text-amber-700" /><AlertDescription className="text-xs">Note: Includes some shorter breaks ({'<'} {MIN_DESIRED_VACATION_LENGTH} days) as they were necessary to maximize the overall time off within the budget.</AlertDescription></Alert></CardFooter>
                                    )}
                                </Card>
                                {/* Chosen Vacations List */}
                                {multiResult.chosenVacations.length > 0 ? (
                                    <Card className="shadow-md">
                                        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Chosen Vacations</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            {multiResult.chosenVacations.map((vac, index) => (
                                                <div key={vac.id} className="p-4 border rounded-lg bg-blue-50/30">
                                                    <p className="font-semibold text-base mb-1">Vacation #{index + 1}: {vac.totalDays} days off {vac.totalDays < MIN_DESIRED_VACATION_LENGTH ? <span className="text-xs text-amber-700">(Short)</span> : ''}</p>
                                                    <p className="text-sm text-muted-foreground mb-2">{formatDate(vac.startDate)} - {formatDate(vac.endDate)} <span className="ml-2 pl-2 border-l">({vac.ptoUsed} PTO day{vac.ptoUsed !== 1 ? 's' : ''})</span></p>
                                                    <div className="flex flex-wrap gap-1 text-xs mt-1">
                                                        {vac.holidays.map(h => <TooltipProvider key={h.name}><Tooltip><TooltipTrigger asChild><span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200 cursor-default">{formatDate(h.date)}</span></TooltipTrigger><TooltipContent>{h.name}</TooltipContent></Tooltip></TooltipProvider>)}
                                                        {/* Only show 'Weekend' marker if needed, PTO/Holiday takes precedence */}
                                                        {/* {vac.weekends.filter(w => !vac.holidays.some(h => isSameDay(h.date, w))).map((w, wi) => <span key={`w-${wi}`} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200">Weekend</span>)} */}
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ) : ( /* No Vacations Found Alert */
                                    <Alert><Info className="h-4 w-4" /><AlertTitle>No Vacations Found</AlertTitle><AlertDescription>Could not find any vacation periods using the provided PTO budget, especially prioritizing longer breaks. Try increasing the budget or checking holiday data.</AlertDescription></Alert>
                                )}
                                {/* Calendar View */}
                                <Card className="shadow-md">
                                    <CardHeader><CardTitle>Year Calendar View</CardTitle><CardDescription>Navigate months to see your plan.</CardDescription></CardHeader>
                                    <CardContent ref={calendarRef}>{renderCalendar(currentMonth, year, multiResult)}</CardContent>
                                    <CardFooter className="flex justify-end"><Button variant="outline" onClick={handleShareImage}><Download className="mr-2 h-4 w-4" /> Download Calendar Image</Button></CardFooter>
                                </Card>
                            </div>
                        ) : ( /* Initial State */
                            <div className="flex flex-col items-center justify-center h-64 p-8 text-center border rounded-lg bg-card shadow-sm"> <Calendar className="h-12 w-12 text-muted-foreground mb-4" /> <h3 className="text-lg font-medium mb-2">Ready to Optimize Your Year?</h3> <p className="text-muted-foreground mb-4">Fill in your details and click "Optimize My Year".</p> </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t mt-12 bg-background">
                <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-20 md:flex-row md:py-0">
                    <div className="flex items-center gap-2"> <Calendar className="h-5 w-5 text-primary hidden md:block" /> <p className="text-center text-sm text-muted-foreground md:text-left">© {new Date().getFullYear()} SmartHolidayPlanner</p> </div>
                </div>
            </footer>
        </div>
    );
}