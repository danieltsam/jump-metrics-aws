data "aws_caller_identity" "current" {}

############################################
# AWS Cognito User Pool
############################################

resource "aws_cognito_user_pool" "jump_metrics_pool" {
  name = "jump-metrics-users"

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # User attributes
  alias_attributes = ["email"]
  
  # Auto-verified attributes
  auto_verified_attributes = ["email"]

  # Email configuration via Amazon SES to avoid Cognito daily limits
  email_configuration {
    email_sending_account = "DEVELOPER"
    from_email_address    = "Jump Metrics <jump-metrics@cab432.com>"
    source_arn            = "arn:aws:ses:ap-southeast-2:${data.aws_caller_identity.current.account_id}:identity/cab432.com"
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Schema for additional user attributes
  schema {
    attribute_data_type = "String"
    name               = "email"
    required           = true
    mutable            = true
  }

  schema {
    attribute_data_type = "String"
    name               = "role"
    required           = false
    mutable            = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 20
    }
  }


  tags = {
    Name    = "jump-metrics-user-pool"
    Project = "jump-metrics"
  }
}

############################################
# Cognito User Pool Client
############################################

resource "aws_cognito_user_pool_client" "jump_metrics_client" {
  name         = "jump-metrics-app"
  user_pool_id = aws_cognito_user_pool.jump_metrics_pool.id

  # Client settings
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation             = true
  enable_propagate_additional_user_context_data = false

  # Token validity
  access_token_validity  = 60    # 1 hour
  id_token_validity     = 60    # 1 hour  
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # OAuth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  # OAuth settings
  supported_identity_providers = ["COGNITO"]

  # Attributes
  read_attributes  = ["email", "custom:role"]
  write_attributes = ["email", "custom:role"]
}

############################################
# Default Admin User (Created manually or via AWS CLI)
############################################

# Note: Admin user can be created manually in AWS Console or via:
# aws cognito-idp admin-create-user \
#   --user-pool-id <POOL_ID> \
#   --username admin \
#   --user-attributes Name=email,Value=admin@jumpmetrics.local Name=email_verified,Value=true Name=custom:role,Value=admin \
#   --temporary-password TempPass123! \
#   --message-action SUPPRESS

############################################
# Cognito User Groups
############################################

resource "aws_cognito_user_group" "admin_group" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.jump_metrics_pool.id
  description  = "Administrator users with full access"
  precedence   = 1
}

