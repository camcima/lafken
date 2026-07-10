# Admin console

The admin console at `apps/web` is the primary human interface to a
Lafken deployment. It dogfoods the SDK packages: every screen is a
thin React Query layer over `@lafken/client`.

Lafken v1.0 ships **two audiences**: operator and reviewer. The
developer audience (API explorer, SDK playground) is deferred.

## Operator (`lafken_platform_operator`)

The operator runs the platform.

| Section          | Purpose                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namespaces       | List, create, archive, unarchive namespaces. Detail page exposes overview, policy, and presets tabs. The namespace overview links to the global Assets page filtered by the namespace. |
| Policies         | Create new policy versions with content-moderation rules. The active version per namespace is the one the processing pipeline uses.                                                    |
| Presets          | Create new preset versions with imgproxy transform parameters. Set the active version per `(namespace, preset name)` pair.                                                             |
| Storage bindings | CRUD for the GCS bucket bindings used by namespaces.                                                                                                                                   |
| Assets           | Global search across namespaces. Drill into an asset for state transitions, analyses, processing-job history, and a one-click retry for `processing_failed`.                           |
| Integrations     | Read-only view of configured ports and adapters (virus-scan provider, moderation provider, OIDC issuer).                                                                               |
| Audit            | Configuration audit log with substring search and entity-type filter. Includes asset-upload events and signed-URL refreshes.                                                           |
| Health           | Liveness, readiness, and dependency status (DB, GCS, ClamAV, OIDC).                                                                                                                    |

## Reviewer (`lafken_content_reviewer`)

Reviewers handle quarantined content and place legal holds.

| Section     | Purpose                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quarantine  | List `quarantined_virus` and `quarantined_moderation` assets. Release (transitions to `ready`) or reject (transitions to `rejected`) with a required note.        |
| Legal holds | Place a hold on an asset (preventing further state changes), list active holds, lift a hold with a required note. Lift and place actions appear in the audit log. |

## Roles and routes

The web app's `AuthGuard` enforces role-based access at the route
level. A user without the required role sees a "not authorized" page
rather than a hidden link.

| Role                           | Reaches                                         |
| ------------------------------ | ----------------------------------------------- |
| `lafken_platform_operator`     | All operator sections.                          |
| `lafken_content_reviewer`      | Quarantine, legal holds.                        |
| `lafken_application_developer` | Read-only platform access.                      |
| `lafken_asset_deleter`         | Asset deletion action on the asset detail page. |
| `lafken_legal_hold_admin`      | Legal-hold place / lift.                        |

In addition to the route-level `AuthGuard`, sensitive **read** endpoints are
enforced server-side: `GET /v1/audit` and all `GET /v1/system/*` endpoints
require `lafken_platform_operator`; `GET /v1/legal-holds` and
`GET /v1/legal-holds/:id` require one of `lafken_legal_hold_admin`,
`lafken_platform_operator`, or `lafken_content_reviewer`. Any valid token
without the required role receives an RFC 9457 403.

The mock OIDC adapter (set `AUTH_PROVIDER=mock` on the backend and
`VITE_AUTH_PROVIDER=mock` on the web app) grants every role to the
bearer `test-token`. Tests narrow this via the `x-test-roles` header.

## Identifier display

Admin URLs and routes use the internal `id` (uuidv7); page UIs show
the external `publicId` (uuidv4). External endpoints continue to use
`publicId`. See `docs/adr/0001-pk-strategy.md`.

## Deferred for v1.0

- Developer audience (API explorer, SDK playground).
- Quotas / rate-limiting screens.
- Configuration export / import screens.
- Evidentiary export.
- CSV exports across the audit log (already removed).
