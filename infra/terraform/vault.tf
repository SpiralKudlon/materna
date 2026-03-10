resource "helm_release" "vault" {
  name             = "vault"
  repository       = "https://helm.releases.hashicorp.com"
  chart            = "vault"
  namespace        = "vault"
  create_namespace = true
  version          = "0.27.0"

  values = [
    <<EOF
server:
  dev:
    enabled: true # Dev mode for local testing/simplicity. In prod, use HA with Raft.
    # Set a static root token for immediate automated config application
    rootToken: "root-dev-token"

  # Inject the K8s auth method on startup
  postStart:
    - "/bin/sh"
    - "-c"
    - |
      sleep 5
      vault auth enable kubernetes
      vault write auth/kubernetes/config \
        kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"

injector:
  enabled: true # Enables the Vault Agent Injector mutating webhook for apps
EOF
  ]
}
