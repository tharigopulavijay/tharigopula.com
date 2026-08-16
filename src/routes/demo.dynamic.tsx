import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { demoArticles, demoBrand, demoUnits } from "@/data/demo-brand";

export const Route = createFileRoute("/demo/dynamic")({
  head: () => ({
    meta: [
      { title: "Aurelia Ridge — Live Availability & Bookings (Dynamic Demo)" },
      {
        name: "description",
        content: "A data-driven site for Aurelia Ridge with a searchable unit catalogue, articles, site-visit booking and an admin enquiries view.",
      },
      { property: "og:title", content: "Aurelia Ridge — Dynamic Site Demo" },
      {
        property: "og:description",
        content: "Experience 02: filterable unit catalogue, articles, booking flow and a lightweight admin/CMS view.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DynamicDemo,
});

type Enquiry = { name: string; email: string; interest: string; time: string };
type Visit = { unit: string; date: string; slot: string };

const timeSlots = ["10:00 AM", "11:30 AM", "2:00 PM", "4:00 PM"];

function whatsappLink() {
  return `https://wa.me/${demoBrand.whatsapp}?text=${encodeURIComponent(
    "Hi, I'd like more details on Aurelia Ridge availability.",
  )}`;
}

function CmsBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/10 px-3 py-1 text-[11px] font-medium text-signal">
      <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
      {children}
    </span>
  );
}

function DynamicDemo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <Hero />
      <UnitCatalogue />
      <Articles />
      <BookingAndEnquiry />
      <Footer />
      <a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-signal-foreground shadow-lift transition-transform hover:scale-[1.03] motion-reduce:transition-none"
      >
        <span aria-hidden>💬</span> WhatsApp
      </a>
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="font-display text-lg font-semibold tracking-tight text-ink">
          {demoBrand.name}
        </a>
        <ul className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          <li><a href="#units" className="hover:text-foreground">Availability</a></li>
          <li><a href="#articles" className="hover:text-foreground">Journal</a></li>
          <li><a href="#booking" className="hover:text-foreground">Book a visit</a></li>
          <li><a href="#enquiry" className="hover:text-foreground">Enquire</a></li>
        </ul>
        <CmsBadge>Live from CMS</CmsBadge>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border bg-ink text-ink-foreground">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="flex flex-wrap items-center gap-3">
          <CmsBadge>Content updates from CMS</CmsBadge>
          <span className="text-xs text-ink-foreground/60">{demoBrand.location}</span>
        </div>
        <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {demoBrand.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-foreground/70">{demoBrand.promise}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#units" className="rounded-md bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground hover:opacity-90">
            Check live availability
          </a>
          <a href="#booking" className="rounded-md border border-ink-border px-6 py-3.5 text-sm font-semibold hover:bg-ink-foreground/5">
            Book a site visit
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, extra }: { eyebrow: string; title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-signal uppercase">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      </div>
      {extra}
    </div>
  );
}

const unitTypes = ["All", "Ridge Villa", "Terrace Residence"] as const;
const unitStatuses = ["All", "Available", "Reserved", "Sold"] as const;

function UnitCatalogue() {
  const [type, setType] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [beds, setBeds] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"price" | "area">("price");

  const bedOptions = useMemo(() => ["All", ...Array.from(new Set(demoUnits.map((u) => String(u.beds))))], []);

  const priceNumber = (p: string) => parseFloat(p.replace(/[^0-9.]/g, ""));

  const filtered = useMemo(() => {
    return demoUnits
      .filter((u) => (type === "All" ? true : u.type === type))
      .filter((u) => (status === "All" ? true : u.status === status))
      .filter((u) => (beds === "All" ? true : String(u.beds) === beds))
      .filter((u) => u.id.toLowerCase().includes(query.toLowerCase()) || u.type.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (sort === "price" ? priceNumber(a.price) - priceNumber(b.price) : a.area - b.area));
  }, [type, status, beds, query, sort]);

  const statusColor: Record<string, string> = {
    Available: "bg-signal/15 text-signal border-signal/30",
    Reserved: "bg-muted text-muted-foreground border-border",
    Sold: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <section id="units" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <SectionHeading
        eyebrow="Availability"
        title="Search the unit catalogue"
        extra={<CmsBadge>Synced from database</CmsBadge>}
      />

      <div className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search unit ID or type…"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ink/40 lg:col-span-2"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          {unitTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          {unitStatuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={beds} onChange={(e) => setBeds(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          {bedOptions.map((b) => (
            <option key={b}>{b === "All" ? "All beds" : `${b} bed`}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{filtered.length}</span> of {demoUnits.length} residences
        </p>
        <div className="flex items-center gap-2">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "price" | "area")} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
            <option value="price">Price</option>
            <option value="area">Area</option>
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Beds</th>
              <th className="px-4 py-3">Area (sqft)</th>
              <th className="px-4 py-3">Facing</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{u.id}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.beds}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.area.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.facing}</td>
                <td className="px-4 py-3 font-medium text-foreground">{u.price}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor[u.status] ?? ""}`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No residences match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const allTags = ["All", ...Array.from(new Set(demoArticles.map((a) => a.tag)))];

function Articles() {
  const [tag, setTag] = useState("All");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const filtered = demoArticles.filter((a) => tag === "All" || a.tag === tag);

  return (
    <section id="articles" className="border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="Journal" title="Notes from the site" extra={<CmsBadge>Articles managed in CMS</CmsBadge>} />

        <div className="mt-6 flex flex-wrap gap-2">
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                tag === t ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {filtered.map((a) => {
            const open = openSlug === a.slug;
            return (
              <div key={a.slug} className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  onClick={() => setOpenSlug(open ? null : a.slug)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open}
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2 py-0.5">{a.tag}</span>
                      <span>{a.date}</span>
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-ink">{a.title}</h3>
                  </div>
                  <span className={`text-lg text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-45" : ""}`} aria-hidden>
                    +
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                    <p>{a.excerpt}</p>
                    <p className="mt-3 text-xs text-muted-foreground/70">Slug: /journal/{a.slug}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BookingAndEnquiry() {
  const [unit, setUnit] = useState(demoUnits[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(timeSlots[0] ?? "");
  const [visits, setVisits] = useState<Visit[]>([]);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([
    { name: "Rahul Menon", email: "rahul.menon@example.com", interest: "Ridge Villa", time: "2 hours ago" },
    { name: "Ayesha Khan", email: "ayesha.khan@example.com", interest: "Terrace Residence", time: "Yesterday" },
  ]);

  const bookVisit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date) {
      toast.error("Please pick a date for your visit.");
      return;
    }
    setVisits((v) => [...v, { unit, date, slot }]);
    toast.success(`Site visit confirmed for ${unit} on ${date} at ${slot}.`);
    e.currentTarget.reset();
    setDate("");
  };

  const submitEnquiry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const interest = String(form.get("interest") ?? "").trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid name and email.");
      return;
    }
    setEnquiries((prev) => [{ name, email, interest: interest || "General", time: "Just now" }, ...prev]);
    toast.success("Enquiry received — recorded to the admin dashboard.");
    e.currentTarget.reset();
  };

  const field = "mt-1.5 w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ink/40";

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div id="booking" className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeading eyebrow="Site visit" title="Book a guided visit" extra={<CmsBadge>Scheduling engine</CmsBadge>} />
          <form onSubmit={bookVisit} className="mt-6 rounded-xl border border-border bg-card p-6">
            <label className="block text-sm font-medium">
              Residence
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={field}>
                {demoUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} — {u.type}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Time slot</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {timeSlots.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      slot === s ? "border-ink bg-ink text-ink-foreground" : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="mt-6 w-full rounded-md bg-signal px-5 py-3.5 text-sm font-semibold text-signal-foreground hover:opacity-90">
              Confirm visit
            </button>
          </form>

          {visits.length > 0 ? (
            <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your visits</p>
              <ul className="mt-2 space-y-2 text-sm">
                {visits.map((v, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                    <span>{v.unit}</span>
                    <span className="text-muted-foreground">
                      {v.date} · {v.slot}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div id="enquiry">
          <SectionHeading eyebrow="Enquire" title="Send an enquiry" extra={<CmsBadge>Writes to database</CmsBadge>} />
          <form onSubmit={submitEnquiry} className="mt-6 rounded-xl border border-border bg-card p-6">
            <label className="block text-sm font-medium">
              Name
              <input name="name" className={field} maxLength={100} />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Email
              <input name="email" type="email" className={field} maxLength={255} />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Interested in
              <input name="interest" placeholder="e.g. Ridge Villa" className={field} maxLength={80} />
            </label>
            <button type="submit" className="mt-6 w-full rounded-md bg-ink px-5 py-3.5 text-sm font-semibold text-ink-foreground hover:opacity-90">
              Submit enquiry
            </button>
          </form>

          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <div className="flex items-center justify-between bg-secondary/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Recent enquiries (admin view)</span>
              <CmsBadge>Admin</CmsBadge>
            </div>
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Interest</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((e, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-foreground">{e.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.interest}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-ink text-ink-foreground/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} {demoBrand.developer}. {demoBrand.name} is a demo site.
        </p>
        <p>{demoBrand.location}</p>
      </div>
    </footer>
  );
}
