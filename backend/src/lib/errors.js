export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const route = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
export function requiredText(value, field, max = 10000) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(422, `${field} is required.`);
  if (value.length > max) throw new HttpError(422, `${field} must have at most ${max} characters.`);
  return value.trim();
}
export function permitted(value, choices, field) {
  if (!choices.includes(value)) throw new HttpError(422, `Invalid ${field}.`);
  return value;
}
