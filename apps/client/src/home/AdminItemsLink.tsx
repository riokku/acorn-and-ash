/** Server-derived capability controls visibility; the admin Worker checks access on every request. */
export function AdminItemsLink({
  allowed = false,
  compact = false,
}: {
  allowed?: boolean;
  compact?: boolean;
}): React.JSX.Element | null {
  return allowed ? (
    <a className={compact ? 'character-admin-link' : 'home-admin-link'} href="/admin">
      Manage items
    </a>
  ) : null;
}
