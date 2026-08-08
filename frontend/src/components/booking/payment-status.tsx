import { Alert, AlertTitle } from "@/components/ui/alert";
import type { BookingStatus, PaymentStatus as PaymentStatusType } from "@/types";

const COPY: Record<PaymentStatusType | BookingStatus, string> = {
  IDLE: "Waiting to start payment.",
  PENDING: "Processing payment...",
  SUCCEEDED: "Payment succeeded.",
  FAILED: "Payment failed. You can retry.",
  REFUNDED: "Payment refunded.",
  CONFIRMED: "Booking confirmed.",
  CANCELLED: "Booking cancelled.",
  EXPIRED: "Your booking expired.",
};

export function PaymentStatus({ status }: { status: PaymentStatusType | BookingStatus }) {
  return (
    <Alert>
      <AlertTitle>{COPY[status]}</AlertTitle>
    </Alert>
  );
}
