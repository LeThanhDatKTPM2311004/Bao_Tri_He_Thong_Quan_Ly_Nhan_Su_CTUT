export function formatDate(date: string | Date, locale = 'vi-VN'): string {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(date: string | Date, locale = 'vi-VN'): string {
  return new Date(date).toLocaleString(locale);
}
