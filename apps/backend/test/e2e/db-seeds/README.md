# Seeds for Test Database

The files in this directory are SQL files that will run when running `pnpm test-db-seed:up` in order to populate the database defined at `.env.test` that are mandatory to E2E tests.

The files must follow the naming convention: `00x-short_title.sql` (eg: `001-add_users.sql`)
