// apps/web/src/lib/demo/lafken-demo-data.ts
//
// Demo data used by Slice 0 pages while the backend returns empty arrays.
// All data is FE-only mock content; replace with live API responses as
// the BE matures.

// ── Namespaces ────────────────────────────────────────────

export interface DemoNamespace {
  slug: string;
  displayName: string;
  policyVersion: number;
  retention: string;
  maxBytes: string;
  required: string[];
  moderation: boolean;
  owner: string;
  assetCount: number;
  holdsCount: number;
  quarantine: number;
}

export const DEMO_NAMESPACES: DemoNamespace[] = [
  {
    slug: "aircraft-photos",
    displayName: "Aircraft Photos",
    policyVersion: 7,
    retention: "7y",
    maxBytes: "26 MB",
    required: ["aircraft_tail", "wo_id", "inspection_type"],
    moderation: true,
    owner: "fleet-eng",
    assetCount: 1_842_311,
    holdsCount: 6,
    quarantine: 21,
  },
  {
    slug: "cargo-damage",
    displayName: "Cargo Damage Reports",
    policyVersion: 4,
    retention: "5y",
    maxBytes: "32 MB",
    required: ["awb_id", "carrier", "captured_at"],
    moderation: true,
    owner: "cargo-ops",
    assetCount: 218_904,
    holdsCount: 3,
    quarantine: 8,
  },
  {
    slug: "ground-ops-incidents",
    displayName: "Ground Ops Incidents",
    policyVersion: 3,
    retention: "10y",
    maxBytes: "32 MB",
    required: ["station_iata", "incident_id"],
    moderation: true,
    owner: "safety",
    assetCount: 49_201,
    holdsCount: 2,
    quarantine: 5,
  },
  {
    slug: "hr-documents",
    displayName: "HR Documents",
    policyVersion: 2,
    retention: "indef",
    maxBytes: "12 MB",
    required: ["employee_id", "doc_type"],
    moderation: false,
    owner: "people-ops",
    assetCount: 312_412,
    holdsCount: 1,
    quarantine: 9,
  },
  {
    slug: "passenger-claims",
    displayName: "Passenger Claims",
    policyVersion: 5,
    retention: "3y",
    maxBytes: "16 MB",
    required: ["pnr", "claim_id"],
    moderation: true,
    owner: "customer-care",
    assetCount: 78_211,
    holdsCount: 0,
    quarantine: 4,
  },
  {
    slug: "engine-borescope",
    displayName: "Engine Borescope",
    policyVersion: 2,
    retention: "20y",
    maxBytes: "120 MB",
    required: ["engine_serial", "inspection_id", "stage"],
    moderation: false,
    owner: "engineering",
    assetCount: 9_812,
    holdsCount: 0,
    quarantine: 0,
  },
];

// ── Pipeline sparkline data (Home page) ──────────────────

// Sparkline constants: 12 data points per queue, representing 30s buckets over
// the last 12 minutes. Values are raw sampled queue depths — treating them as
// individually named constants would obscure the data shape rather than clarify it.
/* eslint-disable no-magic-numbers */
export const DEMO_QUEUE_SPARKS: Record<string, number[]> = {
  validate: [120, 90, 110, 80, 90, 100, 60, 70, 90, 100, 110, 90],
  "av-scan": [10, 14, 12, 8, 10, 9, 7, 8, 10, 12, 8, 7],
  "exif-strip": [5, 4, 6, 5, 3, 4, 5, 5, 4, 5, 4, 3],
  moderate: [80, 110, 200, 320, 280, 312, 290, 312, 312, 312, 312, 312],
  transform: [800, 1200, 2400, 3800, 4500, 4800, 4811, 4810, 4811, 4811, 4811, 4811],
};
/* eslint-enable no-magic-numbers */

// ── Pipeline / queue health (Home + System) ───────────────

export interface DemoQueue {
  name: string;
  inflight: number;
  depth: number;
  p95_ms: number;
  errorRate: number;
  trend: "ok" | "warn" | "alert";
}

