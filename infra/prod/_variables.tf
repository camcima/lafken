variable "first_deploy_cloud_run_done" {
  description = "Set to 'true' after Cloud Run services have been deployed via CI/CD. Managed by TFC workspace variable."
  type        = string
  default     = "false"
}

variable "project_id" {
  description = "GCP Project ID (PROD)"
  type        = string
  default     = "emx-prod-63eb"
}

variable "project_key" {
  description = "Project key from TFC variable set in kebab case format (eg, IT Asset: emx-tmpl)"
  type        = string
}

variable "project_name" {
  description = "Monorepo repository name"
  type        = string
  default     = "template-emantto-project"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-east1"
}

variable "zone" {
  description = "GCP Zone for Cloud SQL"
  type        = string
  default     = "us-east1-c"
}

variable "network_name" {
  description = "VPC network name for private connectivity"
  type        = string
  default     = "vpc-lan"
}

variable "akamai_cert_key" {
  description = "Akamai certificate key"
  type        = string
}

variable "akamai_cert_pem" {
  description = "Akamai certificate pem"
  type        = string
}

variable "app_role" {
  type = any
  default = []
}

variable "display_name" {
  type    = string
  default = "emx-template-emantto-monorepo-app"
}

variable "itelement" {
  type    = string
  default = "EMX_TMPL"
}

variable "owner_name" {
  type    = string
  default = "emx"
}

variable "owners" {
  type    = list(string)
  default = ["a8021f82-5487-40f9-8a29-73c5ef48441d"]
}

variable "redirect_uris" {
  type    = list(string)
  default = ["https://emx-template-emantto.appslatam.com/", "http://localhost:5173/"]
}

variable "tipo_aplicacion" {
  type    = string
  default = "SPA"
}

variable "ARM_CLIENT_ID_2" {
  description = "ARM_CLIENT_ID_2"
  type        = string
  default     = "dummy_ARM_CLIENT_ID_2"
}

variable "ARM_CLIENT_SECRET_2" {
  description = "ARM_CLIENT_SECRET_2"
  type        = string
  default     = "dummy_ARM_CLIENT_SECRET_2"
}

variable "ARM_TENANT_ID_2" {
  description = "ARM_TENANT_ID_2"
  type        = string
  default     = "dummy_ARM_TENANT_ID_2"
}
