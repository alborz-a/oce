/** Gantt tab is visible only to global admin or manager. Project roles do not grant it. */
export function canSeeGantt(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager';
}
