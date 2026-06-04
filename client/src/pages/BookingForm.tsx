import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isWeekend, addDays } from "date-fns";
import { CalendarIcon, CheckCircle2, Clock, MapPin, Phone, Mail, User, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// ─── Validation schema ───────────────────────────────────────────────────────

const schema = z.object({
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().min(6, "Phone number is required"),
  customerEmail: z.string().email("Valid email is required"),
  roomNumber: z.string().min(1, "Room / unit number is required"),
  settlementConfirmed: z.boolean().refine(val => val === true, {
    message: "You must confirm that settlement has been completed",
  }),
  settlementDate: z.string().min(1, "Settlement date is required"),
  requestedDate: z.string().min(1, "Please select a date"),
  requestedStartTime: z.string().min(1, "Please select a start time"),
  requestedDurationMinutes: z.number().int().min(30).max(150),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Time slot generation ────────────────────────────────────────────────────

function generateTimeSlots(durationMinutes: number): string[] {
  const slots: string[] = [];
  const earliest = 9 * 60;
  const latest = 16 * 60;
  for (let start = earliest; start + durationMinutes <= latest; start += 30) {
    const h = Math.floor(start / 60).toString().padStart(2, "0");
    const m = (start % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

const DURATION_OPTIONS = [
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "2.5 hours (maximum)", value: 150 },
];

// ─── Field wrapper ───────────────────────────────────────────────────────────

function Field({ label, icon: Icon, error, children }: {
  label: string;
  icon?: React.ElementType;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] font-medium">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookingForm() {
  const [submitted, setSubmitted] = useState(false);
  const [bookingId, setBookingId] = useState<number | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requestedDurationMinutes: 60,
      settlementConfirmed: false,
    },
  });

  const duration = watch("requestedDurationMinutes");
  const settlementConfirmed = watch("settlementConfirmed");
  const timeSlots = useMemo(() => generateTimeSlots(duration), [duration]);

  const submitMutation = trpc.bookings.submit.useMutation({
    onSuccess: (result) => {
      setBookingId(result.bookingId);
      setSubmitted(true);
    },
    onError: (err) => toast.error(err.message || "Submission failed. Please try again."),
  });

  const onSubmit = (data: FormValues) => submitMutation.mutate(data);

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--kokomo-white)] flex flex-col">
        <header className="border-b border-[var(--kokomo-light)] px-8 py-6">
          <img src="/manus-storage/kokomo-logo_d492c703.jpg" alt="KOKOMO Gold Coast" className="h-8 object-contain" />
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 border border-[var(--kokomo-black)] flex items-center justify-center mx-auto mb-10">
              <CheckCircle2 className="w-7 h-7 text-[var(--kokomo-black)]" />
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--kokomo-mid)] mb-4">Request Submitted</p>
            <h2 className="font-serif text-4xl font-light text-[var(--kokomo-black)] mb-6">Booking Received</h2>
            <div className="w-12 h-px bg-[var(--kokomo-black)] mx-auto mb-8" />
            <p className="text-sm text-[var(--kokomo-mid)] leading-relaxed mb-10 font-light">
              Thank you for your lift booking request. Our team will review your request and send you a confirmation email within 24 hours.
            </p>
            {bookingId && (
              <div className="border border-[var(--kokomo-light)] bg-[var(--kokomo-sand)] px-5 py-4 mb-8">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] mb-1">Booking Reference</p>
                <p className="font-serif text-3xl text-[var(--kokomo-black)]">#{bookingId}</p>
                <p className="text-xs text-[var(--kokomo-mid)] mt-2 font-light">Keep this number if you need to cancel your request.</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/cancel">
                <span className="text-xs tracking-[0.2em] uppercase border border-[var(--kokomo-light)] px-8 py-3 hover:border-[var(--kokomo-black)] transition-all duration-200 cursor-pointer">
                  Cancel a Booking
                </span>
              </Link>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs tracking-[0.2em] uppercase border border-[var(--kokomo-black)] px-8 py-3 hover:bg-[var(--kokomo-black)] hover:text-white transition-all duration-200"
            >
              Submit Another Request
            </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--kokomo-white)]">

      {/* Header */}
      <header className="border-b border-[var(--kokomo-light)] px-8 py-6 flex items-center justify-between">
        <img src="/manus-storage/kokomo-logo_d492c703.jpg" alt="KOKOMO Gold Coast" className="h-8 object-contain" />
        <Link href="/admin">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] hover:text-[var(--kokomo-black)] transition-colors cursor-pointer">
            Admin
          </span>
        </Link>
      </header>

      {/* Hero */}
      <div className="bg-[var(--kokomo-black)] text-white px-8 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/50 mb-6 font-light">B2 Lift Booking</p>
          <h1 className="font-serif text-5xl md:text-6xl font-light leading-tight mb-6">
            Book Your<br /><span className="italic">Lift Access</span>
          </h1>
          <div className="w-10 h-px bg-white/40 mx-auto mb-6" />
          <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto font-light">
            Complete the form below to request your appointment. We'll confirm your booking within 24 hours.
          </p>
        </div>
      </div>

      {/* Info bar */}
      <div className="border-b border-[var(--kokomo-light)] bg-[var(--kokomo-sand)] px-8 py-3">
        <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-8 text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)]">
          <span className="flex items-center gap-2"><Clock className="w-3 h-3" />Mon – Fri &nbsp;9:00 AM – 4:00 PM</span>
          <span className="flex items-center gap-2"><CalendarIcon className="w-3 h-3" />Maximum 2.5 hours per session</span>
        </div>
      </div>

      {/* Form body */}
      <div className="max-w-2xl mx-auto px-4 py-14">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">

          {/* ── Personal Details ─────────────────────────────────────────── */}
          <section>
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--kokomo-mid)] mb-1">01</p>
              <h2 className="font-serif text-2xl font-light text-[var(--kokomo-black)]">Personal Details</h2>
              <div className="w-6 h-px bg-[var(--kokomo-black)] mt-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Full Name" icon={User} error={errors.customerName?.message}>
                <Input {...register("customerName")} placeholder="Your full name"
                  className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white" />
              </Field>
              <Field label="Phone Number" icon={Phone} error={errors.customerPhone?.message}>
                <Input {...register("customerPhone")} placeholder="+61 4xx xxx xxx"
                  className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white" />
              </Field>
              <Field label="Email Address" icon={Mail} error={errors.customerEmail?.message}>
                <Input {...register("customerEmail")} type="email" placeholder="your@email.com"
                  className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white" />
              </Field>
              <Field label="Room / Unit Number" icon={MapPin} error={errors.roomNumber?.message}>
                <Input {...register("roomNumber")} placeholder="e.g. B2-12A"
                  className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white" />
              </Field>
            </div>

            {/* Settlement confirmation */}
            <div className="mt-6 pt-6 border-t border-[var(--kokomo-light)]">
              <div className="flex items-start gap-3">
                <Controller
                  name="settlementConfirmed"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="settlementConfirmed"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5 rounded-none border-[var(--kokomo-black)] data-[state=checked]:bg-[var(--kokomo-black)] data-[state=checked]:border-[var(--kokomo-black)]"
                    />
                  )}
                />
                <div className="flex-1">
                  <label htmlFor="settlementConfirmed" className="text-sm font-light text-[var(--kokomo-black)] cursor-pointer leading-snug">
                    I confirm that <span className="font-medium">settlement has been completed</span> for my property
                  </label>
                  <p className="text-xs text-[var(--kokomo-mid)] mt-1 font-light">
                    Lift bookings are only available after property settlement has been finalised.
                  </p>
                  {errors.settlementConfirmed && (
                    <p className="text-destructive text-xs mt-1">{errors.settlementConfirmed.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-5 ml-7">
                <Field label="Settlement Date" icon={CalendarIcon} error={errors.settlementDate?.message}>
                  <Input
                    {...register("settlementDate")}
                    type="date"
                    className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none bg-white max-w-xs"
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* ── Appointment Details ──────────────────────────────────────── */}
          <section>
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--kokomo-mid)] mb-1">02</p>
              <h2 className="font-serif text-2xl font-light text-[var(--kokomo-black)]">Appointment Details</h2>
              <div className="w-6 h-px bg-[var(--kokomo-black)] mt-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date picker */}
              <Field label="Preferred Date" icon={CalendarIcon} error={errors.requestedDate?.message}>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-light border-[var(--kokomo-light)] rounded-none bg-white hover:bg-[var(--kokomo-sand)]",
                        !selectedDate && "text-[var(--kokomo-mid)]"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-none" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setValue("requestedDate", date ? format(date, "yyyy-MM-dd") : "");
                        setValue("requestedStartTime", "");
                        setCalendarOpen(false);
                      }}
                      disabled={(date) => isWeekend(date) || date < addDays(new Date(), 0)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-[10px] tracking-wide text-[var(--kokomo-mid)] font-light">Weekdays only — Monday to Friday</p>
              </Field>

              {/* Duration */}
              <Field label="Duration" icon={Clock}>
                <Select
                  defaultValue="60"
                  onValueChange={(v) => {
                    setValue("requestedDurationMinutes", parseInt(v));
                    setValue("requestedStartTime", "");
                  }}
                >
                  <SelectTrigger className="border-[var(--kokomo-light)] rounded-none bg-white">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Start time */}
              <div className="md:col-span-2 space-y-2">
                <label className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] font-medium">
                  <Clock className="w-3 h-3" />Preferred Start Time
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {timeSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setValue("requestedStartTime", slot)}
                      className={cn(
                        "py-2.5 px-2 text-xs border transition-all duration-150 font-light tracking-wide",
                        watch("requestedStartTime") === slot
                          ? "bg-[var(--kokomo-black)] text-white border-[var(--kokomo-black)]"
                          : "border-[var(--kokomo-light)] text-[var(--kokomo-black)] hover:border-[var(--kokomo-black)]"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                {errors.requestedStartTime && <p className="text-destructive text-xs">{errors.requestedStartTime.message}</p>}
              </div>
            </div>
          </section>

          {/* ── Notes ───────────────────────────────────────────────────── */}
          <section>
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--kokomo-mid)] mb-1">03</p>
              <h2 className="font-serif text-2xl font-light text-[var(--kokomo-black)]">Additional Notes</h2>
              <div className="w-6 h-px bg-[var(--kokomo-black)] mt-3" />
            </div>
            <Field label="Special Requirements or Notes (Optional)" icon={FileText}>
              <Textarea
                {...register("notes")}
                placeholder="Any special requirements, access instructions, or additional information..."
                rows={4}
                className="border-[var(--kokomo-light)] focus:border-[var(--kokomo-black)] rounded-none resize-none bg-white font-light"
              />
            </Field>
          </section>

          {/* Submit */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full bg-[var(--kokomo-black)] hover:bg-[var(--kokomo-mid)] text-white py-4 text-[10px] tracking-[0.3em] uppercase font-medium rounded-none h-14 transition-all duration-200"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting Request...
                </span>
              ) : "Submit Booking Request"}
            </Button>
            <p className="text-center text-[10px] tracking-wide text-[var(--kokomo-mid)] mt-4 font-light">
              This is a request only. Your booking will be confirmed by email once reviewed.
              <Link href="/cancel">
                <span className="ml-2 underline underline-offset-4 cursor-pointer">Cancel an existing booking</span>
              </Link>
            </p>
          </div>

        </form>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--kokomo-light)] px-8 py-6 mt-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <img src="/manus-storage/kokomo-logo_d492c703.jpg" alt="KOKOMO Gold Coast" className="h-5 object-contain opacity-40" />
          <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--kokomo-mid)]">
            © {new Date().getFullYear()} Kokomo Gold Coast
          </p>
        </div>
      </footer>
    </div>
  );
}
