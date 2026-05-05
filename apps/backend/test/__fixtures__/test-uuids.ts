/**
 * Hard-coded UUID strings for deterministic test fixtures. Tests assert on
 * equality, not on UUID format — these are arbitrary but valid v7-shaped strings.
 *
 * Pick from this pool to keep fixtures stable. If you need more, append rather
 * than reusing — keeps test data unambiguous when reading failure messages.
 */
export const TEST_UUIDS = {
  storageBinding1: "01900000-0000-7000-8000-000000000001",
  storageBinding2: "01900000-0000-7000-8000-000000000002",
  namespace1: "01900000-0000-7000-8000-000000000010",
  namespace2: "01900000-0000-7000-8000-000000000011",
  namespace3: "01900000-0000-7000-8000-000000000012",
  policy1: "01900000-0000-7000-8000-000000000020",
  policy2: "01900000-0000-7000-8000-000000000021",
  preset1: "01900000-0000-7000-8000-000000000030",
  asset1: "01900000-0000-7000-8000-000000000040",
  asset2: "01900000-0000-7000-8000-000000000041",
  legalHold1: "01900000-0000-7000-8000-000000000050",
  auditEntry1: "01900000-0000-7000-8000-000000000060",
} as const;
