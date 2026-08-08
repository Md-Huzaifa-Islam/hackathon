import { Alert, AlertTitle } from "@/components/ui/alert";
import type { PaymentStatus as PaymentStatusType } from "@/types";

const COPY: Record<PaymentStatusType, string> = {
  IDLE: "Waiting to start payment.",
  PENDING: "Processing payment...",
  SUCCEEDED: "Payment succeeded.",
  FAILED: "Payment failed. You can retry.",
};

export function PaymentStatus({ status }: { status: PaymentStatusType }) {
  return (
    <Alert>
      <AlertTitle>{COPY[status]}</AlertTitle>
    </Alert>
  );
}
