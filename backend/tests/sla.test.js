import test from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessMinutes, businessMinutesBetween, getSlaDeadlines, workingWeekMinutes } from '../src/services/sla.js';
import { assertCanReopen, assertActive, canReopen } from '../src/services/ticketPolicies.js';

const utc = (s) => new Date(s);
const iso = (d) => d.toISOString();

test('urgent ticket at 6 PM Friday gets response Monday 11 AM (India business time)', () => {
  const friday = utc('2026-11-27T12:30:00Z'); // Fri 18:00 IST
  const due = getSlaDeadlines('URGENT', friday);
  assert.equal(iso(due.firstResponseDueAt), '2026-11-30T05:30:00.000Z');
  assert.equal(iso(due.resolutionDueAt), '2026-11-27T13:00:00.000Z');
});

test('Saturday ticket starts Monday, not the weekend', () => {
  const saturday = utc('2026-11-28T06:00:00Z');
  const due = getSlaDeadlines('URGENT', saturday);
  assert.equal(iso(due.firstResponseDueAt), '2026-11-30T06:00:00.000Z');
  assert.equal(iso(due.resolutionDueAt), '2026-11-30T13:00:00.000Z');
});

test('a zero-minute pause preserves a deadline at closing time', () => {
  const closingTime = utc('2026-11-27T13:00:00Z');
  assert.equal(iso(addBusinessMinutes(closingTime, 0)), iso(closingTime));
});

test('a deadline with seconds carries the exact balance into the next day', () => {
  assert.equal(iso(addBusinessMinutes(utc('2026-11-27T12:59:45Z'), 1)), '2026-11-30T04:00:45.000Z');
});

test('holiday calendar skips configured holidays', () => {
  const monday = utc('2026-11-30T12:30:00Z'); // Mon 18:00 IST
  const holidays = [{ holidayDate: utc('2026-12-01T00:00:00Z') }];
  const due = getSlaDeadlines('LOW', monday, holidays);
  assert.equal(iso(due.firstResponseDueAt), '2026-12-02T12:30:00.000Z');
  assert.equal(iso(addBusinessMinutes(monday, workingWeekMinutes, holidays)), '2026-12-08T12:30:00.000Z');
});

test('business pause counts only working hours', () => {
  assert.equal(businessMinutesBetween(utc('2026-11-27T12:30:00Z'), utc('2026-11-30T05:00:00Z')), 90);
  assert.equal(businessMinutesBetween(utc('2026-11-28T06:00:00Z'), utc('2026-11-29T06:00:00Z')), 0);
});

test('reopen permits only resolved tickets before one-working-week deadline', () => {
  const now = utc('2026-11-30T04:00:00Z');
  const valid = { status: 'RESOLVED', reopenUntil: utc('2026-12-01T12:00:00Z') };
  assert.equal(canReopen(valid, now), true);
  assert.doesNotThrow(() => assertCanReopen(valid, now));
  assert.throws(() => assertCanReopen({ ...valid, status: 'CLOSED' }, now));
  assert.throws(() => assertCanReopen({ ...valid, reopenUntil: utc('2026-11-29T05:00:00Z') }, now));
  assert.throws(() => assertActive({ status: 'RESOLVED' }));
  assert.throws(() => assertActive({ status: 'CLOSED' }));
});
