interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-5 sm:mb-6 border-b border-[var(--app-border)] pb-3 sm:pb-4 min-w-0">
      <h1 className="m-0 text-lg sm:text-xl font-semibold tracking-tight text-[var(--app-text)] app-break-words">
        {title}
      </h1>
      {subtitle && (
        <p className="m-0 mt-1 text-xs sm:text-sm text-[var(--app-text-muted)] font-medium app-break-words">
          {subtitle}
        </p>
      )}
    </div>
  );
}
