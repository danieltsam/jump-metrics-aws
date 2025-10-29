# Jump Metrics — Cloud-Native Vertical Jump Analyzer  


## Overview  

**Jump Metrics** is a web app that measures vertical jump height from user-uploaded videos.  
Part of uni coursework for CAB432 that explored AWS. 

---

## ⚙️ Evolution  

| Stage | Description |
|--------|-------------|
| **Local app** | Node.js with data stored in JSON and FFmpeg. |
| **EC2 monolith + DynamoDB** | Single container running with systemd service connected to DynamoDB. |
| **ECS migration** | Split into API and Worker microservices. |
| **S3 + CloudFront** | Static frontend hosted and cached globally. |
| **SQS** | Swapped DynamoDB for async job processing. |

---

## ☁️ Architecture  

- **Frontend:** S3 + CloudFront (HTTPS via ACM + Route53)  
- **API (ECS):** Handles uploads and queues jobs  
- **Worker (ECS):** Processes videos with FFmpeg  
- **Cognito:** Manages user authentication and authorization  
- **SQS:** Connects API and Worker, with DLQ + Lambda consumer  
- **DynamoDB:** Stores job and video metadata  
- **Terraform:** Builds it all  
- **PowerShell (`deploy.ps1`):** Automates login, build, push, apply, and redeploy in one command. 


---

*site isn't live :(, aws too expensive*# jump-metrics-aws
