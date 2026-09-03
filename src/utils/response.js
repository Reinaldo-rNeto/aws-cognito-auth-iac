"use strict";

// Monta uma resposta HTTP padronizada para o API Gateway, sempre com
// cabeçalhos CORS liberados — assim a API pode ser chamada diretamente de
// um front-end no navegador sem configuração adicional.
const buildResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
  },
  body: JSON.stringify(body, null, 2),
});

module.exports = { buildResponse };
