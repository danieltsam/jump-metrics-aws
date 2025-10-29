import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDocClient, getTableNames } from '../dynamoClient.js';

// Track which operations have already shown permission warnings
const permissionWarningsShown = new Set();

// Helper function to handle DynamoDB permission errors gracefully
function handleDynamoError(error, operation, fallback = null) {
  if (error.name === 'AccessDeniedException') {
    // Only show warning once per operation type to avoid spam
    const opType = operation.split('(')[0]; // Extract operation name without parameters
    if (!permissionWarningsShown.has(opType)) {
      console.warn(`⚠️  DynamoDB permission denied for ${opType}. Student account limitation - using fallback mode.`);
      permissionWarningsShown.add(opType);
    }
    return fallback;
  }
  throw error;
}


export const jobsRepo = {
  async get(jobId) {
    try {
      const client = getDynamoDocClient();
      const tableNames = await getTableNames();
      const res = await client.send(new GetCommand({ TableName: tableNames.jobs, Key: { jobId } }));
      return res.Item || null;
    } catch (error) {
      return handleDynamoError(error, `get(${jobId})`, null);
    }
  },

  async put(item) {
    try {
      const client = getDynamoDocClient();
      const tableNames = await getTableNames();
      await client.send(new PutCommand({ TableName: tableNames.jobs, Item: item }));
      return item;
    } catch (error) {
      return handleDynamoError(error, `put(${item.jobId})`, item);
    }
  },

  async listByStatus(status, { limit = 50, startKey } = {}) {
    try {
      const client = getDynamoDocClient();
      const tableNames = await getTableNames();
      const res = await client.send(new QueryCommand({
        TableName: tableNames.jobs,
        IndexName: 'status-index',
        KeyConditionExpression: '#s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': status },
        Limit: limit,
        ExclusiveStartKey: startKey,
      }));
      return { items: res.Items || [], nextKey: res.LastEvaluatedKey };
    } catch (error) {
      return handleDynamoError(error, `listByStatus(${status})`, { items: [], nextKey: null });
    }
  },

  async listByOwner(owner, { limit = 50, startKey } = {}) {
    try {
      const client = getDynamoDocClient();
      const tableNames = await getTableNames();
      const res = await client.send(new QueryCommand({
        TableName: tableNames.jobs,
        IndexName: 'owner-index',
        KeyConditionExpression: '#o = :owner',
        ExpressionAttributeNames: { '#o': 'owner' },
        ExpressionAttributeValues: { ':owner': owner },
        Limit: limit,
        ExclusiveStartKey: startKey,
      }));
      return { items: res.Items || [], nextKey: res.LastEvaluatedKey };
    } catch (error) {
      return handleDynamoError(error, `listByOwner(${owner})`, { items: [], nextKey: null });
    }
  },

  async update(jobId, attrs) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    const exprs = [];
    const names = {};
    const values = {};
    for (const [k, v] of Object.entries(attrs)) {
      exprs.push(`#${k} = :${k}`);
      names[`#${k}`] = k;
      values[`:${k}`] = v;
    }
    await client.send(new UpdateCommand({
      TableName: tableNames.jobs,
      Key: { jobId },
      UpdateExpression: 'SET ' + exprs.join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  }
};


