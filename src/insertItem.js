"use strict";

const { v4: uuidv4 } = require("uuid");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDb, TABLE_NAME } = require("./utils/dynamoClient");
const { buildResponse } = require("./utils/response");
const { getAuthenticatedEmail } = require("./utils/auth");

const insertItem = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return buildResponse(400, { message: "Corpo da requisição precisa ser um JSON válido." });
  }

  const { descricao, preco } = body;
  if (!descricao || typeof descricao !== "string" || !descricao.trim()) {
    return buildResponse(400, { message: "O campo 'descricao' é obrigatório e precisa ser uma string." });
  }
  if (preco !== undefined && (typeof preco !== "number" || Number.isNaN(preco) || preco < 0)) {
    return buildResponse(400, { message: "O campo 'preco', quando enviado, precisa ser um número maior ou igual a zero." });
  }

  const newItem = {
    id: uuidv4(),
    descricao: descricao.trim(),
    preco: preco ?? null,
    // Quem criou o item, extraído do token do Cognito validado pelo API
    // Gateway — nunca confiamos em um campo "autor" vindo do body.
    createdBy: getAuthenticatedEmail(event) || "desconhecido",
    createdAt: new Date().toISOString(),
  };

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newItem,
      })
    );
  } catch (error) {
    console.error("Erro ao inserir item no DynamoDB:", error);
    return buildResponse(500, { message: "Não foi possível salvar o item." });
  }

  return buildResponse(201, newItem);
};

module.exports = { handler: insertItem };
