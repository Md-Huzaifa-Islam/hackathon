"use client";

import { createContext, useContext, useMemo } from "react";
import type { CinemaServices } from "./contracts";
import { createBookingApiService } from "./bookingApi";
import { createMovieApiService } from "./movieApi";
import { createPaymentApiService } from "./paymentApi";
import { createSeatApiService } from "./seatApi";
import { createShowApiService } from "./showApi";

const CinemaServicesContext = createContext<CinemaServices | null>(null);

function createCinemaServices(): CinemaServices {
  return {
    movies: createMovieApiService(),
    shows: createShowApiService(),
    seats: createSeatApiService(),
    bookings: createBookingApiService(),
    payments: createPaymentApiService(),
  };
}

export function CinemaServicesProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => createCinemaServices(), []);

  return (
    <CinemaServicesContext.Provider value={services}>
      {children}
    </CinemaServicesContext.Provider>
  );
}

export function useCinemaServices() {
  const services = useContext(CinemaServicesContext);

  if (!services) {
    throw new Error("useCinemaServices must be used within CinemaServicesProvider");
  }

  return services;
}
