provider "google" {
  project = var.project_id
  region  = var.region
}

terraform {
  cloud {
    organization = "LATAM_AIRLINES"

    workspaces {
      name = "emx-tmpl-intg-ab3d"
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
