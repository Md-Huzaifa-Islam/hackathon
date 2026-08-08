import { Router } from "express";
import { prisma } from "@/lib/prisma.js";

export const moviesRouter = Router();

moviesRouter.get("/movies", async (_req, res) => {
  const movies = await prisma.movie.findMany();
  res.json(movies);
});

moviesRouter.get("/movies/:id/showtimes", async (req, res) => {
  const showtimes = await prisma.showtime.findMany({
    where: { movieId: req.params.id },
    include: { screen: { include: { theatre: true } } },
  });
  res.json(showtimes);
});
