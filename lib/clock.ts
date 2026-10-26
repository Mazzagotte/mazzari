export const safeTime = (date: Date, zone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, ...options }).format(date);
