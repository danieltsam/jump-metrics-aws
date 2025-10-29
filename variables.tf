###############################################################################
# Variables for Jump Metrics Infrastructure
###############################################################################

variable "ecr_repository_name" {
  type        = string
  description = "Name of the ECR repository for container images"
  default     = "jump-metrics"
}

variable "ecs_task_execution_role_arn" {
  type        = string
  description = "ARN of the IAM role for ECS task execution"
}

variable "ecs_task_role_arn" {
  type        = string
  description = "ARN of the IAM role for ECS tasks"
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC to deploy resources into"
  default     = ""
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for ECS services and ALB"
}

variable "security_group_ids" {
  type        = list(string)
  description = "List of security group IDs for ECS services and ALB"
}

