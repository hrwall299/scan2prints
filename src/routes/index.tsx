import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, CheckCircle2, ClipboardList, FileText, ImageIcon, LayoutGrid,
  Printer, QrCode, ScanLine, ShieldCheck, SlidersHorizontal, Trash2, Upload, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import hero from "@/assets/hero-printora.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRINTORA — QR self-service printing for print shops" },
      { name: "description", content: "Customers scan your shop QR, upload documents or photos, choose print settings and track orders. You approve and print from one dashboard." },
      { property: "og:title", content: "PRINTORA — QR self-service printing for print shops" },
      { property: "og:description", content: "Scan, upload, configure and track print orders. Built for Xerox centres and cyber cafes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: Printer, title: "Printer management", text: "Configure a dedicated B&W and colour printer. Jobs route automatically by the customer's colour choice." },
  { icon: ClipboardList, title: "Print order management", text: "Orders arrive live with file names, pages, copies, layout and price — approve or reject in one tap." },
  { icon: FileText, title: "Document printing", text: "PDF, DOC and DOCX with copies, page size, paper type, sides and per-page pricing." },
  { icon: ImageIcon, title: "Image printing", text: "Photo editor with image pool, 1/2/4 and custom grid layouts, fit, fill, zoom, rotate and crop." },
  { icon: SlidersHorizontal, title: "Print controls & live preview", text: "An A4 canvas that updates instantly as layouts, images and colour mode change." },
  { icon: BarChart3, title: "Monthly usage", text: "Totals for orders, pages, B&W and colour pages with simple monthly charts." },
  { icon: Trash2, title: "Automatic cleanup", text: "Customer files are deleted after printing or rejection on a schedule you choose." },
  { icon: ShieldCheck, title: "Private by design", text: "Files live in private storage — never exposed through public links." },
];

const STEPS = [
  { icon: QrCode, title: "Scan the shop QR", text: "Customers scan the code at your counter — no app install." },
  { icon: Upload, title: "Upload & configure", text: "Add documents or photos, pick colour, copies and paper." },
  { icon: CheckCircle2, title: "Shop approves", text: "You review the order and send it to the right printer." },
  { icon: ScanLine, title: "Track & collect", text: "Customers watch the status change live, then pick up." },
];

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="bg-hero overflow-hidden text-primary-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-semibold">
              <QrCode className="h-3.5 w-3.5" /> QR self-service printing
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-6xl">
              Smart Printing.<br /><span className="text-gradient">Simple Experience.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-primary-foreground/75">
              Customers scan, upload and choose their settings. You approve and print — no WhatsApp files, no USB drives, no queue at the counter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link to="/upload">Start printing <ArrowRight /></Link>
              </Button>
              <Button asChild variant="heroOutline" size="lg">
                <Link to="/track">Track an order</Link>
              </Button>
            </div>
          </div>
          <img src={hero} alt="Phone scanning a QR code sending documents to a printer" width={1280} height={1024} className="w-full rounded-3xl shadow-lift animate-rise" />
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-accent">About PRINTORA</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Built for the counter of every print shop.</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            PRINTORA turns your printing desk into a self-service station. Each shop gets its own QR code linking to a mobile-friendly upload page. Orders flow into a live dashboard where you approve, queue and print — while customers follow along from their phone.
          </p>
        </div>
      </section>

      <section id="features" className="bg-card py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-bold uppercase tracking-widest text-accent">Printing software features</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold md:text-4xl">Everything between "scan" and "printed".</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-soft lift p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="card-soft grid grid-cols-2 gap-3 p-6">
            {["1-Full", "2-Top / Bottom", "2-Left / Right", "4-Grid"].map((l, i) => (
              <div key={l} className="paper-sheet flex aspect-[1/1.414] flex-col gap-1.5 rounded-lg p-2">
                <div className={i === 2 ? "grid flex-1 grid-cols-2 gap-1.5" : i === 3 ? "grid flex-1 grid-cols-2 grid-rows-2 gap-1.5" : "grid flex-1 gap-1.5"}>
                  {Array.from({ length: [1, 2, 2, 4][i] ?? 1 }).map((_, k) => (
                    <div key={k} className="rounded bg-primary-soft" />
                  ))}
                </div>
                <span className="text-center text-[10px] font-semibold text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-accent">Print controls & live preview</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">See the exact A4 page before it prints.</h2>
            <ul className="mt-6 space-y-3 text-muted-foreground">
              {["Fill, fit or stretch every slot", "Zoom, rotate, reposition and crop with aspect presets", "Instant B&W preview and live price", "Custom rows × columns grids"].map((t) => (
                <li key={t} className="flex gap-3"><LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-primary" />{t}</li>
              ))}
            </ul>
            <Button asChild className="mt-8"><Link to="/upload/image">Try the photo editor</Link></Button>
          </div>
        </div>
      </section>

      <section id="how" className="bg-brand py-20 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-bold uppercase tracking-widest text-accent">How it works</p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Four steps. Zero confusion.</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6">
                <span className="font-display text-sm font-bold text-accent">0{i + 1}</span>
                <s.icon className="mt-3 h-7 w-7" />
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-primary-foreground/70">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-accent">Contact</p>
            <h2 className="mt-3 text-3xl font-bold">Visit the shop counter.</h2>
            <p className="mt-3 text-muted-foreground">Questions about an order? Show your order number at the counter.</p>
          </div>
          <div>
            <Button asChild variant="outline" size="lg"><Link to="/track"><ScanLine className="h-5 w-5" />Track your order</Link></Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
