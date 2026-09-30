import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Container } from "@/components/site/primitives";

type IntentPreview = { planName?: string; cadence?: string; amountPaise?: number; expiresAt?: number };

export const Route = createFileRoute("/pay/znuffi")({
  validateSearch: (search: Record<string, unknown>) => ({ token: String(search["token"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Znuffi Software Subscription | Tharigopula Technologies" },
      { name: "description", content: "Secure payment for a Znuffi veterinary business software subscription sold by Tharigopula Technologies." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ZnuffiPaymentPage,
});

function decodePreview(token: string): IntentPreview | null {
  try {
    const encoded = token.split(".")[0];
    if (!encoded) return null;
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return JSON.parse(decodeURIComponent(escape(atob(padded)))) as IntentPreview;
  } catch {
    return null;
  }
}

function ZnuffiPaymentPage() {
  const { token } = Route.useSearch();
  const preview = useMemo(() => decodePreview(token), [token]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const amount = preview?.amountPaise ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(preview.amountPaise / 100) : "—";
  const expired = !preview?.expiresAt || preview.expiresAt * 1000 <= Date.now();

  async function continueToPayment() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/znuffi/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { checkoutUrl?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error("Unable to start secure payment.");
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start secure payment.");
      setLoading(false);
    }
  }

  return (
    <section className="min-h-[78vh] bg-gradient-to-b from-secondary/50 to-background py-12 sm:py-20">
      <Container className="max-w-5xl">
        <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-lift lg:grid-cols-[1.05fr_.95fr]">
          <div className="p-7 sm:p-10">
            <div className="flex items-center gap-3">
              <img src="/products/znuffi-mascot.webp" alt="" className="h-12 w-12 rounded-xl object-contain" />
              <div><p className="text-sm font-semibold text-signal">ZNUFFI</p><p className="text-sm text-muted-foreground">Veterinary business software</p></div>
            </div>
            <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Complete your software subscription</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">This payment is collected by Tharigopula Technologies for access to Znuffi clinic-management software. It is not a veterinary consultation or patient-care payment.</p>
            <div className="mt-8 space-y-4 text-sm">
              <div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-signal" /><span>Tharigopula Technologies is the legal seller and payment recipient.</span></div>
              <div className="flex gap-3"><LockKeyhole className="h-5 w-5 text-signal" /><span>Payment details are entered only on Razorpay's secure checkout.</span></div>
              <div className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-signal" /><span>Znuffi access activates automatically after verified payment.</span></div>
            </div>
          </div>
          <aside className="border-t border-border bg-secondary/50 p-7 sm:p-10 lg:border-t-0 lg:border-l">
            <p className="text-sm font-medium text-muted-foreground">Order summary</p>
            <h2 className="mt-4 text-2xl font-semibold">Znuffi {preview?.planName ?? "subscription"}</h2>
            <p className="mt-1 capitalize text-muted-foreground">{preview?.cadence ?? "Software plan"}</p>
            <div className="my-7 h-px bg-border" />
            <div className="flex items-end justify-between"><span className="text-sm text-muted-foreground">Total</span><strong className="text-3xl">{amount}</strong></div>
            <p className="mt-2 text-xs text-muted-foreground">Taxes, if applicable, will be shown on the invoice.</p>
            <button disabled={loading || expired || !token} onClick={continueToPayment} className="mt-8 w-full rounded-xl bg-signal px-5 py-3.5 font-semibold text-signal-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Opening secure checkout…" : expired ? "Checkout link expired" : "Continue to Razorpay"}</button>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Seller: Tharigopula Technologies · Hyderabad, Telangana · hello.tharigopula@gmail.com</p>
          </aside>
        </div>
      </Container>
    </section>
  );
}
