#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE cryptosight_app LOGIN PASSWORD %L', :'app_password') \gexec
GRANT CONNECT ON DATABASE cryptosight TO cryptosight_app;
GRANT USAGE ON SCHEMA public TO cryptosight_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cryptosight_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cryptosight_app;
SQL