export const DEMO_QUEUES: DemoQueue[] = [
  { name: "validate", inflight: 312, depth: 18, p95_ms: 142, errorRate: 0.0, trend: "ok" },
  { name: "av-scan", inflight: 41, depth: 7, p95_ms: 480, errorRate: 0.001, trend: "ok" },
  { name: "exif-strip", inflight: 18, depth: 0, p95_ms: 88, errorRate: 0.0, trend: "ok" },
  { name: "moderate", inflight: 102, depth: 312, p95_ms: 1840, errorRate: 0.004, trend: "warn" },
  {
    name: "transform",
    inflight: 184,
    depth: 4_811,
    p95_ms: 2630,
    errorRate: 0.018,
    trend: "alert",
  },
];

// ── Workers ───────────────────────────────────────────────

export interface DemoWorker {
  id: string;
  region: string;
  pool: string;
  cpu: number;
  mem: number;
  inflight: number;
  uptime_d: number;
  status: "ok" | "warn" | "alert" | "down";
  version: string;
}

// Worker generation constants
const WORKER_COUNT = 24;
const WORKER_CPU_BASE = 18;
const WORKER_CPU_MOD = 7;
const WORKER_CPU_RANGE = 70;
const WORKER_MEM_BASE = 22;
const WORKER_MEM_MOD = 13;
const WORKER_MEM_RANGE = 65;
const WORKER_CPU_ALERT = 80;
const WORKER_MEM_ALERT = 85;
const WORKER_CPU_WARN = 65;
const WORKER_MEM_WARN = 70;
const WORKER_DOWN_IDX = 11;
const WORKER_REGION_MOD = 3;
const WORKER_GPU_POOL_THRESHOLD = 16;
const WORKER_INFLIGHT_BASE = 4;
const WORKER_INFLIGHT_MOD = 3;
const WORKER_INFLIGHT_RANGE = 14;
const WORKER_UPTIME_RANGE = 21;
const WORKER_VERSION_MOD = 4;

export const DEMO_WORKERS: DemoWorker[] = Array.from({ length: WORKER_COUNT }).map((_, idx) => {
  const cpu = WORKER_CPU_BASE + ((idx * WORKER_CPU_MOD) % WORKER_CPU_RANGE);
  const mem = WORKER_MEM_BASE + ((idx * WORKER_MEM_MOD) % WORKER_MEM_RANGE);
  let status: DemoWorker["status"] = "ok";
  if (cpu > WORKER_CPU_ALERT || mem > WORKER_MEM_ALERT) status = "alert";
  else if (cpu > WORKER_CPU_WARN || mem > WORKER_MEM_WARN) status = "warn";
  if (idx === WORKER_DOWN_IDX) status = "down";
  const region =
    idx % WORKER_REGION_MOD === 0
      ? "sa-east-1a"
      : idx % WORKER_REGION_MOD === 1
        ? "sa-east-1b"
        : "sa-east-1c";
  return {
    id: "processor-" + (idx + 1).toString().padStart(2, "0"),
    region,
    pool: idx < WORKER_GPU_POOL_THRESHOLD ? "default" : "moderation-gpu",
    cpu,
    mem,
    inflight:
      status === "down"
        ? 0
        : WORKER_INFLIGHT_BASE + ((idx * WORKER_INFLIGHT_MOD) % WORKER_INFLIGHT_RANGE),
    uptime_d: status === "down" ? 0 : 1 + (idx % WORKER_UPTIME_RANGE),
    status,
    version: "lafken-worker/2.4." + String((idx % WORKER_VERSION_MOD) + 1),
  };
});

// ── Assets list ──────────────────────────────────────────

export type AssetState =
  | "ready"
  | "processing"
  | "quarantined_moderation"
  | "processing_failed"
  | "quarantined_virus"
  | "expired";

export interface DemoAsset {
  id: string;
  publicId: string;
  state: AssetState;
  namespace: string;
  tail: string;
  area: string;
  severity: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedDisplay: string;
  minutesAgo: number;
  thumbHue: number;
  hasLegalHold: boolean;
  wo: string;
}

