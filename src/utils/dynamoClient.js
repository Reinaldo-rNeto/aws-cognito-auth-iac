"use strict";

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Quando rodando via `serverless-offline` (`npm run offline`), o plugin
// define IS_OFFLINE=true. Não usamos o DynamoDB Local aqui (veja o README):
// os testes automatizados usam o dynalite, então esse branch só entra em
// jogo se alguém rodar `npm run offline` manualmente com uma tabela local
// própria.
const client = new DynamoDBClient(
  process.env.IS_OFFLINE
    ? {
        region: "localhost",
        endpoint: "http://localhost:8000",
        credentials: {
          accessKeyId: "local",
          secretAccessKey: "local",
        },
      }
    : {}
);

const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME || "Items";

module.exports = { dynamoDb, TABLE_NAME };
