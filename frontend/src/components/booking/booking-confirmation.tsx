import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Booking } from "@/types";

export function BookingConfirmation({ booking }: { booking: Booking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking confirmed</CardTitle>
      </CardHeader>
      <CardContent className="font-mono text-lg">
        {booking.reference ?? booking.id}
      </CardContent>
    </Card>
  );
}
