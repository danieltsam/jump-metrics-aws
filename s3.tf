############################################
# S3 Bucket
############################################

resource "aws_s3_bucket" "jump_metrics_storage" {
  bucket = "jump-metrics-storage"


  tags = {
    Name    = "jump-metrics-storage"
    Project = "jump-metrics"
  }
}

resource "aws_s3_bucket_public_access_block" "jump_metrics_pab" {
  bucket = aws_s3_bucket.jump_metrics_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}