const ASSET_STATES: AssetState[] = [
  "ready",
  "ready",
  "ready",
  "ready",
  "ready",
  "processing",
  "ready",
  "ready",
  "quarantined_moderation",
  "ready",
  "ready",
  "processing_failed",
  "ready",
  "ready",
  "ready",
  "ready",
  "ready",
  "quarantined_virus",
  "ready",
  "expired",
];

const TAILS = [
  "N12345",
  "CC-BGT",
  "CC-BGE",
  "CC-COX",
  "CC-DEG",
  "PT-MUA",
  "PT-MUB",
  "CC-BGI",
  "CC-BGM",
  "CC-BGO",
  "CC-BGP",
  "CC-BGQ",
  "CC-COZ",
  "CC-CXM",
  "CC-CXN",
  "CC-CXP",
];

const DEFECT_AREAS = [
  "landing-gear",
  "engine-cowling",
  "wing-leading-edge",
  "fuselage-aft",
  "cabin-overhead",
  "cargo-door",
  "tail-cone",
  "apu",
  "windshield",
  "cockpit",
];

const SEVERITIES = ["minor", "minor", "minor", "moderate", "moderate", "major", "minor", "minor"];

const MECHANICS = [
  "m.fernandez@latam.com",
  "p.estrada@latam.com",
  "l.tapia@latam.com",
  "r.silva@latam.com",
  "j.cordero@latam.com",
  "s.ramos@latam.com",
  "a.bravo@latam.com",
  "c.muñoz@latam.com",
  "d.morales@latam.com",
];

// LCG constants from Numerical Recipes
const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const LCG_MODULUS = 4_294_967_296;

function seedRand(seed: number): () => number {
  let state = seed;
  return (): number => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) >>> 0;
    return state / LCG_MODULUS;
  };
}

// Asset generation constants
const ASSET_COUNT = 64;
const ASSET_NAMESPACE_MOD = 4;
const ASSET_MINUTES_MAX = 7_200; // 5 days in minutes (60*24*5)
const ASSET_SIZE_MIN_MB = 0.4;
const ASSET_SIZE_RANGE_MB = 8;
const ASSET_ID_BASE = 8000;
const ASSET_ID_STEP = 37;
const ASSET_ID_RADIX = 36;
const ASSET_ID_PAD = 5;
const ASSET_HOLD_MOD = 17;
const ASSET_WO_DAY_BASE = 10;
const ASSET_WO_DAY_MOD = 20;
const ASSET_WO_NUM_MOD = 30;
const ASSET_THUMB_HUE_BASE = 14;
const ASSET_THUMB_HUE_RANGE = 30;
const BYTES_PER_MB = 1_048_576; // 1024 * 1024
const ASSET_CHARS = "ABCDEFGHJKMN";
const ASSET_CHARS_MOD = 12;
const ASSET_SEED = 42;
const ASSET_WO_SEQ_PAD = 3;

export const DEMO_ASSET_LIST: DemoAsset[] = (() => {
  const rnd = seedRand(ASSET_SEED);
  const out: DemoAsset[] = [];
  for (let idx = 0; idx < ASSET_COUNT; idx++) {
    const state = ASSET_STATES[idx % ASSET_STATES.length];
    const ns = DEMO_NAMESPACES[idx % ASSET_NAMESPACE_MOD];
    const tail = TAILS[Math.floor(rnd() * TAILS.length)];
    const minutesAgo = Math.floor(rnd() * ASSET_MINUTES_MAX);
    const sevIdx = Math.floor(rnd() * SEVERITIES.length);
    const area = DEFECT_AREAS[Math.floor(rnd() * DEFECT_AREAS.length)];
    const mech = MECHANICS[Math.floor(rnd() * MECHANICS.length)];
    const sizeMb = ASSET_SIZE_MIN_MB + rnd() * ASSET_SIZE_RANGE_MB;
    const idTail = (ASSET_ID_BASE + idx * ASSET_ID_STEP)
      .toString(ASSET_ID_RADIX)
      .toUpperCase()
      .padStart(ASSET_ID_PAD, "0");
    const id = "01HXJ" + idTail + "Q" + (ASSET_CHARS[idx % ASSET_CHARS_MOD] ?? "A");
    const woDayNum = ASSET_WO_DAY_BASE + (idx % ASSET_WO_DAY_MOD);
    const woSeqNum = ((idx % ASSET_WO_NUM_MOD) + 1).toString().padStart(ASSET_WO_SEQ_PAD, "0");
    const wo = `WO-2026-04-${String(woDayNum)}-${tail ?? ""}-${woSeqNum}`;
    const uploadedBy = mech ?? "m.fernandez@latam.com";
    out.push({
      id,
      publicId: id + "TZN9V6BQWPDX",
      state: state ?? "ready",
      namespace: ns?.slug ?? "aircraft-photos",
      tail: tail ?? "N12345",
      area: area ?? "landing-gear",
      severity: SEVERITIES[sevIdx] ?? "minor",
      sizeBytes: Math.floor(sizeMb * BYTES_PER_MB),
      uploadedBy,
      uploadedDisplay:
        uploadedBy
          .split("@")[0]
          ?.split(".")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ") ?? uploadedBy,
      minutesAgo,
      thumbHue: ASSET_THUMB_HUE_BASE + Math.floor(rnd() * ASSET_THUMB_HUE_RANGE),
      hasLegalHold: idx % ASSET_HOLD_MOD === 0,
      wo,
    });
  }
  return out;
})();

