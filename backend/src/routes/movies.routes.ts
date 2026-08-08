import { Router } from "express";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/asyncHandler.js";

export const moviesRouter = Router();

moviesRouter.get("/movies", asyncHandler(async (_req, res) => {
  const movies = await prisma.movie.findMany();
  res.json(movies);
}));

moviesRouter.get("/movies/:id", asyncHandler(async (req, res) => {
  const movie = await prisma.movie.findUnique({ where: { id: req.params.id } });
  if (!movie) {
    return res.status(404).json({ error: "movie_not_found" });
  }
  res.json(movie);
}));

moviesRouter.get("/movies/:id/showtimes", asyncHandler(async (req, res) => {
  const showtimes = await prisma.showtime.findMany({
    where: { movieId: req.params.id },
    include: { screen: { include: { theatre: true } } },
  });
  res.json(showtimes);
}));
