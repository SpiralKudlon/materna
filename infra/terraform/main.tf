terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws        = { source = "hashicorp/aws",        version = "~> 5.0" }
    kubernetes = { source = "hashicorp/kubernetes",  version = "~> 2.27" }
    helm       = { source = "hashicorp/helm",        version = "~> 2.13" }
    random     = { source = "hashicorp/random",      version = "~> 3.6" }
  }
}

provider "aws" {
  # AWS does not have a Nairobi region. af-south-1 (Cape Town) is the
  # closest African AWS region. Update if a Nairobi region becomes available.
  region = var.aws_region

  # Bypassing for local testing
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
}
