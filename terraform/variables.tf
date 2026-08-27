variable "aws_region" {
  description = "The AWS region to deploy SyncPad infrastructure in"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g., prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project identifier for resource naming and tagging"
  type        = string
  default     = "syncpad"
}

variable "domain_name" {
  description = "Primary domain name for SyncPad application ingress"
  type        = string
  default     = "syncpad.example.com"
}

variable "vpc_cidr" {
  description = "CIDR block for the SyncPad VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "Instance class for the RDS PostgreSQL database"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB for the RDS PostgreSQL database"
  type        = number
  default     = 50
}

variable "db_max_allocated_storage" {
  description = "Maximum storage limit in GB for autoscaling RDS storage"
  type        = number
  default     = 200
}

variable "backup_retention_days" {
  description = "Number of days to retain automated database backups"
  type        = number
  default     = 14
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for high-availability database failover"
  type        = bool
  default     = true
}