// ── Quarantine queue ─────────────────────────────────────

export interface DemoQuarantineItem {
  id: string;
  state: "quarantined_virus" | "quarantined_moderation";
  namespace: string;
  tail: string;
  reason: string;
  category: string;
  score: number;
  threshold: number;
  analyzer: string;
  uploadedBy: string;
  thumbHue: number;
  minutesAgo: number;
  sizeBytes: number;
}

// Quarantine generation constants
const QUARANTINE_COUNT = 47;
const QUARANTINE_NAMESPACE_MOD = 3;
const QUARANTINE_ID_BASE = 5000;
const QUARANTINE_ID_STEP = 41;
const QUARANTINE_MINUTES_MAX = 2_160; // 36 hours in minutes (60*36)
const QUARANTINE_SIZE_MIN_MB = 0.5;
const QUARANTINE_SIZE_RANGE_MB = 6;
const QUARANTINE_THUMB_HUE_BASE = 15;
const QUARANTINE_THUMB_HUE_RANGE = 30;
const QUARANTINE_SEED = 7;

export const DEMO_QUARANTINE: DemoQuarantineItem[] = (() => {
  const rnd = seedRand(QUARANTINE_SEED);
  const out: DemoQuarantineItem[] = [];

  interface IFlag {
    reason: string;
    category: string;
    score: number;
    threshold: number;
    analyzer: string;
  }

  const flags: IFlag[] = [
    {
      reason: "moderation: violence 0.78",
      category: "violence",
      score: 0.78,
      threshold: 0.65,
      analyzer: "moderation-v2",
    },
    {
      reason: "moderation: medical 0.72",
      category: "medical",
      score: 0.72,
      threshold: 0.65,
      analyzer: "moderation-v2",
    },
    {
      reason: "moderation: violence 0.69",
      category: "violence",
      score: 0.69,
      threshold: 0.65,
      analyzer: "moderation-v2",
    },
    {
      reason: "moderation: gore 0.81",
      category: "gore",
      score: 0.81,
      threshold: 0.65,
      analyzer: "moderation-v2",
    },
    {
      reason: "moderation: adult 0.91 (false-positive suspected)",
      category: "adult",
      score: 0.91,
      threshold: 0.65,
      analyzer: "moderation-v2",
    },
    {
      reason: "av-scan: heuristic match (Win.Trojan.Test)",
      category: "virus",
      score: 1.0,
      threshold: 0,
      analyzer: "clamav",
    },
  ];

  for (let idx = 0; idx < QUARANTINE_COUNT; idx++) {
    const flag = flags[Math.floor(rnd() * flags.length)];
    const ns = DEMO_NAMESPACES[Math.floor(rnd() * QUARANTINE_NAMESPACE_MOD)];
    const tail = TAILS[Math.floor(rnd() * TAILS.length)];
    const idTail = (QUARANTINE_ID_BASE + idx * QUARANTINE_ID_STEP)
      .toString(ASSET_ID_RADIX)
      .toUpperCase()
      .padStart(ASSET_ID_PAD, "0");
    const id = "01HXJ" + idTail + "QZ";
    const minutesAgo = Math.floor(rnd() * QUARANTINE_MINUTES_MAX);
    if (!flag || !ns || !tail) continue;
    out.push({
      id,
      state: flag.category === "virus" ? "quarantined_virus" : "quarantined_moderation",
      namespace: ns.slug,
      tail,
      reason: flag.reason,
      category: flag.category,
      score: flag.score,
      threshold: flag.threshold,
      analyzer: flag.analyzer,
      uploadedBy: MECHANICS[Math.floor(rnd() * MECHANICS.length)] ?? "m.fernandez@latam.com",
      thumbHue: QUARANTINE_THUMB_HUE_BASE + Math.floor(rnd() * QUARANTINE_THUMB_HUE_RANGE),
      minutesAgo,
      sizeBytes: Math.floor(
        (QUARANTINE_SIZE_MIN_MB + rnd() * QUARANTINE_SIZE_RANGE_MB) * BYTES_PER_MB,
      ),
    });
  }
  return out;
})();

