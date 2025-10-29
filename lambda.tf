################################################################################
# Lambda: DLQ Consumer (uses existing CAB432-Lambda-Role and CAB432SG if VPC)
################################################################################

locals {
  lambda_tags = merge(local.tags, {
    purpose = "assessment 3"
  })
}

data "aws_iam_role" "cab432_lambda_role" {
  name = "CAB432-Lambda-Role"
}

data "archive_file" "dlq_zip" {
  type        = "zip"
  source_dir  = "lambda/dlq"
  output_path = "lambda/dlq.zip"
}

resource "aws_lambda_function" "dlq_consumer" {
  function_name    = "jump-metrics-dlq-consumer"
  role             = data.aws_iam_role.cab432_lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.dlq_zip.output_path
  source_code_hash = data.archive_file.dlq_zip.output_base64sha256

  environment {
    variables = {
      QUEUE_NAME = local.sqs_dlq_name
    }
  }

  # Uncomment VPC config if needed to reach VPC-only resources (not required for SQS/Dynamo/S3)
  # vpc_config {
  #   security_group_ids = [data.aws_security_group.cab432sg.id]
  #   subnet_ids         = data.aws_subnets.vpc_subnets.ids
  # }

  tags = local.lambda_tags
}

resource "aws_lambda_event_source_mapping" "dlq_mapping" {
  event_source_arn = aws_sqs_queue.jobs_dlq.arn
  function_name    = aws_lambda_function.dlq_consumer.arn
  batch_size       = 5
  scaling_config {
    maximum_concurrency = 2
  }
  function_response_types = ["ReportBatchItemFailures"]
}


