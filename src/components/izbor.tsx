/**
 * A native `<select>`, styled to match the shadcn `Input`.
 *
 * Native on purpose. The project is limited to five shadcn primitives and a
 * combobox is not among them, but the better reason is that on a phone the
 * platform picker — the iOS wheel, the Android dialog — is bigger, faster and
 * more familiar than anything that could be built out of divs, and it needs no
 * JavaScript to work. Three of these stacked is the destination cascade.
 *
 * `appearance-none` plus a drawn chevron, because the native arrow renders at
 * wildly different sizes across platforms.
 */
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Izbor({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        // h-11 for the touch target, text-base so iOS does not zoom the page
        // in when the field takes focus.
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-10 pl-3 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
