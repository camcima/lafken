###############################################################################
# Random suffix for LB name (unique per apply when resource is created)
###############################################################################

resource "random_string" "lb_suffix" {
  length  = 5
  special = false
  upper   = false
}

resource "random_password" "pgsql_root" {
  length           = 14
  special          = false
  override_special = "!$%&*()-_=+[]{}<>?"
  upper            = true
  lower            = true
  numeric          = true
  min_upper        = 1
  min_lower        = 1
  min_numeric      = 1
}


###############################################################################
# Locals
###############################################################################

locals {
  backend_service_name = "${var.project_key}-${var.environment}-${var.project_name}-backend"
  web_service_name     = "${var.project_key}-${var.environment}-${var.project_name}-web"

  # LB name is used as prefix "${name}-certificate-" for SSL cert (max 54 chars), so name must be <= 40 chars
  # Reserve 9 chars for "-" + 5 random + "-lb", truncate prefix to 31
  lb_name = "${substr("${trimspace(var.project_key)}-${trimspace(var.project_name)}", 0, 31)}-${random_string.lb_suffix.result}-lb"
}


###############################################################################
# Data Sources
###############################################################################

# Get cloud armor resource name already created on GCP
data "google_compute_security_policy" "cloudarmor_corp" {
  name    = "cloudarmor-corp"
  project = var.project_id
}


###############################################################################
# Service Accounts
###############################################################################

resource "google_service_account" "backend_sa" {
  account_id   = "${var.project_key}-be-sa"
  display_name = "Backend Service Account"
  description  = "Service account for Backend Cloud Run Cloud SQL and Vault access"
  project      = var.project_id
}

resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"

  condition {
    title       = "Restrict to specific Cloud SQL instance"
    description = "Only allow connection to ${var.project_key} Cloud SQL instance"
    expression  = "resource.name == 'projects/${var.project_id}/instances/${module.postgres.instance_name}'"
  }

  depends_on = [module.postgres]
}

