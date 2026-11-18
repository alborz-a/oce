/** Small pill showing a colleague's job title next to their name. Renders nothing when the title is empty. */
export function JobTitleBadge({ title }: { title?: string | null }) {
  const text = title?.trim();
  if (!text) return null;
  return (
    <span
      data-testid="job-title-badge"
      style={{
        fontSize: 11,
        lineHeight: '16px',
        padding: '0 8px',
        borderRadius: 8,
        background: '#e8f4f8',
        color: '#5a8bb0',
        marginInlineStart: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}
