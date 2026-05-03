provider "google" {
  project = var.project_id
  region  = var.region
}

terraform {
  cloud {
    organization = "LATAM_AIRLINES"

    workspaces {
      name = "emx-tmpl-prod-63eb"
    }
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}
