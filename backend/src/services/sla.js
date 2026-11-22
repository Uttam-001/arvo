import { DateTime } from 'luxon';
import { env } from '../config/env.js';

export const BUSINESS_ZONE = env.businessTimezone;
const DAY_MINUTES = 9 * 60;
const START = { hour: 9, minute: 30, second: 0, millisecond: 0 };
const END = { hour: 18, minute: 30, second: 0, millisecond: 0 };

export const SLA_MINUTES = Object.freeze({
  URGENT: { response: 120, resolution: 'same-day' },
  MEDIUM: { response: 270, resolution: DAY_MINUTES * 3 },
  LOW: { response: DAY_MINUTES, resolution: DAY_MINUTES * 5 }
});

const asZoned = (value) => DateTime.fromJSDate(new Date(value), { zone: 'utc' }).setZone(BUSINESS_ZONE);
const dateKey = (date) => date.toISODate();
const isWeekday = (date) => date.weekday <= 5;
const holidaySet = (holidays = []) => new Set(holidays.map((holiday) => dateKey(asZoned(holiday.holidayDate ?? holiday))));
const isBusinessDay = (date, holidays) => isWeekday(date) && !holidays.has(dateKey(date));
const startOfWork = (date) => date.set(START);
const endOfWork = (date) => date.set(END);

function nextBusinessStart(date, holidays) {
  let cursor = startOfWork(date.plus({ days: 1 }));
  while (!isBusinessDay(cursor, holidays)) cursor = startOfWork(cursor.plus({ days: 1 }));
  return cursor;
}

export function normalizeBusinessStart(value, holidays = []) {
  const holidayDates = holidaySet(holidays);
  let date = asZoned(value);
  while (!isBusinessDay(date, holidayDates)) date = nextBusinessStart(date, holidayDates);
  if (date < startOfWork(date)) return startOfWork(date);
  if (date >= endOfWork(date)) return nextBusinessStart(date, holidayDates);
  return date;
}

export function addBusinessMinutes(value, minutes, holidays = []) {
  if (minutes === 0) return new Date(value);
  const holidayDates = holidaySet(holidays);
  let cursor = normalizeBusinessStart(value, holidays);
  let remaining = minutes;
  while (remaining > 0) {
    const available = endOfWork(cursor).diff(cursor, 'minutes').minutes;
    if (remaining <= available) return cursor.plus({ minutes: remaining }).toUTC().toJSDate();
    remaining -= available;
    cursor = nextBusinessStart(cursor, holidayDates);
  }
  return cursor.toUTC().toJSDate();
}

export function businessMinutesBetween(from, to, holidays = []) {
  const holidayDates = holidaySet(holidays);
  let cursor = asZoned(from);
  const finish = asZoned(to);
  if (finish <= cursor) return 0;
  let total = 0;
  while (cursor.startOf('day') <= finish.startOf('day')) {
    if (isBusinessDay(cursor, holidayDates)) {
      const rangeStart = startOfWork(cursor);
      const rangeEnd = endOfWork(cursor);
      const overlapStart = cursor > rangeStart ? cursor : rangeStart;
      const overlapEnd = finish < rangeEnd ? finish : rangeEnd;
      if (overlapEnd > overlapStart) total += overlapEnd.diff(overlapStart, 'minutes').minutes;
    }
    cursor = cursor.startOf('day').plus({ days: 1 });
  }
  return Math.max(0, Math.round(total));
}

export function getSlaDeadlines(priority, createdAt, holidays = []) {
  const policy = SLA_MINUTES[priority];
  const start = normalizeBusinessStart(createdAt, holidays);
  return {
    firstResponseDueAt: addBusinessMinutes(start, policy.response, holidays),
    resolutionDueAt: policy.resolution === 'same-day'
      ? endOfWork(start).toUTC().toJSDate()
      : addBusinessMinutes(start, policy.resolution, holidays)
  };
}

export function ticketSlaState(ticket, now = new Date()) {
  if (ticket.slaPausedAt) return { paused: true, firstResponseOverdue: false, resolutionOverdue: false };
  return {
    paused: false,
    firstResponseOverdue: !ticket.firstResponseAt && new Date(ticket.slaFirstResponseDueAt) < now,
    resolutionOverdue: !['RESOLVED', 'CLOSED'].includes(ticket.status) && new Date(ticket.slaResolutionDueAt) < now
  };
}

export const workingWeekMinutes = DAY_MINUTES * 5;
