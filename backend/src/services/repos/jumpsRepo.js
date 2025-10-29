import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDocClient, getTableNames } from '../dynamoClient.js';

export const jumpsRepo = {
  async get(jumpId) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    const res = await client.send(new GetCommand({ TableName: tableNames.jumps, Key: { jumpId } }));
    return res.Item || null;
  },

  async put(item) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    await client.send(new PutCommand({ TableName: tableNames.jumps, Item: item }));
    return item;
  },

  async delete(jumpId) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    await client.send(new DeleteCommand({ TableName: tableNames.jumps, Key: { jumpId } }));
  },

  async listBySession(sessionId, { limit = 50, startKey } = {}) {
    const client = getDynamoDocClient();
    const tableNames = await getTableNames();
    const res = await client.send(new QueryCommand({
      TableName: tableNames.jumps,
      IndexName: 'session-index',
      KeyConditionExpression: '#s = :sessionId',
      ExpressionAttributeNames: { '#s': 'sessionId' },
      ExpressionAttributeValues: { ':sessionId': sessionId },
      Limit: limit,
      ExclusiveStartKey: startKey,
    }));
    return { items: res.Items || [], nextKey: res.LastEvaluatedKey };
  },

  async update(jumpId, attrs) {
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
      TableName: tableNames.jumps,
      Key: { jumpId },
      UpdateExpression: 'SET ' + exprs.join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  }
};