resource "google_project_iam_member" "cloud_run_network_user" {
  project = var.project_id
  role    = "roles/compute.networkUser"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_project_iam_member" "cloud_run_secret_accesor_user" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ESPv2 sidecar needs Service Controller to fetch Cloud Endpoints config at startup
resource "google_project_iam_member" "backend_service_controller" {
  project = var.project_id
  role    = "roles/servicemanagement.serviceController"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_service_account" "web_sa" {
  account_id   = "${var.project_key}-web-sa"
  display_name = "Web Service Account"
  description  = "Service account for Web Cloud Run Static content serving"
  project      = var.project_id
}


###############################################################################
# Azure App Register
###############################################################################

module "latam-appregister" {
  source              = "app.terraform.io/LATAM_AIRLINES/latam-appregister/azure"
  version             = "1.0.5"
  app_role            = var.app_role
  display_name        = var.display_name
  itelement           = var.itelement
  owner_name          = var.owner_name
  owners              = var.owners
  redirect_uris       = var.redirect_uris
  tipo_aplicacion     = var.tipo_aplicacion
  ARM_CLIENT_ID_2     = var.ARM_CLIENT_ID_2
  ARM_CLIENT_SECRET_2 = var.ARM_CLIENT_SECRET_2
  ARM_TENANT_ID_2     = var.ARM_TENANT_ID_2
  environment         = var.environment

  # Entra: assignment required on enterprise app to prevent unauthorized access.
  app_role_assignment_required = true
}

###############################################################################
# Cloud SQL
###############################################################################

module "postgres" {
  source  = "GoogleCloudPlatform/sql-db/google//modules/postgresql"
  version = "~> 27"

  project_id       = var.project_id
  region           = var.region
  zone             = var.zone
  database_version = "POSTGRES_18"

  name             = "${var.project_key}-prod-pgsql-db-1-us-east1"
  tier             = "db-custom-1-3840"

  edition           = "ENTERPRISE"
  availability_type = "ZONAL"

  disk_type       = "PD_HDD"
  disk_size       = 30
  disk_autoresize = true

  insights_config  = {
    query_insights_enabled  = true
    query_plans_per_minute  = 5
    query_string_length     = 1024
    record_application_tags = true
    record_client_address   = false
  }


  root_password            = random_password.pgsql_root.result
  user_name                = "${var.project_key}-username"
  db_name                  = "${var.project_key}-database"
  database_flags           = []

  read_replicas            = []
  read_replica_name_suffix = "-ro"

  deletion_protection = true

  create_timeout = "30m"
  update_timeout = "30m"
  delete_timeout = "30m"

  backup_configuration = {
    enabled                        = true
    start_time                     = "01:00"
    location                       = "us"
    point_in_time_recovery_enabled = false
    transaction_log_retention_days = 3
    retained_backups               = 7
    retention_unit                 = "COUNT"
  }

  user_labels = {
    app             = var.project_key
    "cmdb-${replace(var.project_key, "-", "_")}" = replace(var.project_key, "-", "_")
    iac             = "true"
    environment     = var.environment
  }

  # additional_users     = []
  # additional_databases = []

  ip_configuration = {
    ipv4_enabled    = false
    ssl_mode        = "ALLOW_UNENCRYPTED_AND_ENCRYPTED"
    private_network = "projects/${var.project_id}/global/networks/vpc-lan"
  }
}

###############################################################################
# Cloud Run IAM
###############################################################################

resource "google_cloud_run_v2_service_iam_member" "web_invoker" {
  count    = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = local.web_service_name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# LB invokes Backend service (public-facing, ESPv2 handles auth)
resource "google_cloud_run_v2_service_iam_member" "backend_invoker" {
  count    = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = local.backend_service_name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

###############################################################################
# Load Balancer
###############################################################################

resource "google_compute_global_address" "lb_global_ip" {
  name         = "${var.project_key}-${var.environment}-monorepo"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  description  = "Global IP address for Load Balancer"
  project      = var.project_id
  labels = {
    "cmdb-${replace(var.project_key, "-", "_")}" = replace(var.project_key, "-", "_")
    environment     = var.environment
    iac             = "true"
  }
}

resource "google_compute_region_network_endpoint_group" "web_neg" {
  count                 = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  name                  = "${var.project_key}-${var.project_name}-web-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = local.web_service_name
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  count                 = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  name                  = "${var.project_key}-${var.project_name}-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = local.backend_service_name
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_backend_service" "web_backend" {
  count                 = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  project               = var.project_id
  name                  = "${var.project_key}-${var.project_name}-web"
  enable_cdn            = false
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  security_policy       = data.google_compute_security_policy.cloudarmor_corp.self_link

  iap {
    enabled = false
  }

  backend {
    group = google_compute_region_network_endpoint_group.web_neg[0].id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_backend_service" "backend_backend" {
  count      = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  project    = var.project_id
  name       = "${var.project_key}-${var.project_name}-backend-be"
  enable_cdn = false

  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  security_policy       = data.google_compute_security_policy.cloudarmor_corp.self_link

  iap {
    enabled = false
  }

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg[0].id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_url_map" "lb_url_map" {
  count           = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  project         = var.project_id
  name            = "${var.project_key}-${var.environment}-${var.project_name}-lb-url-map"
  default_service = google_compute_backend_service.web_backend[0].id

  host_rule {
    hosts        = ["*"]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = google_compute_backend_service.web_backend[0].id

    route_rules {
      priority = 1
      match_rules {
        prefix_match = "/be"
      }
      route_action {
        url_rewrite {
          path_prefix_rewrite = "/"
        }
      }
      service = google_compute_backend_service.backend_backend[0].id
    }
  }

  depends_on = [
    google_compute_backend_service.backend_backend,
    google_compute_backend_service.web_backend
  ]
}

module "lb-http" {
  count                  = var.first_deploy_cloud_run_done == "true" ? 1 : 0
  source                 = "GoogleCloudPlatform/lb-http/google//modules/serverless_negs"
  version                = "~> 14.0"
  project                = var.project_id
  name                   = local.lb_name
  create_address         = false
  address                = google_compute_global_address.lb_global_ip.address
  load_balancing_scheme  = "EXTERNAL_MANAGED"
  ssl                    = true
  create_ssl_certificate = true
  private_key            = var.akamai_cert_key
  certificate            = var.akamai_cert_pem
  https_redirect         = true
  create_url_map         = false
  url_map                = google_compute_url_map.lb_url_map[0].id
  backends               = {}
  labels = {
    "cmdb-${replace(var.project_key, "-", "_")}" = replace(var.project_key, "-", "_")
    environment                                  = var.environment
    iac                                          = "true"
    project_name                                 = var.project_name
  }
}