// ── Legal holds ──────────────────────────────────────────

export interface DemoLegalHold {
  id: string;
  caseRef: string;
  scope: string;
  scopeLabel: string;
  assets: number;
  placedBy: string;
  placedAt: string;
  reason: string;
  lastReviewed: string;
  status: "active" | "pending_release";
}

export const DEMO_LEGAL_HOLDS: DemoLegalHold[] = [
  {
    id: "lh_01HX2K7P8R",
    caseRef: "CHL-2026-AVN-014",
    scope: "work_order",
    scopeLabel: "WO-2026-04-29-N12345-018",
    assets: 38,
    placedBy: "l.tapia@latam.com",
    placedAt: "2026-04-30T14:22Z",
    reason: "DGAC investigation — landing gear inspection imagery",
    lastReviewed: "2026-05-01T09:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K8AAS",
    caseRef: "CHL-2026-AVN-008",
    scope: "namespace",
    scopeLabel: "aircraft-photos · 2026-03 partition",
    assets: 1_241,
    placedBy: "j.cordero@latam.com",
    placedAt: "2026-03-12T11:08Z",
    reason: "Maintenance audit by DGAC, retention extension required.",
    lastReviewed: "2026-04-15T11:08Z",
    status: "active",
  },
  {
    id: "lh_01HX2K88PR",
    caseRef: "BR-CIV-2026-021",
    scope: "uploader_window",
    scopeLabel: "user:r.silva@latam.com · 2026-04-20 → 2026-04-21",
    assets: 47,
    placedBy: "j.cordero@latam.com",
    placedAt: "2026-04-21T16:45Z",
    reason: "Internal disciplinary review.",
    lastReviewed: "2026-04-22T10:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K85RY",
    caseRef: "CHL-2025-AVN-099",
    scope: "asset",
    scopeLabel: "01HXJ8K3QF…",
    assets: 1,
    placedBy: "l.tapia@latam.com",
    placedAt: "2025-11-04T08:30Z",
    reason: "Personal injury claim. Counsel: Larrain Vial.",
    lastReviewed: "2026-01-05T10:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K7T80",
    caseRef: "PE-LAB-2026-003",
    scope: "namespace",
    scopeLabel: "hr-documents · uploader:c.muñoz",
    assets: 312,
    placedBy: "people-ops-bot",
    placedAt: "2026-02-18T09:15Z",
    reason: "Active labor dispute (Lima).",
    lastReviewed: "2026-04-30T09:15Z",
    status: "active",
  },
  {
    id: "lh_01HX2K7AB1",
    caseRef: "CO-CIV-2025-441",
    scope: "work_order",
    scopeLabel: "WO-2025-12-04-PT-MUA-091",
    assets: 22,
    placedBy: "j.cordero@latam.com",
    placedAt: "2025-12-05T17:20Z",
    reason: "Cargo damage litigation (Bogotá).",
    lastReviewed: "2026-03-28T09:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K78XR",
    caseRef: "CHL-2026-PAX-002",
    scope: "asset",
    scopeLabel: "01HXJ8K28S…",
    assets: 1,
    placedBy: "customer-care-bot",
    placedAt: "2026-01-22T13:10Z",
    reason: "Passenger injury claim.",
    lastReviewed: "2026-04-22T13:10Z",
    status: "active",
  },
  {
    id: "lh_01HX2K6MM5",
    caseRef: "CHL-2026-AVN-019",
    scope: "asset",
    scopeLabel: "01HXJ8K2ZZ…",
    assets: 1,
    placedBy: "l.tapia@latam.com",
    placedAt: "2026-04-12T08:00Z",
    reason: "Component failure investigation.",
    lastReviewed: "2026-04-13T08:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K5RXX",
    caseRef: "AR-LAB-2026-007",
    scope: "namespace",
    scopeLabel: "hr-documents · station:EZE",
    assets: 89,
    placedBy: "people-ops-bot",
    placedAt: "2026-02-04T17:00Z",
    reason: "Argentinian labor inspection.",
    lastReviewed: "2026-04-05T17:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K4G8K",
    caseRef: "BR-LIT-2026-014",
    scope: "work_order",
    scopeLabel: "WO-2026-02-20-PT-MUB-003",
    assets: 16,
    placedBy: "j.cordero@latam.com",
    placedAt: "2026-02-21T07:45Z",
    reason: "São Paulo civil litigation.",
    lastReviewed: "2026-04-21T07:45Z",
    status: "active",
  },
  {
    id: "lh_01HX2K3ZRR",
    caseRef: "CHL-2026-AVN-005",
    scope: "work_order",
    scopeLabel: "WO-2026-01-15-CC-BGT-022",
    assets: 28,
    placedBy: "l.tapia@latam.com",
    placedAt: "2026-01-16T14:00Z",
    reason: "Bird strike investigation.",
    lastReviewed: "2026-04-16T14:00Z",
    status: "active",
  },
  {
    id: "lh_01HX2K2AYR",
    caseRef: "CHL-2025-AVN-077",
    scope: "asset",
    scopeLabel: "01HXJ7Z9PP…",
    assets: 1,
    placedBy: "l.tapia@latam.com",
    placedAt: "2025-09-08T10:00Z",
    reason: "Closed by counsel — pending lift.",
    lastReviewed: "2026-04-30T10:00Z",
    status: "pending_release",
  },
];

