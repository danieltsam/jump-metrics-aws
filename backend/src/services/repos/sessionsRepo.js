import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDocClient, getTableNames } from '../dynamoClient.js';

export const sessionsRepo = {
  async get(sessionId) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    const res = await client.send(new GetCommand({ TableName: tableNames.sessions, Key: { sessionId } }));
    return res.Item || null;
  },

  async put(item) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    await client.send(new PutCommand({ TableName: tableNames.sessions, Item: item }));
    return item;
  },

  async listByOwner(owner, { limit = 20, startKey } = {}) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    const res = await client.send(new QueryCommand({
      TableName: tableNames.sessions,
      IndexName: 'owner-index',
      KeyConditionExpression: '#o = :owner',
      ExpressionAttributeNames: { '#o': 'owner' },
      ExpressionAttributeValues: { ':owner': owner },
      Limit: limit,
      ExclusiveStartKey: startKey,
    }));
    return { items: res.Items || [], nextKey: res.LastEvaluatedKey };
  },

  async update(sessionId, attrs) {
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
      TableName: tableNames.sessions,
      Key: { sessionId },
      UpdateExpression: 'SET ' + exprs.join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  }
};


