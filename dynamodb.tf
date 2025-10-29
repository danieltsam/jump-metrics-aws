############################################
# DynamoDB Tables
############################################

resource "aws_dynamodb_table" "videos" {
  name         = "jump-metrics-videos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "videoId"

  attribute {
    name = "videoId"
    type = "S"
  }
  attribute {
    name = "owner"
    type = "S"
  }

  global_secondary_index {
    name            = "owner-index"
    hash_key        = "owner"
    projection_type = "ALL"
  }

  lifecycle {
    ignore_changes = all
  }

  tags = {
    Name    = "jump-metrics-videos"
    Project = "jump-metrics"
  }
}

resource "aws_dynamodb_table" "sessions" {
  name         = "jump-metrics-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }
  attribute {
    name = "owner"
    type = "S"
  }

  global_secondary_index {
    name            = "owner-index"
    hash_key        = "owner"
    projection_type = "ALL"
  }

  lifecycle {
    ignore_changes = all
  }

  tags = {
    Name         = "jump-metrics-sessions"
    Project = "jump-metrics"
  }
}

resource "aws_dynamodb_table" "jumps" {
  name         = "jump-metrics-jumps"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jumpId"

  attribute {
    name = "jumpId"
    type = "S"
  }
  attribute {
    name = "sessionId"
    type = "S"
  }

  global_secondary_index {
    name            = "session-index"
    hash_key        = "sessionId"
    projection_type = "ALL"
  }

  lifecycle {
    ignore_changes = all
  }

  tags = {
    Name         = "jump-metrics-jumps"
    Project = "jump-metrics"
  }
}

resource "aws_dynamodb_table" "jobs" {
  name         = "jump-metrics-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"

  attribute {
    name = "jobId"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "owner"
    type = "S"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "owner-index"
    hash_key        = "owner"
    projection_type = "ALL"
  }

  lifecycle {
    ignore_changes = all
  }

  tags = {
    Name         = "jump-metrics-jobs"
    Project = "jump-metrics"
  }
}

resource "aws_dynamodb_table" "media" {
  name         = "jump-metrics-media"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "mediaId"

  attribute {
    name = "mediaId"
    type = "S"
  }
  attribute {
    name = "owner"
    type = "S"
  }

  global_secondary_index {
    name            = "owner-index"
    hash_key        = "owner"
    projection_type = "ALL"
  }

  lifecycle {
    ignore_changes = all
  }

  tags = {
    Name         = "jump-metrics-media"
    Project = "jump-metrics"
  }
}



