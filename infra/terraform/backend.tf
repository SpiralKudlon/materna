# Terraform backend (remote state) – optional but recommended for teams.
# Uncomment and configure an S3 bucket + DynamoDB table for state locking.
#
# terraform {
#   backend "s3" {
#     bucket         = "maternal-system-tf-state"
#     key            = "eks/terraform.tfstate"
#     region         = "af-south-1"
#     encrypt        = true
#     dynamodb_table = "maternal-system-tf-lock"
#   }
# }

# Example override file for non-production deployments.
# Rename to terraform.tfvars and adjust values as needed.
#
# aws_region     = "af-south-1"
# cluster_name   = "maternal-system-dev"
# node_count     = 1
# node_instance_type = "t3.medium"
