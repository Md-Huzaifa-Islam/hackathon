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

  const movies = await prisma.$transaction([
    prisma.movie.create({
      data: {
        title: "Zero to Production",
        description: "A team races to ship a booking system before the premiere.",
        durationMin: 118,
        genre: "Drama",
      },
    }),
    prisma.movie.create({
      data: {
        title: "Concurrency Strikes Back",
        description: "One seat. A hundred requests. Only one can win.",
        durationMin: 102,
        genre: "Thriller",
      },
    }),
  ]);

  const now = new Date();
  const showtimes = [];
  for (const movie of movies) {
    for (const screen of [screen1, screen2]) {
      const startsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
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

  console.log(`Seeded ${movies.length} movies, ${showtimes.length} showtimes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
