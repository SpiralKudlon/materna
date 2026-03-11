# Data Flow Diagram — Kenya Data Protection Act 2019 Compliance Mapping

**Document status:** Draft for sign-off  
**Prepared by:** Security Engineering  
**Date:** 2026-03-10  
**Version:** 1.0

---

## 1. Summary

This document maps every personal-data flow in the Maternal System to the Kenya Data Protection Act 2019 (KDPA). It covers lawful basis, data subject rights, retention, cross-border transfers, and security controls.

---

## 2. Data Asset Inventory

| Asset | Classification | Location | Encrypted at rest | Retention |
|---|---|---|---|---|
| `patients.full_name` | PII — Sensitive | PostgreSQL (`full_name_enc BYTEA`) | AES-256-CBC (field-level, KMS) | Duration of care + 10 years |
| `patients.phone` | PII — Contact | PostgreSQL (`phone_enc BYTEA`) | AES-256-CBC (field-level, KMS) | Duration of care + 10 years |
| `patients.date_of_birth` | PII — Sensitive | PostgreSQL (`date_of_birth BYTEA`) | AES-256-CBC (field-level, KMS) | Duration of care + 10 years |
| `medical_history.hiv_status` | PII — Special Category | PostgreSQL (`hiv_status BYTEA`) | AES-256-CBC (field-level, KMS) | Duration of care + 10 years |
| KMS Data Encryption Keys | Cryptographic key material | AWS KMS (eu-west-1) | AWS-managed HSM | Rotated annually |
| `audit_events` rows | Operational — Immutable | PostgreSQL | TLS in transit, disk encryption at rest | 7 years (KDPA Art. 25) |
| JWT tokens | Session credential | Redis + client memory | TLS in transit | TTL = 1 hour |
| OTPs | Ephemeral credential | Redis | TLS in transit | TTL = 10 minutes |
| SMS content | Communication | Africa's Talking / Twilio | TLS in transit | Not stored |

---

