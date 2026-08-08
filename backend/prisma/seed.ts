import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.movie.count();
  if (existing > 0) {
    console.log("Seed data already present, skipping.");
    return;
  }

  const theatre = await prisma.theatre.create({
    data: {
      name: "Grand Cineplex",
      location: "Downtown",
      screens: {
        create: [{ name: "Screen 1" }, { name: "Screen 2" }],
      },
    },
    include: { screens: true },
  });

  const [screen1, screen2] = theatre.screens;

  const rows = ["A", "B", "C", "D", "E"];
  for (const screen of [screen1, screen2]) {
    for (const row of rows) {
      for (let number = 1; number <= 8; number++) {
        await prisma.seat.create({
          data: {
            screenId: screen.id,
            row,
            number,
            tier: row === "A" || row === "B" ? "PREMIUM" : "STANDARD",
          },
        });
      }
    }
  }

  const nowShowingMovies = await prisma.$transaction([
    prisma.movie.create({
      data: {
        title: "Zero to Production",
        description: "A team races to ship a booking system before the premiere.",
        durationMin: 118,
        genre: "Drama",
        rating: "8.1",
        poster: "/movies/midnight-protocol.svg",
        releaseType: "NOW_SHOWING",
      },
    }),
    prisma.movie.create({
      data: {
        title: "Concurrency Strikes Back",
        description: "One seat. A hundred requests. Only one can win.",
        durationMin: 102,
        genre: "Thriller",
        rating: "7.8",
        poster: "/movies/project-orion.svg",
        releaseType: "NOW_SHOWING",
      },
    }),
  ]);

  const newReleaseMovies = await prisma.$transaction([
    prisma.movie.create({
      data: {
        title: "Last Signal",
        description: "A lone operator picks up a transmission that shouldn't exist.",
        durationMin: 109,
        genre: "Sci-Fi",
        rating: "7.5",
        poster: "/movies/last-signal.svg",
        releaseType: "NEW_RELEASE",
        releaseDate: new Date(),
      },
    }),
    prisma.movie.create({
      data: {
        title: "Harbor of Echoes",
        description: "A coastal town confronts a decades-old secret.",
        durationMin: 124,
        genre: "Mystery",
        rating: "8.4",
        poster: "/movies/harbor-of-echoes.svg",
        releaseType: "NEW_RELEASE",
        releaseDate: new Date(),
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.movie.create({
      data: {
        title: "Dhaka After Dark",
        description: "The city never sleeps, and neither does its underworld.",
        durationMin: 131,
        genre: "Action",
        rating: "TBA",
        poster: "/movies/dhaka-after-dark.svg",
        releaseType: "COMING_SOON",
        releaseDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    }),
  ]);

  const bookableMovies = [...nowShowingMovies, ...newReleaseMovies];

  const now = new Date();
  const showtimes = [];
  for (const [movieIndex, movie] of bookableMovies.entries()) {
    for (const screen of [screen1, screen2]) {
      const startsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * (1 + movieIndex));
      const showtime = await prisma.showtime.create({
        data: {
          movieId: movie.id,
          screenId: screen.id,
          startsAt,
          price: 450,
        },
      });
      showtimes.push(showtime);

      const seats = await prisma.seat.findMany({ where: { screenId: screen.id } });
      await prisma.showSeat.createMany({
        data: seats.map((seat) => ({
          showtimeId: showtime.id,
          seatId: seat.id,
          status: "AVAILABLE",
        })),
      });
    }
  }

  console.log(`Seeded ${bookableMovies.length + 1} movies, ${showtimes.length} showtimes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
