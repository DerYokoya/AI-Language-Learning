set -a
source .env
set +a
psql "$DATABASE_URL" -f src/db/schema.sql