# Supply Chain Security

Configuration applied in `pnpm-workspace.yaml` to mitigate supply chain attacks across the monorepo.

Reference: <https://pnpm.io/supply-chain-security>

## Why This Matters

npm ecosystem packages can execute arbitrary scripts during installation (`preinstall`, `install`, `postinstall`). A single compromised dependency — direct or transitive — can exfiltrate secrets, install backdoors, or tamper with build artifacts. The settings below reduce that attack surface.

## Decisions

### 1. Explicit Build Allowlist (`allowBuilds`)

**Decision:** Replace the `onlyBuiltDependencies` list with the `allowBuilds` map and explicitly set every entry to `true` or `false`.

**Reason:** `allowBuilds` is the newer, unified replacement for both `onlyBuiltDependencies` and `ignoredBuiltDependencies`. The map format makes intent clear — reviewers can see at a glance which packages are trusted to run scripts and which are explicitly blocked (e.g., `@scarf/scarf: false` blocks analytics telemetry that has no functional purpose).

**Effect:** Any dependency not listed in the map is blocked from running lifecycle scripts by default.

### 2. Strict Build Script Review (`strictDepBuilds: true`)

**Decision:** Fail installation when unreviewed build scripts are detected.

**Reason:** Without this, pnpm silently skips unreviewed scripts, which can mask newly added install hooks from dependency updates. With `strictDepBuilds`, the CI pipeline and every developer machine will halt on unreviewed scripts, forcing an explicit allow/deny decision before proceeding.

### 3. Block Exotic Subdependencies (`blockExoticSubdeps: true`)

**Decision:** Prevent transitive dependencies from resolving to git repositories, tarball URLs, or other non-registry sources.

**Reason:** A malicious actor who compromises a transitive dependency could point it at an attacker-controlled git repo or tarball. Blocking exotic specifiers for anything beyond direct dependencies ensures the full transitive tree resolves only from the configured registry, where packages are at least subject to registry-level integrity checks.

### 4. Minimum Release Age (`minimumReleaseAge: 4320`)

**Decision:** Refuse to install any package version published less than 3 days (4 320 minutes) ago.

**Reason:** Most compromised packages are detected and pulled within hours to a few days of publication. A 3-day quarantine period lets the community flag malicious releases before they reach our lockfile. This does not affect versions already pinned in `pnpm-lock.yaml` — it only applies when resolving new versions.

**Trade-off:** Bleeding-edge updates are delayed by 3 days. For urgent security patches, a developer can temporarily add the package to `minimumReleaseAgeExclude`, update the lockfile, and remove the exclusion.

### 4a. Trusted Publisher Exclusions (`minimumReleaseAgeExclude`)

**Decision:** Exempt packages from well-known, trusted publishers from the 3-day quarantine.

**Reason:** Not all publishers carry equal risk. Organizations like Google, Microsoft, Meta, Vercel, and the OpenTelemetry/Grafana/NestJS foundations maintain dedicated security teams, use npm provenance/signing, and follow responsible disclosure practices. Delaying a critical security patch from these publishers by 3 days is likely more dangerous than installing it immediately.

**Criteria for inclusion:** A package or scope is added to the exclusion list when it meets **all** of the following:

1. **Known publisher** — maintained by a recognizable organization or widely adopted OSS project.
2. **Security track record** — no history of supply chain incidents, or incidents were handled transparently.
3. **Used in this project** — only packages actually in our dependency tree are listed (no speculative entries).

The list uses wildcard patterns (`@org/*`) for scoped packages where the entire organization is trusted, and individual package names for unscoped packages.

**Trade-off:** These packages bypass the quarantine window entirely. If a trusted publisher is compromised, we lose the 3-day buffer. This is accepted because the probability-weighted risk of delaying patches from these publishers exceeds the risk of immediate installation.

### 5. Trust Policy — No Downgrade (`trustPolicy: no-downgrade`)

**Decision:** Block installation if a package's trust level has decreased compared to its previous release (e.g., previously signed → now unsigned).

**Reason:** A trust-level downgrade is a strong signal of compromise — legitimate maintainers rarely remove signing or provenance from their release pipeline. Failing loudly on downgrade forces investigation before the suspect version enters the dependency tree.

### 6. Trust Policy Grace Period (`trustPolicyIgnoreAfter: 525600`)

**Decision:** Exempt packages published more than 1 year (525 600 minutes) ago from trust policy checks.

**Reason:** Many older packages predate npm's signing and provenance infrastructure. Without this exemption, `trustPolicy: no-downgrade` would flag every legacy dependency that was never signed. The 1-year window focuses enforcement on the actively maintained portion of the tree where trust metadata is expected.

## Maintenance

When adding a dependency that runs install scripts:

1. Run `pnpm install` — it will fail with a message naming the package.
2. Evaluate whether the build script is necessary and safe.
3. Add the package to `allowBuilds` in `pnpm-workspace.yaml` with `true` (allow) or `false` (suppress).
4. Commit the change alongside the dependency addition so reviewers can assess the decision.

When a new package version is blocked by `minimumReleaseAge`:

1. Wait for the quarantine period to expire (preferred).
2. If the package is from a trusted publisher (see criteria in section 4a), add it permanently to `minimumReleaseAgeExclude` and commit the change.
3. For one-off urgent cases from untrusted publishers, add it temporarily, update the lockfile, then remove the exclusion and commit.

When adding a new dependency from a trusted organization:

1. If the org scope (e.g., `@neworg/*`) is already in `minimumReleaseAgeExclude`, no action needed.
2. If not, evaluate the publisher against the criteria in section 4a before adding an exclusion.
