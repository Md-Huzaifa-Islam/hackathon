import { Router } from "express";
import { healthRouter } from "@/routes/health.routes.js";
import { moviesRouter } from "@/routes/movies.routes.js";
import { showtimesRouter } from "@/routes/showtimes.routes.js";
import { bookingsRouter } from "@/routes/bookings.routes.js";
import { paymentsRouter } from "@/routes/payments.routes.js";
import { otpRouter } from "@/routes/otp.routes.js";

export const router = Router();

router.use(healthRouter);
router.use(moviesRouter);
router.use(showtimesRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(otpRouter);
