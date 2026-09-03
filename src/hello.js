"use strict";

const { buildResponse } = require("./utils/response");

// Único endpoint público da API (sem autorizador do Cognito) — útil para
// confirmar rapidamente que o deploy funcionou, sem precisar de um token.
const hello = async () => {
  return buildResponse(200, {
    message: "API no ar! Os demais endpoints exigem um token do Cognito — veja o README.",
  });
};

module.exports = { handler: hello };
