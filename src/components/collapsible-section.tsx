/**
 * A page section whose title toggles it open/closed (native <details>, so no client JS).
 * `actions` sit on the right of the title row; links there navigate without toggling.
 * `className` styles the content below the title (e.g. its spacing).
 */
export function CollapsibleSection({
  title,
  actions,
  id,
  className = "",
  children,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open id={id} className="group/section scroll-mt-6">
      <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-open/section:rotate-90"
          fill="currentColor"
        >
          <path d="M7 5l6 5-6 5z" />
        </svg>
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions && <span className="ml-auto text-sm font-normal">{actions}</span>}
      </summary>
      <div className={className}>{children}</div>
    </details>
  );
}
