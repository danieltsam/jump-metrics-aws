// ECS cluster, services (API + Worker), ALB for API, and autoscaling for Worker
// All resources tagged for QUT assessment

// required_providers is defined in providers.tf

###############################################################################
# Data sources: account/region, default VPC and subnets
###############################################################################

# Get default VPC or use variable
data "aws_vpc" "main" {
  default = true
}

# Get all subnets in the VPC
data "aws_subnets" "vpc_subnets" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
}

# Get public subnets specifically
data "aws_subnets" "public_subnets" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  
  filter {
    name   = "tag:Name"
    values = ["aws-controltower-PublicSubnet*"]
  }
}

# Data sources for current account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

###############################################################################
# Locals
###############################################################################
locals {
  name_prefix = "jump-metrics"

  tags = {
    # Add your project tags here
    project = "jump-metrics"
  }

  api_container_name    = "jump-metrics-api"
  worker_container_name = "jump-metrics-worker"

  // ECR images (built by scripts/deploy.ps1)
  ecr_repo_account = data.aws_caller_identity.current.account_id
  ecr_repo_region  = data.aws_region.current.name
  ecr_repo_name    = var.ecr_repository_name
  api_image        = "${local.ecr_repo_account}.dkr.ecr.${local.ecr_repo_region}.amazonaws.com/${local.ecr_repo_name}:latest"
  worker_image     = "${local.ecr_repo_account}.dkr.ecr.${local.ecr_repo_region}.amazonaws.com/${local.ecr_repo_name}:latest"
}

###############################################################################
# CloudWatch Log Groups
###############################################################################
resource "aws_cloudwatch_log_group" "api" {
  name = "/ecs/${local.name_prefix}-api"
}

resource "aws_cloudwatch_log_group" "worker" {
  name = "/ecs/${local.name_prefix}-worker"
}

###############################################################################
# IAM Roles for ECS Tasks
###############################################################################
# Using pre-existing IAM roles (or create your own)
locals {
  ecs_task_execution_role_arn = var.ecs_task_execution_role_arn
  ecs_task_role_arn          = var.ecs_task_role_arn
}

###############################################################################
# ECS Cluster
###############################################################################
resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  
  tags = local.tags
}

###############################################################################
# ALB for API service
###############################################################################

resource "aws_lb" "api" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = var.security_group_ids
  subnets            = var.subnet_ids
  enable_deletion_protection = false
  tags               = local.tags
}

resource "aws_lb_target_group" "api" {
  name_prefix = "jm-tg-"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 30
    timeout             = 5
    matcher             = "200-399"
    path                = "/api/v1/healthz"
  }

  tags = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

# HTTP listener removed - using HTTPS only for better security
# If you need HTTP, uncomment the http_redirect resource below to redirect HTTP to HTTPS

###############################################################################
# ECS Task Definitions (Fargate)
###############################################################################
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  cpu                      = "256"
  memory                   = "512"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = local.ecs_task_execution_role_arn
  task_role_arn            = local.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = local.api_container_name
      image = local.api_image
      essential = true
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "8080" },
        { name = "AWS_REGION", value = data.aws_region.current.name }
      ]
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name,
          awslogs-region        = data.aws_region.current.name,
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  cpu                      = "512"
  memory                   = "1024"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = local.ecs_task_execution_role_arn
  task_role_arn            = local.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name       = local.worker_container_name
      image      = local.worker_image
      essential  = true
      command    = ["node", "backend/src/worker.js"]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "WORKER_HEALTH_PORT", value = "9090" },
        { name = "AWS_REGION", value = data.aws_region.current.name }
      ]
      portMappings = [
        { containerPort = 9090, hostPort = 9090, protocol = "tcp" }
      ]
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group         = aws_cloudwatch_log_group.worker.name,
          awslogs-region        = data.aws_region.current.name,
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

###############################################################################
# ECS Services
###############################################################################
resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = local.api_container_name
    container_port   = 8080
  }

  

  depends_on = [aws_lb_listener.https]
  tags       = local.tags
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
    assign_public_ip = true
  }

  

  tags = local.tags
}

###############################################################################
# Application Auto Scaling for Worker service (CPU target tracking 70%)
###############################################################################
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

// Step scaling on SQS backlog (custom metric instead of CPU)


# Target tracking policy: maintain ~3 messages per running worker
resource "aws_appautoscaling_policy" "worker_target_tracking" {
  name               = "${local.name_prefix}-worker-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 3
    disable_scale_in   = false
    scale_in_cooldown  = 30
    scale_out_cooldown = 30

    customized_metric_specification {
      # Metric math: visible messages divided by running task count (min 1)
      metrics {
        id = "m1"
        return_data = false
        metric_stat {
          metric {
            namespace   = "AWS/SQS"
            metric_name = "ApproximateNumberOfMessagesVisible"
            dimensions {
              name  = "QueueName"
              value = split("/", aws_sqs_queue.jobs_queue.id)[length(split("/", aws_sqs_queue.jobs_queue.id)) - 1]
            }
          }
          stat = "Average"
        }
      }

      metrics {
        id = "m2"
        return_data = false
        metric_stat {
          metric {
            namespace   = "ECS/ContainerInsights"
            metric_name = "RunningTaskCount"
            dimensions {
              name  = "ClusterName"
              value = aws_ecs_cluster.this.name
            }
            dimensions {
              name  = "ServiceName"
              value = aws_ecs_service.worker.name
            }
          }
          stat = "Average"
        }
      }

      metrics {
        id           = "messagesPerTask"
        expression   = "m1 / (m2 + 0.001)"
        label        = "MessagesPerWorker"
        return_data  = true
      }
    }
  }
}

###############################################################################
# HTTPS Listener for ALB (attach ACM cert)
###############################################################################
variable "acm_certificate_arn" {
  type        = string
  description = "ARN of an existing ACM certificate for the API domain"
  default     = ""
}

resource "aws_lb_listener" "https" {
  count             = length(var.acm_certificate_arn) > 0 ? 1 : 0
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

// Redirect HTTP to HTTPS if cert provided
resource "aws_lb_listener" "http_redirect" {
  count             = length(var.acm_certificate_arn) > 0 ? 1 : 0
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

###############################################################################
# Outputs and SSM parameter for API URL
###############################################################################
resource "aws_ssm_parameter" "api_url" {
  name  = "/jump-metrics/api-base-url"
  type  = "String"
  value = "http://${aws_lb.api.dns_name}"
  tags  = local.tags
}

output "ecs_api_url" {
  value = aws_ssm_parameter.api_url.value
  sensitive = true
}


output "alb_dns_name" {
  description = "Public DNS name of the API ALB"
  value       = aws_lb.api.dns_name
}


