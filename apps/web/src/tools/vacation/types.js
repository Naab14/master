/**
 * @typedef {{ id: string, name: string, shift: 'S1' | 'S2', active: boolean, certifications: string[] }} Operator
 * @typedef {{ id: string, operatorId: string, startWeek: number, endWeek: number, status: 'draft' | 'pending' | 'approved' | 'requested', dayStatuses?: { [dateStr: string]: 'draft' | 'pending' | 'approved' | 'requested' }, note?: string }} VacationBlock
 * @typedef {{ [process: string]: { [week: number]: number } }} Demand
 * @typedef {{ shiftMode: 'separate' | 'combined' | 'summer', visibleWeeks: number, startWeek: number }} Settings
 * @typedef {{ operators: Operator[], vacationBlocks: VacationBlock[], demand: Demand, settings: Settings }} AppState
 * @typedef {{ covered: number, required: number, operatorsIn: Operator[], operatorsOut: Operator[], isHoliday: boolean, level: 'green' | 'yellow' | 'red' }} CoverageResult
 * @typedef {{ holidays: { name: string, dateStr: string, year?: number }[] }} HolidayWeekEntry
 * @typedef {{ [week: number]: HolidayWeekEntry }} HolidayMap
 */

export {};