// ── Audit log ────────────────────────────────────────────

export type AuditResult = "ok" | "fail";

export interface DemoAuditEntry {
  id: string;
  type: string;
  actor: string;
  target: string;
  namespace: string;
  ip: string;
  minutesAgo: number;
  result: AuditResult;
}

const AUDIT_TYPES = [
  "asset.uploaded",
  "asset.processing.started",
  "asset.processing.failed",
  "asset.ready",
  "asset.quarantined",
  "asset.deleted",
  "asset.expired",
  "legal_hold.placed",
  "legal_hold.lifted",
  "policy.updated",
  "namespace.created",
  "user.role_assigned",
  "api_key.created",
  "api_key.rotated",
  "review.approved",
  "review.rejected",
  "review.escalated",
  "export.generated",
];

// Audit generation constants
const AUDIT_COUNT = 78;
const AUDIT_MINUTES_STEP = 7;
const AUDIT_MINUTES_JITTER = 5;
const AUDIT_WORKER_THRESHOLD = 0.6;
const AUDIT_WORKER_COUNT = 24;
const AUDIT_NAMESPACE_MOD = 4;
const AUDIT_IP_WORKER_BASE = 10;
const AUDIT_IP_WORKER_MOD = 90;
const AUDIT_IP_INET_OCT1 = 10;
const AUDIT_IP_INET_MOD1 = 80;
const AUDIT_IP_INET_MOD2 = 200;
const AUDIT_IP_INET_MULT3 = 17;
const AUDIT_IP_INET_MOD3 = 250;
const AUDIT_SEED = 3;
const AUDIT_TARGET_ID_PAD = 3;
const AUDIT_ID_PAD = 8;

