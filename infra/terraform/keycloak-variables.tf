# ─────────────────────────────────────────────────────────────────────────────
# Keycloak 24 – Terraform variables
# ─────────────────────────────────────────────────────────────────────────────

variable "keycloak_hostname" {
  description = "Public FQDN for Keycloak, e.g. auth.maternal-system.example.com"
  type        = string
  default     = "auth.maternal-system.example.com"
}

variable "keycloak_admin_user" {
  description = "Keycloak bootstrap admin username"
  type        = string
  default     = "admin"
}

variable "keycloak_chart_version" {
  description = "Bitnami Keycloak Helm chart version (chart 21.x ships Keycloak 24.x)"
  type        = string
  default     = "21.4.4"
}

variable "postgres_host" {
  description = "Hostname of the external PostgreSQL 16 instance (provisioned in Sprint 1)"
  type        = string
}

variable "postgres_port" {
  description = "Port of the external PostgreSQL 16 instance"
  type        = number
  default     = 5432
}

variable "postgres_db_name" {
  description = "Name of the Keycloak database on the PostgreSQL instance"
  type        = string
  default     = "keycloak"
}

variable "postgres_user" {
  description = "PostgreSQL user for Keycloak"
  type        = string
  default     = "keycloak"
}
