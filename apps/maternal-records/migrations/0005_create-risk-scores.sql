-- Migration 0005: Create the risk_scores table
--
-- Design decisions:
--   • score is an INTEGER 0–100 enforced via CHECK.  This allows sub-tier
--     granularity for future ML models while keeping tier as a human-
--     readable classification.
--   • tier is constrained via CHECK to LOW / MODERATE / HIGH rather than
--     an ENUM so we can add tiers (e.g. CRITICAL) without migration.
--   • contributing_factors is JSONB to capture an arbitrary list of
--     factors with weights, e.g.:
--     [
--       { "factor": "elevated_bp", "weight": 0.35 },
--       { "factor": "previous_preeclampsia", "weight": 0.25 }
--     ]
--   • algorithm_version tracks which scoring logic produced this score.
--     Phase 1 uses rule-based logic (v1.x); Phase 2 will switch to ML
--     models (v2.x). Storing the version lets us compare model performance
--     across historical scores.
--   • visit_id is optional — a risk score may be generated from a visit,
--     or computed asynchronously from symptom data.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE risk_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

    -- Optional: the visit that triggered this risk assessment
    visit_id                UUID REFERENCES anc_visits(id) ON DELETE SET NULL,

    -- ── Risk assessment ───────────────────────────────────────────────
    -- Numerical score 0 (no risk) → 100 (maximum risk)
    score                   INTEGER NOT NULL
                            CHECK (score >= 0 AND score <= 100),

    -- Human-readable tier derived from score thresholds
    -- Typical mapping:  0–30 = LOW, 31–60 = MODERATE, 61–100 = HIGH
    tier                    TEXT NOT NULL
                            CHECK (tier IN ('LOW', 'MODERATE', 'HIGH')),

    -- ── Contributing factors ──────────────────────────────────────────
    -- JSONB array of objects describing what drove the score, e.g.:
    -- [
    --   { "factor": "gestational_hypertension", "weight": 0.40 },
    --   { "factor": "anemia", "weight": 0.20 },
    --   { "factor": "age_over_35", "weight": 0.15 }
    -- ]
    contributing_factors    JSONB NOT NULL DEFAULT '[]'::JSONB,

    -- ── Algorithm tracking ────────────────────────────────────────────
    -- Semantic version string: "1.0.0" = rule-based Phase 1
    --                          "2.x.x" = ML-based Phase 2
    algorithm_version       TEXT NOT NULL DEFAULT '1.0.0',

    -- ── Audit timestamps ──────────────────────────────────────────────
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at (reuses set_updated_at() from migration 0001)
CREATE TRIGGER trg_risk_scores_updated_at
    BEFORE UPDATE ON risk_scores
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX idx_risk_scores_patient        ON risk_scores (patient_id);
CREATE INDEX idx_risk_scores_tenant         ON risk_scores (tenant_id);
CREATE INDEX idx_risk_scores_visit          ON risk_scores (visit_id);
CREATE INDEX idx_risk_scores_tier           ON risk_scores (tier);
CREATE INDEX idx_risk_scores_score          ON risk_scores (score DESC);
CREATE INDEX idx_risk_scores_created        ON risk_scores (created_at DESC);
CREATE INDEX idx_risk_scores_algorithm      ON risk_scores (algorithm_version);

-- GIN index on contributing_factors for containment queries
-- e.g. SELECT * FROM risk_scores WHERE contributing_factors @> '[{"factor":"anemia"}]'
CREATE INDEX idx_risk_scores_factors        ON risk_scores USING GIN (contributing_factors);

-- Partial index: only HIGH-tier scores for the dashboard alert query
CREATE INDEX idx_risk_scores_high_tier      ON risk_scores (patient_id, created_at DESC)
    WHERE tier = 'HIGH';

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON risk_scores
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON risk_scores
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON risk_scores
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON risk_scores
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE ON risk_scores TO maternal_app;
