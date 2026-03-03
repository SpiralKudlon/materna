# ---------------------------------------------------------------------------
# Security Group: EKS Cluster Control Plane
# ---------------------------------------------------------------------------
resource "aws_security_group" "eks_cluster" {
  name        = "${var.cluster_name}-cluster-sg"
  description = "EKS cluster control plane security group"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.cluster_name}-cluster-sg"
  }
}

# ---------------------------------------------------------------------------
# EKS Cluster
# ---------------------------------------------------------------------------
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.kubernetes_version
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    security_group_ids      = [aws_security_group.eks_cluster.id]
    endpoint_private_access = true
    # 🟡 Fix: Disable public API server endpoint for PHI/PII workloads.
    # Use AWS VPN, Direct Connect, or SSM Session Manager to reach the cluster.
    # If external CI-runner access is needed, set to true and restrict public_access_cidrs.
    endpoint_public_access  = false
  }

  # Ensure CloudWatch logging for the control plane
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
  ]

  tags = {
    Name        = var.cluster_name
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# EKS Managed Node Group (3 × t3.large in private subnets)
# ---------------------------------------------------------------------------
resource "aws_eks_node_group" "workers" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-workers"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private[*].id

  instance_types = [var.node_instance_type]

  scaling_config {
    desired_size = var.node_count
    min_size     = var.node_count
    max_size     = var.node_count + 2 # allow headroom for rolling updates
  }

  update_config {
    max_unavailable = 1
  }

  # Use the latest EKS-optimised Amazon Linux 2 AMI
  ami_type = "AL2_x86_64"

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_readonly,
  ]

  tags = {
    Name        = "${var.cluster_name}-workers"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
