/** Carza is 13+. Teens (13-17) get different rules from adults (see the age_and_teen_rules migration). */
export const MIN_AGE = 13;
export const ADULT_AGE = 18;

export type AgeGroup = 'teen' | 'adult';

/** `YYYY-MM-DD` for a real calendar day, or null. */
export function parseBirthDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/** Whole years between a `YYYY-MM-DD` date of birth and `now` (UTC days, like the database). */
export function ageOn(birthDate: string, now = new Date()): number | null {
  const born = parseBirthDate(birthDate);
  if (!born) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function ageGroup(age: number): AgeGroup {
  return age < ADULT_AGE ? 'teen' : 'adult';
}
