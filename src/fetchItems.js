"use strict";

const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDb, TABLE_NAME } = require("./utils/dynamoClient");
const { buildResponse } = require("./utils/response");

const fetchItems = async () => {
  try {
    const results = await dynamoDb.send(new ScanCommand({ TableName: TABLE_NAME }));
    return buildResponse(200, results.Items || []);
  } catch (error) {
    console.error("Erro ao listar itens no DynamoDB:", error);
    return buildResponse(500, { message: "Não foi possível listar os itens." });
  }
};

module.exports = { handler: fetchItems };
