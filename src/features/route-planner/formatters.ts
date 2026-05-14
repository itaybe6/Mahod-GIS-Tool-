/** GTFS `route_type` → תווית עברית קצרה. */
export function routeTypeHebrew(routeType: number | null): string {
  switch (routeType) {
    case 0:
      return 'רכבת קלה';
    case 1:
      return 'מטרו';
    case 2:
      return 'רכבת';
    case 3:
      return 'אוטובוס';
    case 4:
      return 'מעבורת';
    case 5:
      return 'כבלית';
    case 6:
      return 'רכבל';
    case 7:
      return 'מעלית';
    case 11:
      return 'טרוליבוס';
    case 12:
      return 'מונורייל';
    default:
      return 'תח"צ';
  }
}

/** מטרים → מחרוזת קצרה ("760 מ׳" / "2.3 ק״מ"). */
export function formatMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} מ׳`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} ק״מ`;
}

/** הערכת זמן הליכה (מ׳ ב-1.4 מ׳/שנייה). */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 1.4 / 60));
}

/** הערכת זמן נסיעה (מ׳ במהירות 22 קמ"ש לאוטובוס עירוני). */
export function transitMinutes(meters: number, routeType: number | null): number {
  const kmh = routeType === 2 || routeType === 0 || routeType === 1 ? 50 : 22;
  const seconds = (meters / 1000) * (3600 / kmh);
  return Math.max(1, Math.round(seconds / 60));
}

export function formatDirection(directionId: number): string {
  return directionId === 0 ? 'הלוך' : directionId === 1 ? 'חזור' : `כיוון ${directionId}`;
}
