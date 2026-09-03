"use strict";

// Quando um endpoint é protegido pelo autorizador COGNITO_USER_POOLS no
// serverless.yml, o API Gateway já validou o JWT antes de invocar a Lambda
// e injeta as claims do token decodificado em
// `event.requestContext.authorizer.claims`. Não é preciso (nem seria
// seguro tentar) decodificar o token de novo aqui — é só ler o que o
// próprio API Gateway já verificou.
const getAuthenticatedEmail = (event) => {
  const claims = event?.requestContext?.authorizer?.claims;
  return claims?.email || null;
};

module.exports = { getAuthenticatedEmail };
