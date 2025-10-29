// DynamoDB client wrapper
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '../config/aws.js';
import { getParameterValue } from '../config/parameterStoreConfig.js';

let _docClient;
let _tableNames = null;

// Get table names from Parameter Store or fallback to environment
export async function getTableNames() {
  if (_tableNames) return _tableNames;

  try {
    const tablesJson = await getParameterValue('/jump-metrics/dynamodb/tables');
    if (tablesJson) {
      _tableNames = JSON.parse(tablesJson);
      console.log('📋 DynamoDB table names loaded from Parameter Store');
      return _tableNames;
    }
  } catch (error) {
    console.warn('⚠️ Failed to load table names from Parameter Store, using fallback');
  }

  // Fallback to environment variables
  _tableNames = {
    videos: process.env.DYNAMODB_TABLE_VIDEOS || 'jump-metrics-videos',
    sessions: process.env.DYNAMODB_TABLE_SESSIONS || 'jump-metrics-sessions',
    jumps: process.env.DYNAMODB_TABLE_JUMPS || 'jump-metrics-jumps',
    jobs: process.env.DYNAMODB_TABLE_JOBS || 'jump-metrics-jobs',
    media: process.env.DYNAMODB_TABLE_MEDIA || 'jump-metrics-media',
  };
  
  return _tableNames;
}

export function getDynamoDocClient() {
  if (_docClient) return _docClient;

  if (process.env.USE_LOCAL_DYNAMO === '1') {
    // Provide a minimal in-memory mock implementing send() for tests
    const store = new Map();
    const mock = {
      async send(command) {
        const name = command?.constructor?.name || '';
        if (name === 'PutCommand') {
          const { TableName, Item } = command.input;
          if (!store.has(TableName)) store.set(TableName, new Map());
          store.get(TableName).set(Item.videoId || Item.sessionId || Item.jobId || Item.mediaId, Item);
          return {};
        }
        if (name === 'GetCommand') {
          const { TableName, Key } = command.input;
          const table = store.get(TableName) || new Map();
          return { Item: table.get(Key.videoId || Key.sessionId || Key.jobId || Key.mediaId) };
        }
        if (name === 'UpdateCommand') {
          const { TableName, Key } = command.input;
          const table = store.get(TableName) || new Map();
          const item = table.get(Key.videoId || Key.sessionId || Key.jobId || Key.mediaId) || {};
          // naive merge for tests
          Object.assign(item, command.input.ExpressionAttributeValues || {});
          table.set(Key.videoId || Key.sessionId || Key.jobId || Key.mediaId, item);
          return {};
        }
        if (name === 'QueryCommand') {
          // return empty list for tests unless previously written
          const { TableName } = command.input;
          const table = store.get(TableName) || new Map();
          return { Items: Array.from(table.values()) };
        }
        return {};
      }
    };
    _docClient = mock;
    return _docClient;
  }

  const lowLevel = new DynamoDBClient({ region: awsConfig.region });
  _docClient = DynamoDBDocumentClient.from(lowLevel, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });

  return _docClient;
}


