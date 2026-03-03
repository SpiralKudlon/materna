terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  # AWS does not have a Nairobi region. af-south-1 (Cape Town) is the
  # closest African AWS region. Update if a Nairobi region becomes available.
  region = var.aws_region
}
