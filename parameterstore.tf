############################################
# AWS Systems Manager Parameter Store
############################################

# Data source for current AWS region
data "aws_region" "current" {}

# Application URL parameter
resource "aws_ssm_parameter" "app_url" {
  name  = "/jump-metrics/app/url"
  type  = "String"
  value = "http://jump-metrics.cab432.com"
  
  tags = {
    Name         = "jump-metrics-app-url"
    Project = "jump-metrics"
  }
}

# API Base URL parameter
resource "aws_ssm_parameter" "api_base_url" {
  name  = "/jump-metrics/api/base-url"
  type  = "String"
  value = "http://jump-metrics.cab432.com/api/v1"
  
  tags = {
    Name         = "jump-metrics-api-base-url"
    Project = "jump-metrics"
  }
}

# S3 Bucket Name parameter
resource "aws_ssm_parameter" "s3_bucket_name" {
  name  = "/jump-metrics/s3/bucket-name"
  type  = "String"
  value = aws_s3_bucket.jump_metrics_storage.bucket
  
  tags = {
    Name         = "jump-metrics-s3-bucket-name"
    Project = "jump-metrics"
  }
}

# DynamoDB Table Prefix parameter
resource "aws_ssm_parameter" "dynamodb_table_prefix" {
  name  = "/jump-metrics/dynamodb/table-prefix"
  type  = "String"
  value = "jump-metrics"
  
  tags = {
    Name         = "jump-metrics-dynamodb-table-prefix"
    Project = "jump-metrics"
  }
}

# Cognito User Pool ID parameter
resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "/jump-metrics/cognito/user-pool-id"
  type  = "String"
  value = aws_cognito_user_pool.jump_metrics_pool.id
  
  tags = {
    Name         = "jump-metrics-cognito-user-pool-id"
    Project = "jump-metrics"
  }
}

# Cognito Client ID parameter
resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "/jump-metrics/cognito/client-id"
  type  = "String"
  value = aws_cognito_user_pool_client.jump_metrics_client.id
  
  tags = {
    Name         = "jump-metrics-cognito-client-id"
    Project = "jump-metrics"
  }
}

# Cognito Region parameter
resource "aws_ssm_parameter" "cognito_region" {
  name  = "/jump-metrics/cognito/region"
  type  = "String"
  value = data.aws_region.current.name
  
  tags = {
    Name         = "jump-metrics-cognito-region"
    Project = "jump-metrics"
  }
}

# EC2 Instance parameters removed - using ECS Fargate only

# DynamoDB Tables parameter (JSON)
resource "aws_ssm_parameter" "dynamodb_tables" {
  name  = "/jump-metrics/dynamodb/tables"
  type  = "String"
  value = jsonencode({
    videos   = aws_dynamodb_table.videos.name
    sessions = aws_dynamodb_table.sessions.name
    jumps    = aws_dynamodb_table.jumps.name
    jobs     = aws_dynamodb_table.jobs.name
    media    = aws_dynamodb_table.media.name
  })
  
  tags = {
    Name         = "jump-metrics-dynamodb-tables"
    Project = "jump-metrics"
  }
}

# Cognito User Pool Domain parameter
resource "aws_ssm_parameter" "cognito_user_pool_domain" {
  name  = "/jump-metrics/cognito/user-pool-domain"
  type  = "String"
  value = aws_cognito_user_pool.jump_metrics_pool.endpoint
  
  tags = {
    Name         = "jump-metrics-cognito-user-pool-domain"
    Project = "jump-metrics"
  }
}

# Environment parameter (useful for feature flags, logging levels)
resource "aws_ssm_parameter" "environment" {
  name  = "/jump-metrics/app/environment"
  type  = "String"
  value = "production"
  
  tags = {
    Name         = "jump-metrics-environment"
    Project = "jump-metrics"
  }
}
