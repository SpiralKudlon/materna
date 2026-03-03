# ─────────────────────────────────────────────────────────────────────────────
# Keycloak 24 – Terraform resources
# Deploys Keycloak 24 (via Bitnami Helm chart v21.x) to the EKS cluster,
# using the external PostgreSQL 16 instance as the database backend.
# ─────────────────────────────────────────────────────────────────────────────

# ---------------------------------------------------------------------------
# Providers (must be declared before use)
# ---------------------------------------------------------------------------
terraform {
  required_providers {
    aws        = { source = "hashicorp/aws",        version = "~> 5.0" }
    kubernetes = { source = "hashicorp/kubernetes",  version = "~> 2.27" }
    helm       = { source = "hashicorp/helm",        version = "~> 2.13" }
    random     = { source = "hashicorp/random",      version = "~> 3.6" }
  }
}

# Wire the Kubernetes and Helm providers to the EKS cluster created in eks.tf
data "aws_eks_cluster_auth" "main" {
  name = aws_eks_cluster.main.name
}

provider "kubernetes" {
  host                   = aws_eks_cluster.main.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.main.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.main.token
}

provider "helm" {
  kubernetes {
    host                   = aws_eks_cluster.main.endpoint
    cluster_ca_certificate = base64decode(aws_eks_cluster.main.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.main.token
  }
}

# ---------------------------------------------------------------------------
# Kubernetes namespace
# ---------------------------------------------------------------------------
resource "kubernetes_namespace" "keycloak" {
  metadata {
    name = "keycloak"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

# ---------------------------------------------------------------------------
# Generate secrets we cannot pre-know
# ---------------------------------------------------------------------------
resource "random_password" "keycloak_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

resource "random_password" "keycloak_db" {
  length  = 24
  special = false
}

resource "random_password" "api_client_secret" {
  length  = 48
  special = false
}

# ---------------------------------------------------------------------------
# AWS Secrets Manager – store all credentials
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "keycloak_admin" {
  name                    = "/${var.cluster_name}/keycloak/admin"
  recovery_window_in_days = 7
  description             = "Keycloak bootstrap admin credentials"

  tags = { ManagedBy = "terraform" }
}

resource "aws_secretsmanager_secret_version" "keycloak_admin" {
  secret_id = aws_secretsmanager_secret.keycloak_admin.id
  secret_string = jsonencode({
    username = var.keycloak_admin_user
    password = random_password.keycloak_admin.result
  })
}

resource "aws_secretsmanager_secret" "keycloak_db" {
  name                    = "/${var.cluster_name}/keycloak/db"
  recovery_window_in_days = 7
  description             = "Keycloak PostgreSQL credentials"

  tags = { ManagedBy = "terraform" }
}

resource "aws_secretsmanager_secret_version" "keycloak_db" {
  secret_id = aws_secretsmanager_secret.keycloak_db.id
  secret_string = jsonencode({
    host     = var.postgres_host
    port     = var.postgres_port
    dbname   = var.postgres_db_name
    username = var.postgres_user
    password = random_password.keycloak_db.result
  })
}

resource "aws_secretsmanager_secret" "api_client_secret" {
  name                    = "/${var.cluster_name}/keycloak/api-client-secret"
  recovery_window_in_days = 7
  description             = "Keycloak confidential client secret for the backend identity API"

  tags = { ManagedBy = "terraform" }
}

resource "aws_secretsmanager_secret_version" "api_client_secret" {
  secret_id = aws_secretsmanager_secret.api_client_secret.id
  secret_string = jsonencode({
    client_id     = "api-server"
    client_secret = random_password.api_client_secret.result
  })
}

# ---------------------------------------------------------------------------
# Kubernetes Secret – feed credentials into the Helm chart
# ---------------------------------------------------------------------------
resource "kubernetes_secret" "keycloak_credentials" {
  metadata {
    name      = "keycloak-credentials"
    namespace = kubernetes_namespace.keycloak.metadata[0].name
  }

  data = {
    # Keycloak bootstrap admin
    admin-user     = var.keycloak_admin_user
    admin-password = random_password.keycloak_admin.result

    # External PostgreSQL connection
    db-host     = var.postgres_host
    db-port     = tostring(var.postgres_port)
    db-name     = var.postgres_db_name
    db-user     = var.postgres_user
    db-password = random_password.keycloak_db.result

    # API client secret (written into realm import via Helm values)
    api-client-secret = random_password.api_client_secret.result
  }

  type = "Opaque"
}

# ---------------------------------------------------------------------------
# ConfigMap – Keycloak realm import JSON
# ---------------------------------------------------------------------------
resource "kubernetes_config_map" "keycloak_realm" {
  metadata {
    name      = "keycloak-realm-config"
    namespace = kubernetes_namespace.keycloak.metadata[0].name
  }

  data = {
    "maternal-system-realm.json" = file("${path.module}/../helm/keycloak/realm.json")
  }
}

# ---------------------------------------------------------------------------
# ACM Certificate for Keycloak HTTPS
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "keycloak" {
  domain_name       = var.keycloak_hostname
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name      = "${var.cluster_name}-keycloak-cert"
    ManagedBy = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Helm Release – Keycloak 24 (Bitnami chart)
# ---------------------------------------------------------------------------
resource "helm_release" "keycloak" {
  name             = "keycloak"
  namespace        = kubernetes_namespace.keycloak.metadata[0].name
  repository       = "oci://registry-1.docker.io/bitnamicharts"
  chart            = "keycloak"
  version          = var.keycloak_chart_version
  cleanup_on_fail  = true
  atomic           = true
  timeout          = 600

  values = [
    file("${path.module}/../helm/keycloak/values.yaml")
  ]

  # Inject secrets at deploy time (not stored in values.yaml)
  set_sensitive {
    name  = "auth.adminPassword"
    value = random_password.keycloak_admin.result
  }

  set_sensitive {
    name  = "externalDatabase.password"
    value = random_password.keycloak_db.result
  }

  set {
    name  = "externalDatabase.host"
    value = var.postgres_host
  }

  set {
    name  = "externalDatabase.port"
    value = tostring(var.postgres_port)
  }

  set {
    name  = "externalDatabase.database"
    value = var.postgres_db_name
  }

  set {
    name  = "externalDatabase.user"
    value = var.postgres_user
  }

  set {
    name  = "ingress.hostname"
    value = var.keycloak_hostname
  }

  set {
    name  = "ingress.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-ssl-cert"
    value = aws_acm_certificate.keycloak.arn
  }

  depends_on = [
    kubernetes_config_map.keycloak_realm,
    kubernetes_secret.keycloak_credentials,
    aws_eks_node_group.workers,
    aws_acm_certificate.keycloak,
  ]
}

# ---------------------------------------------------------------------------
# Outputs – for identity service wiring
# ---------------------------------------------------------------------------
output "keycloak_url" {
  description = "Keycloak base URL"
  value       = "https://${var.keycloak_hostname}"
}

output "keycloak_realm_issuer" {
  description = "Keycloak realm issuer URL for OIDC discovery"
  value       = "https://${var.keycloak_hostname}/realms/maternal-system"
}

output "keycloak_admin_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret holding Keycloak admin credentials"
  value       = aws_secretsmanager_secret.keycloak_admin.arn
}

output "keycloak_api_client_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret holding the backend API client secret"
  value       = aws_secretsmanager_secret.api_client_secret.arn
}
