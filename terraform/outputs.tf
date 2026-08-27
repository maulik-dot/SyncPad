output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets for load balancers"
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "IDs of the private subnets for application workloads"
  value       = aws_subnet.private_app[*].id
}

output "rds_endpoint" {
  description = "Connection endpoint address for the RDS PostgreSQL database"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Port for the RDS PostgreSQL database"
  value       = aws_db_instance.postgres.port
}

output "rds_database_name" {
  description = "Database name on the RDS PostgreSQL instance"
  value       = aws_db_instance.postgres.db_name
}

output "s3_backup_bucket_id" {
  description = "Name of the S3 bucket storing encrypted database backups"
  value       = aws_s3_bucket.backups.id
}

output "s3_backup_bucket_arn" {
  description = "ARN of the S3 bucket storing encrypted database backups"
  value       = aws_s3_bucket.backups.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS Customer Managed Key used for encryption"
  value       = aws_kms_key.syncpad_key.arn
}

output "db_credentials_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret storing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}
