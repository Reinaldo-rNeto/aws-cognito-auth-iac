"use strict";

const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDb, TABLE_NAME } = require("./utils/dynamoClient");
const { buildResponse } = require("./utils/response");

const fetchItem = async (event) => {
  const { id } = event.pathParameters || {};
  if (!id) {
    return buildResponse(400, { message: "O parâmetro 'id' é obrigatório." });
  }

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      })
    );

    if (!result.Item) {
      return buildResponse(404, { message: `Item '${id}' não encontrado.` });
    }

    return buildResponse(200, result.Item);
  } catch (error) {
    console.error("Erro ao buscar item no DynamoDB:", error);
    return buildResponse(500, { message: "Não foi possível buscar o item." });
  }
};

module.exports = { handler: fetchItem };
