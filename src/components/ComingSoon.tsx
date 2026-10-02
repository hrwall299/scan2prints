import { Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "./SiteHeader";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-muted-foreground">This page is not built yet.</p>
        <Link to="/" className="mt-6 inline-block font-semibold text-primary">Back home</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
