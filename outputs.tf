############################################
# Terraform Outputs
############################################

# EC2 outputs removed - using ECS Fargate only

output "s3_bucket_name" {
  description = "S3 bucket name for file storage"
  value       = aws_s3_bucket.jump_metrics_storage.bucket
}

# ECS API URL output already exists in ecs.tf

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    videos   = aws_dynamodb_table.videos.name
    sessions = aws_dynamodb_table.sessions.name
    jumps    = aws_dynamodb_table.jumps.name
    jobs     = aws_dynamodb_table.jobs.name
    media    = aws_dynamodb_table.media.name
  }
}

output "parameter_store_app_url" {
  value = aws_ssm_parameter.app_url.name
  description = "Parameter Store App URL parameter name"
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.jump_metrics_pool.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.jump_metrics_client.id
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.jump_metrics_pool.endpoint
}

# Cognito User Groups outputs
output "cognito_admin_group_name" {
  value = aws_cognito_user_group.admin_group.name
  description = "Cognito Admin Group name"
}


