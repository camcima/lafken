## Database guidelines

- Use English:
  - Avoid mixing Spanish and English from the old standard.
  - Facilitates integration with tools, frameworks, documentation, and external teams.
  - Improves code standardization.

- Avoid abbreviations:
  - The old standard required acronyms like `fccm`, `clnt`, `cdg`, which hinder readability.
  - Prefer full and clear names such as `customer_id` or `issue_date`.
  - This favors understanding for new members and for BI and analytics teams.

- Avoid prefixes in column names:
  - Prefixes based on the table no longer add real value.
  - With the standard use of aliases in SQL, ambiguity issues are resolved.
  - The model becomes cleaner and more readable.

- Explicit booleans:
  - Propose names like `is_active` or `has_discount`.
  - They are clearer than flags or numeric values.

- Always adopt `created_at` and `updated_at`:
  - `created_at` with default `CURRENT_TIMESTAMP`
  - `updated_at` updated via trigger
  - This simplifies audits, integrations, and ETL processes, without relying on application code.

- Primary key and UUID:
  - `id` bigserial as primary key for simplicity and performance.
  - `uuid` unique to expose externally without using internal IDs, which improves security and decoupling.
