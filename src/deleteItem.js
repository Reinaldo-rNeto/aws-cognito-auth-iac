"use strict";

const { DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDb, TABLE_NAME } = require("./utils/dynamoClient");
const { buildResponse } = require("./utils/response");

const deleteItem = async (event) => {
  const { id } = event.pathParameters || {};
  if (!id) {
    return buildResponse(400, { message: "O parâmetro 'id' é obrigatório." });
  }

  try {
    const existing = await dynamoDb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { id } })
    );
    if (!existing.Item) {
      return buildResponse(404, { message: `Item '${id}' não encontrado.` });
    }

    await dynamoDb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));

    return buildResponse(200, { message: `Item '${id}' removido.` });
  } catch (error) {
    console.error("Erro ao remover item no DynamoDB:", error);
    return buildResponse(500, { message: "Não foi possível remover o item." });
  }
};

module.exports = { handler: deleteItem };
