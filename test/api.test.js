"use strict";

// Testes de integração dos handlers Lambda, rodando 100% offline: usa o
// dynalite (implementação do protocolo do DynamoDB em memória, em Node
// puro) no lugar de uma tabela real na AWS.
//
// O que NÃO é testado aqui: a validação do token JWT em si — isso é feito
// pelo autorizador COGNITO_USER_POOLS do próprio API Gateway, um serviço
// gerenciado da AWS, antes mesmo da Lambda ser chamada. Não há como (nem
// faria sentido) reimplementar isso localmente. O que os testes abaixo
// verificam é o que É responsabilidade do código: que os handlers leem
// corretamente as claims que o API Gateway injeta em
// `event.requestContext.authorizer.claims` depois de validar o token.
const test = require("node:test");
const assert = require("node:assert/strict");
const dynalite = require("dynalite");
const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");

process.env.IS_OFFLINE = "true";
process.env.TABLE_NAME = "Items-test";

const PORT = 8000;
let dynaliteServer;

test.before(async () => {
  dynaliteServer = dynalite({ createTableMs: 0 });
  await new Promise((resolve, reject) => {
    dynaliteServer.listen(PORT, (err) => (err ? reject(err) : resolve()));
  });

  const client = new DynamoDBClient({
    region: "localhost",
    endpoint: `http://localhost:${PORT}`,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  await client.send(
    new CreateTableCommand({
      TableName: process.env.TABLE_NAME,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );
});

test.after(async () => {
  await new Promise((resolve) => dynaliteServer.close(resolve));
});

// Os handlers só podem ser importados depois que IS_OFFLINE/TABLE_NAME
// estão definidos, pois src/utils/dynamoClient.js lê essas variáveis na
// primeira vez que o módulo é carregado.
const { handler: hello } = require("../src/hello");
const { handler: insertItem } = require("../src/insertItem");
const { handler: fetchItems } = require("../src/fetchItems");
const { handler: fetchItem } = require("../src/fetchItem");
const { handler: deleteItem } = require("../src/deleteItem");

// Monta um evento como o API Gateway envia para a Lambda depois de validar
// o token com o autorizador do Cognito, já com as claims decodificadas.
const withAuth = (email, overrides = {}) => ({
  requestContext: { authorizer: { claims: { email } } },
  ...overrides,
});

test("GET / responde 200 com uma mensagem (endpoint público, sem auth)", async () => {
  const res = await hello({});
  assert.equal(res.statusCode, 200);
  assert.match(JSON.parse(res.body).message, /API no ar/);
});

test("POST /items sem o campo 'descricao' retorna 400", async () => {
  const res = await insertItem(withAuth("usuaria@exemplo.com", { body: JSON.stringify({}) }));
  assert.equal(res.statusCode, 400);
});

test("POST /items com 'preco' negativo retorna 400", async () => {
  const res = await insertItem(
    withAuth("usuaria@exemplo.com", { body: JSON.stringify({ descricao: "Mouse", preco: -10 }) })
  );
  assert.equal(res.statusCode, 400);
});

test("item criado registra o e-mail autenticado (claim do Cognito) como createdBy", async () => {
  const res = await insertItem(
    withAuth("usuaria@exemplo.com", { body: JSON.stringify({ descricao: "Teclado mecânico", preco: 350 }) })
  );
  assert.equal(res.statusCode, 201);
  const item = JSON.parse(res.body);
  assert.equal(item.createdBy, "usuaria@exemplo.com");
  assert.equal(item.descricao, "Teclado mecânico");
  assert.equal(item.preco, 350);
});

test("fluxo completo: criar, listar, buscar e remover um item", async () => {
  // Criar
  const created = await insertItem(
    withAuth("dev@exemplo.com", { body: JSON.stringify({ descricao: "Monitor 27''", preco: 1200 }) })
  );
  assert.equal(created.statusCode, 201);
  const newItem = JSON.parse(created.body);
  assert.ok(newItem.id);

  // Listar
  const listed = await fetchItems();
  assert.equal(listed.statusCode, 200);
  const items = JSON.parse(listed.body);
  assert.ok(items.some((i) => i.id === newItem.id));

  // Buscar por id
  const fetched = await fetchItem(withAuth("dev@exemplo.com", { pathParameters: { id: newItem.id } }));
  assert.equal(fetched.statusCode, 200);
  assert.equal(JSON.parse(fetched.body).id, newItem.id);

  // Buscar id inexistente -> 404
  const notFound = await fetchItem(withAuth("dev@exemplo.com", { pathParameters: { id: "nao-existe" } }));
  assert.equal(notFound.statusCode, 404);

  // Remover
  const deleted = await deleteItem(withAuth("dev@exemplo.com", { pathParameters: { id: newItem.id } }));
  assert.equal(deleted.statusCode, 200);

  // Confirma que sumiu
  const afterDelete = await fetchItem(withAuth("dev@exemplo.com", { pathParameters: { id: newItem.id } }));
  assert.equal(afterDelete.statusCode, 404);

  // Remover de novo -> 404
  const deleteAgain = await deleteItem(withAuth("dev@exemplo.com", { pathParameters: { id: newItem.id } }));
  assert.equal(deleteAgain.statusCode, 404);
});
