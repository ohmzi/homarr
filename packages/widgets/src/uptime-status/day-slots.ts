/**
 * Builds the day segments a monitor's bar is divided into.
 *
 * The bar spans only the days that actually have history, so a fresh install is a single
 * full-width segment rather than a long run of empty ones, and it grows by a segment a day
 * until it reaches the configured maximum. The window is shared across monitors so the bars
 * stay aligned as one timeline - otherwise each row's segments would represent a different
 * span of time and the rows could not be compared.
 */
export const buildDaySlots = (input: { dates: string[]; visibleDays: number; today: Date }) => {
  const { dates, visibleDays, today } = input;

  // `YYYY-MM-DD` sorts chronologically as a plain string, so no date parsing is needed.
  // With no history at all the bar still needs one segment, so it falls back to today
  // rather than rendering the full maximum of empty slots.
  const oldest = dates.toSorted()[0] ?? toDateKey(today);

  const keys: string[] = [];

  for (let offset = 0; offset < visibleDays; offset++) {
    const key = toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset));
    keys.unshift(key);

    // Reached the oldest day we hold, so the rest of the window would be filler.
    if (key <= oldest) break;
  }

  return keys;
};

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
