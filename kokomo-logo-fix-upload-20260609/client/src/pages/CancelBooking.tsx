import { useState } from "react";
import type { ElementType, ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { CheckCircle2, Mail, Hash, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const schema = z.object({
  id: z.coerce.number().int().positive("Booking reference is required"),
  customerEmail: z.string().email("Enter the email used for the booking"),
});

type FormValues = z.infer<typeof schema>;

function Field({ label, icon: Icon, error, children }: {
  label: string;
  icon: ElementType;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] font-medium">
        <Icon className="w-3 h-3" />
        {label}
      </label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export default function CancelBooking() {
  const [cancelled, setCancelled] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerEmail: "" },
  });

  const cancelMutation = trpc.bookings.cancel.useMutation({
    onSuccess: () => setCancelled(true),
    onError: (err) => toast.error(err.message || "Unable to cancel this booking."),
  });

  if (cancelled) {
    return (
      <div className="min-h-screen bg-[var(--kokomo-white)] flex flex-col">
        <header className="border-b border-[var(--kokomo-light)] px-8 py-6">
          <img src="/kokomo-logo.png" alt="KOKOMO Gold Coast" className="h-8 object-contain" />
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 border border-[var(--kokomo-black)] flex items-center justify-center mx-auto mb-10">
              <CheckCircle2 className="w-7 h-7 text-[var(--kokomo-black)]" />
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--kokomo-mid)] mb-4">Booking Cancelled</p>
            <h1 className="font-serif text-4xl font-light text-[var(--kokomo-black)] mb-6">Your request has been closed</h1>
            <p className="text-sm text-[var(--kokomo-mid)] leading-relaxed mb-10 font-light">
              The lift booking is now marked as cancelled. Submit a new request if you need another appointment.
            </p>
            <Link href="/">
              <span className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase border border-[var(--kokomo-black)] px-8 py-3 hover:bg-[var(--kokomo-black)] hover:text-white transition-all duration-200 cursor-pointer">
                <ArrowLeft className="w-3 h-3" />
                Booking Form
              </span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--kokomo-white)]">
      <header className="border-b border-[var(--kokomo-light)] px-8 py-6 flex items-center justify-between">
        <img src="/kokomo-logo.png" alt="KOKOMO Gold Coast" className="h-8 object-contain" />
        <Link href="/">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] hover:text-[var(--kokomo-black)] transition-colors cursor-pointer">
            Booking Form
          </span>
        </Link>
      </header>

      <main className="max-w-lg mx-auto px-4 py-16">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[var(--kokomo-mid)] mb-5">Cancel Request</p>
        <h1 className="font-serif text-5xl font-light text-[var(--kokomo-black)] mb-5">Cancel a Lift Booking</h1>
        <div className="w-10 h-px bg-[var(--kokomo-black)] mb-8" />
        <p className="text-sm text-[var(--kokomo-mid)] leading-relaxed mb-10 font-light">
          Enter your booking reference and the email address used in the original request.
        </p>

        <form onSubmit={form.handleSubmit((data) => cancelMutation.mutate(data))} className="space-y-6">
          <Field label="Booking Reference" icon={Hash} error={form.formState.errors.id?.message}>
            <Input
              {...form.register("id")}
              inputMode="numeric"
              placeholder="e.g. 42"
              className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white"
            />
          </Field>

          <Field label="Email Address" icon={Mail} error={form.formState.errors.customerEmail?.message}>
            <Input
              {...form.register("customerEmail")}
              type="email"
              placeholder="your@email.com"
              className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white"
            />
          </Field>

          <Button
            type="submit"
            disabled={cancelMutation.isPending}
            className="w-full bg-[var(--kokomo-black)] hover:bg-[var(--kokomo-mid)] text-white py-4 text-[10px] tracking-[0.3em] uppercase font-medium rounded-none h-14"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Booking"}
          </Button>
        </form>
      </main>
    </div>
  );
}
