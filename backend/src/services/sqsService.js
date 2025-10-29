// AI GENERATED FILE - This file was created by an AI assistant
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { parameterStoreService } from './parameterStoreService.js';

class SQSService {
  constructor() {
    this.client = null;
    this.queueUrl = null;
    this.dlqUrl = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.client = new SQSClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
      
      // Get queue URLs from Parameter Store
      this.queueUrl = await parameterStoreService.getParameter('/jump-metrics/sqs/jobs-queue-url');
      this.dlqUrl = await parameterStoreService.getParameter('/jump-metrics/sqs/jobs-dlq-url');
      
      if (!this.queueUrl || !this.dlqUrl) {
        throw new Error('SQS queue URLs not found in Parameter Store');
      }
      
      this.initialized = true;
      console.log('[SQS] Service initialized successfully');
      console.log('[SQS] Main queue URL:', this.queueUrl);
      console.log('[SQS] DLQ URL:', this.dlqUrl);
    } catch (error) {
      console.error('[SQS] Failed to initialize:', error);
      throw error;
    }
  }

  async sendJobMessage(jobData) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(jobData),
        MessageAttributes: {
          jobType: {
            DataType: 'String',
            StringValue: jobData.type || 'unknown'
          },
          jobId: {
            DataType: 'String',
            StringValue: jobData.jobId || 'unknown'
          },
          targetType: {
            DataType: 'String',
            StringValue: jobData.targetType || 'unknown'
          },
          targetId: {
            DataType: 'String',
            StringValue: jobData.targetId || 'unknown'
          }
        }
      });

      const result = await this.client.send(command);
      console.log('[SQS] Job message sent:', result.MessageId);
      return result;
    } catch (error) {
      console.error('[SQS] Failed to send job message:', error);
      throw error;
    }
  }

  async receiveJobMessages(maxMessages = 1, waitTimeSeconds = 20) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: waitTimeSeconds,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All']
      });

      const result = await this.client.send(command);
      return result.Messages || [];
    } catch (error) {
      console.error('[SQS] Failed to receive job messages:', error);
      throw error;
    }
  }

  async deleteJobMessage(receiptHandle) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle
      });

      await this.client.send(command);
      console.log('[SQS] Job message deleted:', receiptHandle);
    } catch (error) {
      console.error('[SQS] Failed to delete job message:', error);
      throw error;
    }
  }

  async getQueueAttributes() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
      });

      const result = await this.client.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('[SQS] Failed to get queue attributes:', error);
      throw error;
    }
  }

  async getDLQAttributes() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.dlqUrl,
        AttributeNames: ['ApproximateNumberOfMessages']
      });

      const result = await this.client.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('[SQS] Failed to get DLQ attributes:', error);
      throw error;
    }
  }
}

export const sqsService = new SQSService();