export const DEMO_AUDIT: DemoAuditEntry[] = (() => {
  const rnd = seedRand(AUDIT_SEED);
  const out: DemoAuditEntry[] = [];
  for (let idx = 0; idx < AUDIT_COUNT; idx++) {
    const eventType = AUDIT_TYPES[Math.floor(rnd() * AUDIT_TYPES.length)] ?? "asset.uploaded";
    const minutesAgo = idx * AUDIT_MINUTES_STEP + Math.floor(rnd() * AUDIT_MINUTES_JITTER);
    const isWorker = rnd() > AUDIT_WORKER_THRESHOLD;
    const actor = isWorker
      ? `worker:processor-${String(Math.floor(rnd() * AUDIT_WORKER_COUNT) + 1).padStart(2, "0")}`
      : (MECHANICS[Math.floor(rnd() * MECHANICS.length)] ?? "m.fernandez@latam.com");
    const ns = DEMO_NAMESPACES[Math.floor(rnd() * AUDIT_NAMESPACE_MOD)]?.slug ?? "aircraft-photos";
    const targetId = idx.toString(ASSET_ID_RADIX).toUpperCase();
    const target = eventType.includes("legal_hold")
      ? "lh_01HX" + targetId
      : "01HXJ8K" + targetId.padStart(AUDIT_TARGET_ID_PAD, "0") + "QF";
    const ip = actor.startsWith("worker:")
      ? "10.32.0." + String(AUDIT_IP_WORKER_BASE + (idx % AUDIT_IP_WORKER_MOD))
      : "190." +
        String(AUDIT_IP_INET_OCT1 + (idx % AUDIT_IP_INET_MOD1)) +
        "." +
        String(idx % AUDIT_IP_INET_MOD2) +
        "." +
        String((idx * AUDIT_IP_INET_MULT3) % AUDIT_IP_INET_MOD3);
    out.push({
      id: "evt_" + String(idx + 1).padStart(AUDIT_ID_PAD, "0"),
      type: eventType,
      actor,
      target,
      namespace: ns,
      ip,
      minutesAgo,
      result: eventType.includes("failed") || eventType.includes("rejected") ? "fail" : "ok",
    });
  }
  return out;
})();

// ── Members (Settings) ────────────────────────────────────

export interface DemoMember {
  name: string;
  email: string;
  role: string;
  lastActive: string;
  mfa: boolean;
  scope: string;
}

export const DEMO_MEMBERS: DemoMember[] = [
  {
    name: "Paula Estrada",
    email: "p.estrada@latam.com",
    role: "Platform operator",
    lastActive: "now",
    mfa: true,
    scope: "all namespaces",
  },
  {
    name: "Lucía Tapia",
    email: "l.tapia@latam.com",
    role: "Legal/Compliance",
    lastActive: "12m ago",
    mfa: true,
    scope: "all (legal hold + audit)",
  },
  {
    name: "Jorge Cordero",
    email: "j.cordero@latam.com",
    role: "Reviewer",
    lastActive: "3h ago",
    mfa: true,
    scope: "aircraft-photos, cargo-damage",
  },
  {
    name: "Mariana Fernández",
    email: "m.fernandez@latam.com",
    role: "Uploader (mechanic)",
    lastActive: "8h ago",
    mfa: false,
    scope: "aircraft-photos",
  },
  {
    name: "Sergio Ramos",
    email: "s.ramos@latam.com",
    role: "Reviewer",
    lastActive: "1d ago",
    mfa: true,
    scope: "aircraft-photos",
  },
  {
    name: "Ricardo Silva",
    email: "r.silva@latam.com",
    role: "Uploader (mechanic)",
    lastActive: "1d ago",
    mfa: true,
    scope: "aircraft-photos",
  },
  {
    name: "Camila Muñoz",
    email: "c.munoz@latam.com",
    role: "Uploader (HR)",
    lastActive: "2d ago",
    mfa: true,
    scope: "hr-documents",
  },
];

// ── API Keys (Settings) ───────────────────────────────────

