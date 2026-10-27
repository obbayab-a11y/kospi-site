import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("mt-12 flex flex-col gap-4 scroll-mt-20", className)} id={id}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h2>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("bg-card rounded-xl border p-4 sm:p-6", className)} {...props} />;
}
