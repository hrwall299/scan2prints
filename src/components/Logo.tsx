import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect x="2" y="12" width="36" height="18" rx="6" className="fill-primary" />
      <path d="M11 4h13l5 5v9H11z" className="fill-paper stroke-primary" strokeWidth="1.6" />
      <path d="M24 4v5h5" className="fill-none stroke-primary" strokeWidth="1.6" />
      <rect x="10" y="24" width="20" height="13" rx="2" className="fill-paper stroke-primary" strokeWidth="1.6" />
      <rect x="13" y="28" width="11" height="2" rx="1" className="fill-accent" />
      <rect x="13" y="32" width="7" height="2" rx="1" className="fill-primary/40" />
      <circle cx="32" cy="18" r="2" className="fill-accent" />
    </svg>
  );
}

export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="PRINTORA home">
      <LogoMark />
      <span className={cn("font-display text-xl font-bold tracking-tight", light ? "text-primary-foreground" : "text-ink")}>
        PRINT<span className="text-accent">ORA</span>
      </span>
    </Link>
  );
}
