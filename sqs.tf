############################################
# SQS Queues for Load Distribution
############################################

locals {
  sqs_queue_name = "jump-metrics-jobs"
  sqs_dlq_name   = "jump-metrics-jobs-dlq"
}

# Dead Letter Queue (DLQ) for failed messages
resource "aws_sqs_queue" "jobs_dlq" {
  name = local.sqs_dlq_name
  
  # Message retention: 14 days (max)
  message_retention_seconds = 1209600
  
  # Visibility timeout: 30 seconds (should be longer than processing time)
  visibility_timeout_seconds = 30
  
  tags = {
    Name        = "Jump Metrics Jobs DLQ"
    Environment = "production"
    Purpose     = "Dead letter queue for failed job processing"
    Project     = "jump-metrics"
  }
}

# Main job processing queue
resource "aws_sqs_queue" "jobs_queue" {
  name = local.sqs_queue_name
  
  # Message retention: 14 days (max)
  message_retention_seconds = 1209600
  
  # Visibility timeout: 5 minutes (should be longer than max job processing time)
  visibility_timeout_seconds = 300
  
  # Message group ID for FIFO (not using FIFO for simplicity)
  # fifo_queue = false
  
  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3  # Retry up to 3 times before sending to DLQ
  })
  
  # Enable long polling for better performance
  receive_wait_time_seconds = 20
  
  tags = {
    Name         = "Jump Metrics Jobs Queue"
    Environment  = "production"
    Purpose      = "Main queue for job processing"
    Project = "jump-metrics"
  }
}

# Note: SQS permissions are already included in CAB432-Instance-Role

# Store queue URLs in Parameter Store for application access
resource "aws_ssm_parameter" "sqs_jobs_queue_url" {
  name  = "/jump-metrics/sqs/jobs-queue-url"
  type  = "String"
  value = aws_sqs_queue.jobs_queue.url
  
  tags = {
    Name         = "Jump Metrics SQS Jobs Queue URL"
    Environment  = "production"
    Project = "jump-metrics"
  }
}

resource "aws_ssm_parameter" "sqs_jobs_dlq_url" {
  name  = "/jump-metrics/sqs/jobs-dlq-url"
  type  = "String"
  value = aws_sqs_queue.jobs_dlq.url
  
  tags = {
    Name         = "Jump Metrics SQS Jobs DLQ URL"
    Environment  = "production"
    Project = "jump-metrics"
  }
}

# Outputs
output "sqs_jobs_queue_url" {
  description = "URL of the main jobs queue"
  value       = aws_sqs_queue.jobs_queue.url
}

output "sqs_jobs_dlq_url" {
  description = "URL of the jobs dead letter queue"
  value       = aws_sqs_queue.jobs_dlq.url
}

output "sqs_jobs_queue_arn" {
  description = "ARN of the main jobs queue"
  value       = aws_sqs_queue.jobs_queue.arn
}

output "sqs_jobs_dlq_arn" {
  description = "ARN of the jobs dead letter queue"
  value       = aws_sqs_queue.jobs_dlq.arn
}
