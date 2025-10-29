# Variables (sensitive values redacted)
$region = "ap-southeast-2"
$accountId = "REDACTED"  # AWS account ID redacted
$repository = "REDACTED"  # ECR repository name redacted
$imageName = "jump-metrics"
$tag = "latest"
$ecrUrl = "$accountId.dkr.ecr.$region.amazonaws.com"
$clusterName = "jump-metrics-cluster"

# Step 1. Try to login to ECR
Write-Host "Attempting ECR login..."
aws ecr get-login-password --region $region `
  | docker login --username AWS --password-stdin $ecrUrl

if ($LASTEXITCODE -ne 0) {
    Write-Host "ECR login failed. Trying aws sso login..."
    aws sso login
    if ($LASTEXITCODE -ne 0) {
        Write-Error "AWS SSO login failed. Aborting."
        exit 1
    }
    # Try login again
    aws ecr get-login-password --region $region `
      | docker login --username AWS --password-stdin $ecrUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Error "ECR login failed even after SSO. Aborting."
        exit 1
    }
}

# Step 2. Build the Docker image
Write-Host "Building Docker image..."
docker build -f Dockerfile -t ${imageName}:${tag} .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed."
    exit 1
}

# Step 3. Tag image for ECR
$fullImageName = "${ecrUrl}/${repository}:${tag}"
Write-Host "Tagging image as $fullImageName"
docker tag ${imageName}:${tag} $fullImageName

# Step 4. Push to ECR
Write-Host "Pushing image to ECR..."
docker push $fullImageName

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker push failed."
    exit 1
}

Write-Host "Deploy complete. Image available at: $fullImageName"

# Step 5. Apply Terraform to update infrastructure
Write-Host "Applying Terraform to update infrastructure..."
terraform apply -auto-approve -refresh=false

# Step 6. Update ECS services to use new image
Write-Host "Updating ECS services to use new image..."
Write-Host "Updating API service..."
aws ecs update-service --cluster $clusterName --service jump-metrics-api --force-new-deployment --no-cli-pager > $null

Write-Host "Updating Worker service..."
aws ecs update-service --cluster $clusterName --service jump-metrics-worker --force-new-deployment --no-cli-pager > $null

# Step 7. Wait for services to stabilize
Write-Host "Waiting for services to stabilize..."
aws ecs wait services-stable --cluster $clusterName --services jump-metrics-api jump-metrics-worker --no-cli-pager

# Step 8. Show updated outputs
Write-Host "Getting updated infrastructure outputs..."
terraform output -no-color

Write-Host "Complete deployment finished successfully!"
Write-Host "Summary:"
Write-Host "  - Docker image built and pushed to ECR"
Write-Host "  - Infrastructure updated with Terraform"
Write-Host "  - ECS services updated with new image"
Write-Host "  - Services are now running with latest code"