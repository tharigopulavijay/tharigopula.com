import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/site/primitives";

export const Route = createFileRoute("/pay/znuffi/complete")({
  head: () => ({ meta: [{ title: "Payment received | Tharigopula Technologies" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PaymentComplete,
});

function PaymentComplete() {
  return <section className="min-h-[72vh] bg-gradient-to-b from-secondary/50 to-background py-20"><Container className="max-w-2xl"><div className="rounded-3xl border border-border bg-card p-8 text-center shadow-lift sm:p-12"><CheckCircle2 className="mx-auto h-14 w-14 text-signal" /><h1 className="mt-6 font-display text-3xl font-semibold">Payment received</h1><p className="mt-4 leading-relaxed text-muted-foreground">Razorpay is confirming the payment with Tharigopula Technologies. Your Znuffi software access will update automatically.</p><a href="https://znuffi.com/vet" className="mt-8 inline-flex rounded-xl bg-signal px-5 py-3 font-semibold text-signal-foreground">Return to Znuffi</a><div className="mt-5"><Link to="/contact" className="text-sm text-muted-foreground underline underline-offset-4">Contact billing support</Link></div></div></Container></section>;
}