## 3. DFD Level 0 — Context Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       MATERNAL SYSTEM                                │
│                                                                      │
│   ┌──────────────┐       ┌──────────────────────────────────────┐   │
│   │   CHV App    │──────▶│           identity service           │   │
│   │  (mobile/web)│◀──────│  (Fastify · JWT · Keycloak · OTP)    │   │
│   └──────────────┘       └──────────────────────────────────────┘   │
│          │                          │ (JWT)                         │
│          ▼                          ▼                               │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │               maternal-records API                        │     │
│   │  (Fastify · PatientRepo · CryptoService · KmsService)    │     │
│   └──────────────────────────────────────────────────────────┘     │
│          │ encrypted PII                          │audit ctx         │
│          ▼                                        ▼                 │
│   ┌──────────────┐                      ┌──────────────────────┐   │
│   │  PostgreSQL  │                      │   audit_events table │   │
│   │  (RDS/EKS)   │                      │   (append-only)      │   │
│   └──────────────┘                      └──────────────────────┘   │
│                                                                      │
│   ┌──────────────┐       ┌──────────────────────────────────────┐   │
│   │  AT / Twilio │◀──────│           sms-bridge service         │   │
│   │  (external)  │       │  (Fastify · Vault secrets · Kafka)   │   │
│   └──────────────┘       └──────────────────────────────────────┘   │
│                                                                      │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │           notification-engine                              │    │
│   │  (BullMQ · Firebase FCM · Africa's Talking SMS)           │    │
│   └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

External Entities: CHV (Community Health Volunteer), Clinician, Facility Admin
Trust boundaries: TLS termination at ingress; internal services on private VPC subnet
```

---

## 4. DFD Level 1 — Per-Service Data Flows

### 4.1 Patient Registration

```
CHV App → POST /api/v1/patients
  → identity service (JWT validation)
  → maternal-records API
      → KmsService.generateDataKey() → AWS KMS (eu-west-1)
      → CryptoService.encryptField(full_name, phone, dob)
      → INSERT INTO patients (full_name_enc, phone_enc, date_of_birth BYTEA, kms_key_id)
      → AFTER trigger → audit_events (INSERT, resource='patients', user_id, ip, user_agent)
  ← 201 { PatientDTO with decrypted fields }
```

**PII in transit:** TLS 1.3 minimum enforced by HSTS header (`max-age=63072000; preload`).  
**PII at rest:** AES-256-CBC + envelope encryption (DEK per row, encrypted by AWS KMS CMK).

### 4.2 Clinical Record Access

```
Clinician → GET /api/v1/patients/:id
  → identity service (JWT + role check)
  → maternal-records API
      → assertAssignment(userId, patientId)   — row-level security
      → KmsService.decryptDataKey(kms_key_id) → AWS KMS
      → CryptoService.decryptField(full_name_enc, ...)
      → AFTER trigger → audit_events (SELECT is not triggered; rely on app-layer audit log)
  ← 200 { PatientDTO — plaintext fields, in-memory only }
```

### 4.3 SMS Notification

```
notification-engine → kafka topic 'notifications'
  → sms-bridge service
      → Vault.getSmsSecrets()                 — API keys fetched at startup, never stored in DB
      → AT / Twilio API (TLS)                 — phone number not logged
```

---

## 5. KDPA 2019 Principle Mapping

| KDPA 2019 Principle | Section | Implementation |
|---|---|---|
| **Lawful processing** | s.25(1) | Explicit informed consent collected at registration (consent model in `patients` schema). Contracts with HCF operators. |
| **Purpose limitation** | s.25(2)(b) | Data used only for maternal health coordination; no secondary analytics on PII. |
| **Data minimisation** | s.25(2)(c) | Only `full_name`, `phone`, `dob`, `hiv_status` collected. National ID is optional. |
| **Accuracy** | s.25(2)(d) | PATCH endpoint + audit trail; data subject can request correction (see §6). |
| **Storage limitation** | s.25(2)(e) | 10-year retention post-care; automated deletion job (scheduled). See asset table §2. |
| **Security** | s.25(2)(f) | AES-256-CBC field encryption, AWS KMS, HSTS, RLS, audit triggers, @fastify/helmet. |
| **Accountability** | s.25(2)(g) | `audit_events` immutable log with `user_id`, `ip_address`, `user_agent`, `occurred_at`. |
| **Special categories** | s.46 | `hiv_status` is a special-category field. Encrypted at rest; accessed only by assigned clinicians via RLS. |
| **Sensitive data consent** | s.46(1)(a) | Explicit separate consent flag for HIV status disclosure. |
| **Data transfers outside Kenya** | s.48 | KMS and FCM infrastructure in EU/US. Transfer covered by adequacy clauses and DPA agreements. Disclosed in privacy notice. |
| **Notification of breach** | s.43 | Incident response runbook links to this document; obligation to notify ODPC within 72 hours. |

---

## 6. Data Subject Rights (KDPA s.26–s.35)

| Right | Mechanism | SLA |
|---|---|---|
| **Access (s.26)** | `GET /api/v1/patients/:id` — returns decrypted DTO | Immediate |
| **Correction (s.28)** | `PATCH /api/v1/patients/:id` | Within 7 days |
| **Erasure (s.29)** | `DELETE /api/v1/patients/:id` (cascades to all clinical records) | Within 30 days |
| **Objection to processing (s.31)** | Facility admin offline process → triggers soft-delete + retention freeze | Within 30 days |
| **Portability (s.30)** | `GET /api/v1/patients/:id` JSON response; CLI export tool planned | Within 30 days |

---

## 7. Cross-Border Transfer Disclosure

| Processor | Location | Transfer basis | Data types |
|---|---|---|---|
| AWS KMS | eu-west-1 (Ireland) | Standard Contractual Clauses (SCC) | Encrypted DEKs only (no plaintext PII) |
| AWS RDS | eu-west-1 (Ireland) | SCC | Encrypted PII (ciphertext at rest) |
| Google Firebase FCM | USA | SCC | Push notification tokens (no PII payload) |
| Africa's Talking | Kenya | Domestic | Phone numbers (ephemeral, not stored) |
| Twilio | USA | SCC | Phone numbers (ephemeral, not stored) |

---

## 8. Security Controls Summary

| Control | Implementation |
|---|---|
| Transport encryption | TLS 1.3 (HSTS `max-age=63072000; includeSubDomains; preload`) |
| Data-at-rest encryption | AES-256-CBC field-level + AWS KMS envelope encryption |
| Authentication | Keycloak OIDC + JWT RS256 (JWKS endpoint) |
| Authorisation | Row-Level Security + `assertAssignment()` check |
| Audit trail | Immutable `audit_events` table (PostgreSQL AFTER triggers, `SECURITY DEFINER`) |
| Rate limiting | `@fastify/rate-limit` — 10 req / 15 min on auth endpoints |
| Security headers | `@fastify/helmet` (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) |
| Secret management | HashiCorp Vault (SMS keys); AWS KMS (DEKs); Keycloak (client secrets) |
| Vulnerability scanning | Snyk (dependency), Trivy (container/FS) — gating CI on HIGH/CRITICAL |

---

## 9. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Data Protection Officer | ________________ | 2026-03-__ | ____________ |
| CISO | ________________ | 2026-03-__ | ____________ |
| Engineering Lead | ________________ | 2026-03-__ | ____________ |

---

*This document is reviewed annually or upon any architectural change that alters PII data flows.*
