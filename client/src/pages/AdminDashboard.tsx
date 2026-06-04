import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isWeekend, addDays } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon, CheckCircle2, XCircle, Clock, Phone, Mail, MapPin,
  FileText, CalendarCheck, AlertCircle, LayoutDashboard, LogOut, BadgeCheck,
  Download, Ban, LockKeyhole,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

type Booking = {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  roomNumber: string;
  settlementConfirmed?: boolean;
  settlementDate?: string | null;
  requestedDate: string;
  requestedStartTime: string;
  requestedDurationMinutes: number;
  notes?: string | null;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  confirmedDate?: string | null;
  confirmedStartTime?: string | null;
  calendarEventId?: string | null;
  createdAt: Date;
};

// ─── Confirm form schema ──────────────────────────────────────────────────────

const confirmSchema = z.object({
  confirmedDate: z.string().min(1, "Please select a date"),
  confirmedStartTime: z.string().min(1, "Please select a time"),
});
type ConfirmForm = z.infer<typeof confirmSchema>;

function generateTimeSlots(durationMinutes: number): string[] {
  const slots: string[] = [];
  for (let start = 9 * 60; start + durationMinutes <= 16 * 60; start += 30) {
    const h = Math.floor(start / 60).toString().padStart(2, "0");
    const m = (start % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Booking["status"] }) {
  const map = {
    pending: { label: "Pending", cls: "border-[var(--kokomo-black)] text-[var(--kokomo-black)] bg-transparent" },
    confirmed: { label: "Confirmed", cls: "border-[var(--kokomo-black)] bg-[var(--kokomo-black)] text-white" },
    rejected: { label: "Rejected", cls: "border-[var(--kokomo-mid)] text-[var(--kokomo-mid)] bg-transparent" },
    cancelled: { label: "Cancelled", cls: "border-[var(--kokomo-mid)] text-[var(--kokomo-mid)] bg-[var(--kokomo-sand)]" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] tracking-[0.15em] uppercase border font-medium", cls)}>
      {status === "pending" && <Clock className="w-2.5 h-2.5" />}
      {status === "confirmed" && <CheckCircle2 className="w-2.5 h-2.5" />}
      {status === "rejected" && <XCircle className="w-2.5 h-2.5" />}
      {status === "cancelled" && <Ban className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking, onConfirm, onReject }: {
  booking: Booking;
  onConfirm: (b: Booking) => void;
  onReject: (b: Booking) => void;
}) {
  const durationLabel = booking.requestedDurationMinutes >= 60
    ? `${(booking.requestedDurationMinutes / 60).toFixed(1).replace(".0", "")}h`
    : `${booking.requestedDurationMinutes}min`;

  return (
    <div className={cn(
      "bg-white border p-6 transition-all duration-200",
      booking.status === "pending" ? "border-[var(--kokomo-black)]" : "border-[var(--kokomo-light)]"
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-serif text-xl text-[var(--kokomo-black)]">{booking.customerName}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-[10px] tracking-[0.1em] text-[var(--kokomo-mid)] uppercase">
            Submitted {new Date(booking.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)] mb-0.5">Room</p>
          <p className="font-serif text-3xl text-[var(--kokomo-black)] font-light">{booking.roomNumber}</p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[
          { icon: Phone, text: booking.customerPhone },
          { icon: Mail, text: booking.customerEmail },
          { icon: CalendarIcon, text: booking.requestedDate },
          { icon: Clock, text: `${booking.requestedStartTime} · ${durationLabel}` },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-xs text-[var(--kokomo-mid)] font-light">
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">{text}</span>
          </div>
        ))}
      </div>

      {/* Settlement info */}
      {booking.settlementConfirmed && (
        <div className="flex items-center gap-2 text-xs text-[var(--kokomo-black)] bg-[var(--kokomo-sand)] px-3 py-2 mb-4 border border-[var(--kokomo-light)]">
          <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="font-light">Settlement confirmed
            {booking.settlementDate && <> · <strong className="font-medium">{booking.settlementDate}</strong></>}
          </span>
        </div>
      )}

      {/* Notes */}
      {booking.notes && (
        <div className="flex items-start gap-2 text-xs text-[var(--kokomo-mid)] bg-[var(--kokomo-sand)] px-3 py-2.5 mb-4">
          <FileText className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2 font-light">{booking.notes}</span>
        </div>
      )}

      {/* Confirmed info */}
      {booking.status === "confirmed" && booking.confirmedDate && (
        <div className="flex items-center gap-2 text-xs text-[var(--kokomo-black)] bg-[var(--kokomo-sand)] px-3 py-2.5 mb-4 border border-[var(--kokomo-black)]">
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="font-light">Confirmed: <strong className="font-medium">{booking.confirmedDate}</strong> at <strong className="font-medium">{booking.confirmedStartTime}</strong></span>
          {booking.calendarEventId && (
            <span className="ml-auto text-[10px] tracking-wide uppercase text-[var(--kokomo-mid)]">Calendar ✓</span>
          )}
        </div>
      )}

      {/* Actions */}
      {booking.status === "pending" && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onConfirm(booking)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--kokomo-black)] text-white text-[10px] tracking-[0.2em] uppercase py-2.5 hover:bg-[var(--kokomo-mid)] transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            Confirm
          </button>
          <button
            onClick={() => onReject(booking)}
            className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--kokomo-light)] text-[var(--kokomo-mid)] text-[10px] tracking-[0.2em] uppercase py-2.5 hover:border-[var(--kokomo-black)] hover:text-[var(--kokomo-black)] transition-colors"
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected" | "cancelled">("all");
  const [confirmTarget, setConfirmTarget] = useState<Booking | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [confirmDate, setConfirmDate] = useState<Date | undefined>();
  const [adminPassword, setAdminPassword] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (adminUser) => {
      utils.auth.me.setData(undefined, adminUser);
      utils.auth.me.invalidate();
      setAdminPassword("");
      toast.success("Signed in.");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: bookings, isLoading } = trpc.bookings.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 30_000,
  });

  const confirmMutation = trpc.bookings.confirm.useMutation({
    onSuccess: () => {
      toast.success("Booking confirmed. Customer notified and calendar updated.");
      utils.bookings.list.invalidate();
      setConfirmTarget(null);
      setConfirmDate(undefined);
      confirmForm.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.bookings.reject.useMutation({
    onSuccess: () => {
      toast.success("Booking rejected.");
      utils.bookings.list.invalidate();
      setRejectTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmForm = useForm<ConfirmForm>({ resolver: zodResolver(confirmSchema) });

  const timeSlots = useMemo(
    () => generateTimeSlots(confirmTarget?.requestedDurationMinutes ?? 60),
    [confirmTarget]
  );

  const filtered = useMemo(() => {
    if (!bookings) return [];
    return filter === "all" ? bookings : bookings.filter(b => b.status === filter);
  }, [bookings, filter]);

  const stats = useMemo(() => ({
    total: bookings?.length ?? 0,
    pending: bookings?.filter(b => b.status === "pending").length ?? 0,
    confirmed: bookings?.filter(b => b.status === "confirmed").length ?? 0,
    rejected: bookings?.filter(b => b.status === "rejected").length ?? 0,
    cancelled: bookings?.filter(b => b.status === "cancelled").length ?? 0,
  }), [bookings]);

  const exportCsv = () => {
    if (!bookings?.length) {
      toast.info("There are no bookings to export.");
      return;
    }

    const columns: Array<keyof Booking | "bookingReference"> = [
      "bookingReference",
      "status",
      "customerName",
      "customerPhone",
      "customerEmail",
      "roomNumber",
      "settlementDate",
      "requestedDate",
      "requestedStartTime",
      "requestedDurationMinutes",
      "confirmedDate",
      "confirmedStartTime",
      "notes",
      "createdAt",
    ];

    const escapeCsv = (value: unknown) => {
      const text = value instanceof Date ? value.toISOString() : String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = bookings.map((booking) => columns.map((column) => {
      if (column === "bookingReference") return escapeCsv(`#${booking.id}`);
      return escapeCsv((booking as Booking)[column]);
    }).join(","));

    const csv = [columns.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kokomo-lift-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Auth guard ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--kokomo-white)] flex items-center justify-center">
        <div className="w-6 h-6 border border-[var(--kokomo-black)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--kokomo-black)] flex flex-col">
        <header className="px-8 py-6">
          <img src="/manus-storage/kokomo-logo_d492c703.jpg" alt="KOKOMO Gold Coast" className="h-7 object-contain brightness-0 invert" />
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              loginMutation.mutate({ password: adminPassword });
            }}
            className="text-center w-full max-w-sm"
          >
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-6">Admin Access</p>
            <h1 className="font-serif text-5xl text-white font-light mb-6">Booking Management</h1>
            <div className="w-10 h-px bg-white/30 mx-auto mb-8" />
            <p className="text-white/40 text-sm mb-8 font-light">Enter the admin password to manage booking requests.</p>
            <div className="relative mb-4">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
              <Input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Admin password"
                className="pl-10 rounded-none border-white/25 bg-white/10 text-white placeholder:text-white/30 focus:border-white"
              />
            </div>
            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full rounded-none border border-white bg-transparent text-white text-[10px] tracking-[0.25em] uppercase px-10 py-3.5 hover:bg-white hover:text-[var(--kokomo-black)] transition-all duration-200"
            >
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[var(--kokomo-white)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-[var(--kokomo-mid)] mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-[var(--kokomo-black)] mb-2">Access Restricted</h2>
          <p className="text-[var(--kokomo-mid)] text-sm font-light">This area is for administrators only.</p>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--kokomo-white)]">
      {/* Header */}
      <header className="bg-[var(--kokomo-black)] text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img src="/manus-storage/kokomo-logo_d492c703.jpg" alt="KOKOMO Gold Coast" className="h-6 object-contain brightness-0 invert" />
            <div className="w-px h-5 bg-white/20" />
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/50">Booking Management</p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white/80 transition-colors cursor-pointer">
                Booking Form
              </span>
            </Link>
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-white/40 tracking-wide">Signed in as</p>
              <p className="text-xs text-white/80 font-light">{user.name}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: "Total", value: stats.total, icon: LayoutDashboard },
            { label: "Pending", value: stats.pending, icon: Clock },
            { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2 },
            { label: "Rejected", value: stats.rejected, icon: XCircle },
            { label: "Cancelled", value: stats.cancelled, icon: Ban },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white border border-[var(--kokomo-light)] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)]">{label}</p>
                <Icon className="w-3.5 h-3.5 text-[var(--kokomo-mid)]" />
              </div>
              <p className="font-serif text-4xl font-light text-[var(--kokomo-black)]">{value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "confirmed", "rejected", "cancelled"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 text-[10px] tracking-[0.15em] uppercase border transition-all duration-150",
                filter === f
                  ? "bg-[var(--kokomo-black)] text-white border-[var(--kokomo-black)]"
                  : "border-[var(--kokomo-light)] text-[var(--kokomo-mid)] hover:border-[var(--kokomo-black)] hover:text-[var(--kokomo-black)]"
              )}
            >
              {f === "all" ? `All (${stats.total})` : `${f[0].toUpperCase()}${f.slice(1)} (${stats[f]})`}
            </button>
          ))}
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-[10px] tracking-[0.15em] uppercase border border-[var(--kokomo-black)] text-[var(--kokomo-black)] hover:bg-[var(--kokomo-black)] hover:text-white transition-all duration-150"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>

        {/* Booking list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-[var(--kokomo-light)]">
            <CalendarCheck className="w-10 h-10 text-[var(--kokomo-light)] mx-auto mb-4" />
            <p className="font-serif text-2xl text-[var(--kokomo-mid)] font-light">No bookings found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(b => (
              <BookingCard
                key={b.id}
                booking={b as Booking}
                onConfirm={setConfirmTarget}
                onReject={setRejectTarget}
              />
            ))}
          </div>
        )}
      </main>

      {/* Confirm dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) { setConfirmTarget(null); setConfirmDate(undefined); confirmForm.reset(); } }}>
        <DialogContent className="max-w-md rounded-none border-[var(--kokomo-black)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-light text-[var(--kokomo-black)]">Confirm Booking</DialogTitle>
          </DialogHeader>
          {confirmTarget && (
            <form onSubmit={confirmForm.handleSubmit((data) => {
              confirmMutation.mutate({ id: confirmTarget.id, confirmedDate: data.confirmedDate, confirmedStartTime: data.confirmedStartTime });
            })}>
              <div className="py-4 space-y-5">
                <div className="bg-[var(--kokomo-sand)] p-4 text-sm border border-[var(--kokomo-light)]">
                  <p className="font-medium text-[var(--kokomo-black)] mb-1">{confirmTarget.customerName}</p>
                  <p className="text-[var(--kokomo-mid)] text-xs font-light">Room {confirmTarget.roomNumber} · Requested: {confirmTarget.requestedDate} at {confirmTarget.requestedStartTime}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)]">Confirmed Date *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-light border-[var(--kokomo-light)] rounded-none", !confirmDate && "text-[var(--kokomo-mid)]")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {confirmDate ? format(confirmDate, "EEE, MMM d, yyyy") : "Select confirmed date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-none" align="start">
                      <Calendar
                        mode="single"
                        selected={confirmDate}
                        onSelect={(d) => {
                          setConfirmDate(d);
                          confirmForm.setValue("confirmedDate", d ? format(d, "yyyy-MM-dd") : "");
                          confirmForm.setValue("confirmedStartTime", "");
                          setCalendarOpen(false);
                        }}
                        disabled={(d) => isWeekend(d) || d < addDays(new Date(), 0)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {confirmForm.formState.errors.confirmedDate && <p className="text-destructive text-xs">{confirmForm.formState.errors.confirmedDate.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] tracking-[0.2em] uppercase text-[var(--kokomo-mid)]">Confirmed Start Time *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => confirmForm.setValue("confirmedStartTime", slot)}
                        className={cn(
                          "py-2 px-3 text-xs border transition-all duration-150 font-light tracking-wide",
                          confirmForm.watch("confirmedStartTime") === slot
                            ? "bg-[var(--kokomo-black)] text-white border-[var(--kokomo-black)]"
                            : "border-[var(--kokomo-light)] text-[var(--kokomo-black)] hover:border-[var(--kokomo-black)]"
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  {confirmForm.formState.errors.confirmedStartTime && <p className="text-destructive text-xs">{confirmForm.formState.errors.confirmedStartTime.message}</p>}
                </div>

                <p className="text-[10px] tracking-wide text-[var(--kokomo-mid)] border border-[var(--kokomo-light)] p-3 font-light">
                  Upon confirmation, a Google Calendar event will be created and a confirmation email will be sent to the customer.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="rounded-none border-[var(--kokomo-light)]" onClick={() => { setConfirmTarget(null); setConfirmDate(undefined); confirmForm.reset(); }}>Cancel</Button>
                <Button type="submit" disabled={confirmMutation.isPending} className="bg-[var(--kokomo-black)] text-white rounded-none hover:bg-[var(--kokomo-mid)]">
                  {confirmMutation.isPending ? "Confirming..." : "Confirm & Notify"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <AlertDialogContent className="rounded-none border-[var(--kokomo-black)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-[var(--kokomo-black)]">Reject Booking?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--kokomo-mid)] font-light text-sm">
              Are you sure you want to reject the booking request from <strong className="text-[var(--kokomo-black)]">{rejectTarget?.customerName}</strong> for Room {rejectTarget?.roomNumber} on {rejectTarget?.requestedDate}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id })}
              className="bg-[var(--kokomo-black)] text-white rounded-none hover:bg-[var(--kokomo-mid)]"
            >
              Reject Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
