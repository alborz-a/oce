/** Project creation is open to global admin and manager only. Staff (editor, viewer) cannot create projects. */
export function canCreateProject(role: string | null | undefined): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'admin' || r === 'manager';
}
