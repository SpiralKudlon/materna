-- ClickHouse schemas and ETL pipeline from Kafka -> MergeTree

-- 1. Patients Table
CREATE TABLE IF NOT EXISTS patients (
    id UUID,
    tenant_id UUID,
    date_of_birth Date,
    sex String,
    created_at DateTime,
    updated_at DateTime,
    _version UInt64
) ENGINE = ReplacingMergeTree(_version)
ORDER BY id;

CREATE TABLE IF NOT EXISTS debezium_patients_kafka (
    after String,
    op String,
    ts_ms UInt64
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:29092',
         kafka_topic_list = 'dbserver1.public.patients',
         kafka_group_name = 'ch_patients_group',
         kafka_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW IF NOT EXISTS patients_mv TO patients AS
SELECT
    JSONExtractString(after, 'id')::UUID AS id,
    JSONExtractString(after, 'tenant_id')::UUID AS tenant_id,
    JSONExtractString(after, 'date_of_birth')::Date AS date_of_birth,
    JSONExtractString(after, 'sex') AS sex,
    toDateTime(replaceOne(JSONExtractString(after, 'created_at'), 'T', ' '))::DateTime AS created_at,
    toDateTime(replaceOne(JSONExtractString(after, 'updated_at'), 'T', ' '))::DateTime AS updated_at,
    ts_ms AS _version
FROM debezium_patients_kafka
WHERE op IN ('c', 'r', 'u');

-- 2. Facilities Table
CREATE TABLE IF NOT EXISTS facilities (
    id UUID,
    tenant_id UUID,
    name String,
    type String,
    latitude Float64,
    longitude Float64,
    created_at DateTime,
    updated_at DateTime,
    _version UInt64
) ENGINE = ReplacingMergeTree(_version)
ORDER BY id;

CREATE TABLE IF NOT EXISTS debezium_facilities_kafka (
    after String,
    op String,
    ts_ms UInt64
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:29092',
         kafka_topic_list = 'dbserver1.public.facilities',
         kafka_group_name = 'ch_facilities_group',
         kafka_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW IF NOT EXISTS facilities_mv TO facilities AS
SELECT
    JSONExtractString(after, 'id')::UUID AS id,
    JSONExtractString(after, 'tenant_id')::UUID AS tenant_id,
    JSONExtractString(after, 'name') AS name,
    JSONExtractString(after, 'type') AS type,
    JSONExtractFloat(after, 'latitude') AS latitude,
    JSONExtractFloat(after, 'longitude') AS longitude,
    toDateTime(replaceOne(JSONExtractString(after, 'created_at'), 'T', ' '))::DateTime AS created_at,
    toDateTime(replaceOne(JSONExtractString(after, 'updated_at'), 'T', ' '))::DateTime AS updated_at,
    ts_ms AS _version
FROM debezium_facilities_kafka
WHERE op IN ('c', 'r', 'u');

-- 3. ANC Visits Table
CREATE TABLE IF NOT EXISTS anc_visits (
    id UUID,
    patient_id UUID,
    tenant_id UUID,
    visit_number UInt32,
    visit_date Date,
    status String,
    bp_systolic Nullable(UInt16),
    bp_diastolic Nullable(UInt16),
    weight_kg Nullable(Float64),
    gestational_age_weeks UInt8,
    is_high_risk UInt8,
    created_at DateTime,
    updated_at DateTime,
    _version UInt64
) ENGINE = ReplacingMergeTree(_version)
ORDER BY id;

CREATE TABLE IF NOT EXISTS debezium_anc_visits_kafka (
    after String,
    op String,
    ts_ms UInt64
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:29092',
         kafka_topic_list = 'dbserver1.public.anc_visits',
         kafka_group_name = 'ch_anc_visits_group',
         kafka_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW IF NOT EXISTS anc_visits_mv TO anc_visits AS
SELECT
    JSONExtractString(after, 'id')::UUID AS id,
    JSONExtractString(after, 'patient_id')::UUID AS patient_id,
    JSONExtractString(after, 'tenant_id')::UUID AS tenant_id,
    JSONExtractUInt(after, 'visit_number') AS visit_number,
    JSONExtractString(after, 'visit_date')::Date AS visit_date,
    JSONExtractString(after, 'status') AS status,
    JSONExtract(after, 'bp_systolic', 'Nullable(UInt16)') as bp_systolic,
    JSONExtract(after, 'bp_diastolic', 'Nullable(UInt16)') as bp_diastolic,
    JSONExtract(after, 'weight_kg', 'Nullable(Float64)') as weight_kg,
    JSONExtractUInt(after, 'gestational_age_weeks') as gestational_age_weeks,
    if(JSONExtractString(after, 'is_high_risk') = 'true', 1, 0) as is_high_risk,
    toDateTime(replaceOne(JSONExtractString(after, 'created_at'), 'T', ' '))::DateTime AS created_at,
    toDateTime(replaceOne(JSONExtractString(after, 'updated_at'), 'T', ' '))::DateTime AS updated_at,
    ts_ms AS _version
FROM debezium_anc_visits_kafka
WHERE op IN ('c', 'r', 'u');

-- 4. Risk Scores Table
CREATE TABLE IF NOT EXISTS risk_scores (
    id UUID,
    patient_id UUID,
    tenant_id UUID,
    visit_id Nullable(UUID),
    score UInt8,
    tier String,
    algorithm_version String,
    created_at DateTime,
    updated_at DateTime,
    _version UInt64
) ENGINE = ReplacingMergeTree(_version)
ORDER BY id;

CREATE TABLE IF NOT EXISTS debezium_risk_scores_kafka (
    after String,
    op String,
    ts_ms UInt64
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:29092',
         kafka_topic_list = 'dbserver1.public.risk_scores',
         kafka_group_name = 'ch_risk_scores_group',
         kafka_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW IF NOT EXISTS risk_scores_mv TO risk_scores AS
SELECT
    JSONExtractString(after, 'id')::UUID AS id,
    JSONExtractString(after, 'patient_id')::UUID AS patient_id,
    JSONExtractString(after, 'tenant_id')::UUID AS tenant_id,
    JSONExtract(after, 'visit_id', 'Nullable(UUID)') AS visit_id,
    JSONExtractUInt(after, 'score') AS score,
    JSONExtractString(after, 'tier') AS tier,
    JSONExtractString(after, 'algorithm_version') AS algorithm_version,
    toDateTime(replaceOne(JSONExtractString(after, 'created_at'), 'T', ' '))::DateTime AS created_at,
    toDateTime(replaceOne(JSONExtractString(after, 'updated_at'), 'T', ' '))::DateTime AS updated_at,
    ts_ms AS _version
FROM debezium_risk_scores_kafka
WHERE op IN ('c', 'r', 'u');

-- 5. Symptom Logs Table
CREATE TABLE IF NOT EXISTS symptom_logs (
    id UUID,
    patient_id UUID,
    tenant_id UUID,
    symptoms String,
    source String,
    created_at DateTime,
    updated_at DateTime,
    _version UInt64
) ENGINE = ReplacingMergeTree(_version)
ORDER BY id;

CREATE TABLE IF NOT EXISTS debezium_symptom_logs_kafka (
    after String,
    op String,
    ts_ms UInt64
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:29092',
         kafka_topic_list = 'dbserver1.public.symptom_logs',
         kafka_group_name = 'ch_symptom_logs_group',
         kafka_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW IF NOT EXISTS symptom_logs_mv TO symptom_logs AS
SELECT
    JSONExtractString(after, 'id')::UUID AS id,
    JSONExtractString(after, 'patient_id')::UUID AS patient_id,
    JSONExtractString(after, 'tenant_id')::UUID AS tenant_id,
    JSONExtractRaw(after, 'symptoms') AS symptoms,
    JSONExtractString(after, 'source') AS source,
    toDateTime(replaceOne(JSONExtractString(after, 'created_at'), 'T', ' '))::DateTime AS created_at,
    toDateTime(replaceOne(JSONExtractString(after, 'updated_at'), 'T', ' '))::DateTime AS updated_at,
    ts_ms AS _version
FROM debezium_symptom_logs_kafka
WHERE op IN ('c', 'r', 'u');
