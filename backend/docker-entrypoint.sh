#!/bin/sh
set -e

echo "Waiting for database and applying migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx tsx prisma/seed.ts

echo "Starting server..."
exec "$@"