export interface DemoApiKey {
  id: string;
  label: string;
  scopes: string;
  lastUsed: string;
  rotates: string;
  createdBy: string;
  status: "active" | "revoked";
}

export const DEMO_API_KEYS: DemoApiKey[] = [
  {
    id: "key_01HX9",
    label: "wo-app-prod-ios",
    scopes: "aircraft-photos:write",
    lastUsed: "2m ago",
    rotates: "2026-08-12",
    createdBy: "p.estrada",
    status: "active",
  },
  {
    id: "key_01HX8",
    label: "wo-app-prod-android",
    scopes: "aircraft-photos:write",
    lastUsed: "4m ago",
    rotates: "2026-08-12",
    createdBy: "p.estrada",
    status: "active",
  },
  {
    id: "key_01HX7",
    label: "cargo-portal-prod",
    scopes: "cargo-damage:write",
    lastUsed: "12m ago",
    rotates: "2026-09-30",
    createdBy: "p.estrada",
    status: "active",
  },
  {
    id: "key_01HX6",
    label: "data-warehouse-export",
    scopes: "*:read, *:audit",
    lastUsed: "1h ago",
    rotates: "2026-12-01",
    createdBy: "p.estrada",
    status: "active",
  },
  {
    id: "key_01HX5",
    label: "people-ops-uploader",
    scopes: "hr-documents:write",
    lastUsed: "5h ago",
    rotates: "2026-09-01",
    createdBy: "people-ops-admin",
    status: "active",
  },
  {
    id: "key_01HX4",
    label: "wo-app-prod-ios (pre-rotation)",
    scopes: "aircraft-photos:write",
    lastUsed: "32d ago",
    rotates: "—",
    createdBy: "p.estrada",
    status: "revoked",
  },
];

// ── State definitions ─────────────────────────────────────

export type StateTone = "muted" | "info" | "ok" | "warn" | "alert" | "danger" | "ghost";

export interface DemoStateDef {
  label: string;
  short?: string;
  tone: StateTone;
  dot: string;
}

export const DEMO_STATE_DEFS: Record<string, DemoStateDef> = {
  pending: { label: "Pending", tone: "muted", dot: "#94a3b8" },
  uploaded: { label: "Uploaded", tone: "muted", dot: "#94a3b8" },
  processing: { label: "Processing", tone: "info", dot: "#0e7ea8" },
  ready: { label: "Ready", tone: "ok", dot: "#1f7a4f" },
  rejected: { label: "Rejected", tone: "warn", dot: "#a16207" },
  quarantined_virus: { label: "Virus", short: "Virus", tone: "alert", dot: "#8A4209" },
  quarantined_moderation: {
    label: "Moderation",
    short: "Moderation",
    tone: "alert",
    dot: "#8A4209",
  },
  processing_failed: { label: "Failed", short: "Failed", tone: "danger", dot: "#8B271A" },
  expired: { label: "Expired", tone: "ghost", dot: "#cbd5e1" },
  deleted: { label: "Deleted", tone: "ghost", dot: "#cbd5e1" },
};

// ── Home page demo constants ─────────────────────────────

/** Case reference shown in the "hold pending release" attention row on the Home page. */
export const DEMO_PENDING_HOLD_CASE_REF = "CHL-2025-AVN-077";

// ── Time helpers ─────────────────────────────────────────

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

/**
 * Format a number of minutes ago into a human-readable string.
 * E.g. 5 → "5m ago", 90 → "1h ago", 1440 → "1d ago".
 */
export function fmtAgo(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return String(minutes) + "m ago";
  if (minutes < MINUTES_PER_DAY) return String(Math.floor(minutes / MINUTES_PER_HOUR)) + "h ago";
  return String(Math.floor(minutes / MINUTES_PER_DAY)) + "d ago";
}

/**
 * Like fmtAgo but returns "just now" for values under 1 minute.
 */
export function fmtMinAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < MINUTES_PER_HOUR) return String(minutes) + "m ago";
  if (minutes < MINUTES_PER_DAY) return String(Math.floor(minutes / MINUTES_PER_HOUR)) + "h ago";
  return String(Math.floor(minutes / MINUTES_PER_DAY)) + "d ago";
}
