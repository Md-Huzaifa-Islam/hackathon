"use client";

import { createContext, useContext, useMemo } from "react";
import type { CinemaServices } from "./contracts";
import { createBookingApiService } from "./bookingApi";
import { createMovieApiService } from "./movieApi";
import { createPaymentApiService } from "./paymentApi";
import { createSeatApiService } from "./seatApi";
import { createShowApiService } from "./showApi";
import { createMockBookingService } from "./mock/mockBookingApi";
import { createMockMovieService } from "./mock/mockMovieApi";
import { createMockPaymentService } from "./mock/mockPaymentApi";
import { createMockSeatService } from "./mock/mockSeatApi";
import { createMockShowService } from "./mock/mockShowApi";
import type { RuntimeConfig } from "./runtime";

const CinemaServicesContext = createContext<CinemaServices | null>(null);

function createCinemaServices(config: RuntimeConfig): CinemaServices {
  if (config.dataMode === "api") {
    return {
      movies: createMovieApiService(config),
      shows: createShowApiService(config),
      seats: createSeatApiService(config),
      bookings: createBookingApiService(config),
      payments: createPaymentApiService(config),
    };
  }

  return {
    movies: createMockMovieService(config),
    shows: createMockShowService(config),
    seats: createMockSeatService(config),
    bookings: createMockBookingService(config),
    payments: createMockPaymentService(config),
  };
}

export function CinemaServicesProvider({
  config,
  children,
}: {
  config: RuntimeConfig;
  children: React.ReactNode;
}) {
  const services = useMemo(() => createCinemaServices(config), [config]);

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