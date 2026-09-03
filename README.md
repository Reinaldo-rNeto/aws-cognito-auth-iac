# aws-cognito-auth-iac

API REST na AWS (API Gateway + Lambda + DynamoDB) protegida por um **autorizador do Amazon Cognito**, provisionada inteiramente como **Infraestrutura como Código** com o [Serverless Framework](https://www.serverless.com/) — a partir do desafio "Autenticação e autorização com Amazon Cognito" do bootcamp da [DIO](https://www.dio.me/), com base na [implementação de referência do expert](https://github.com/cassianobrexbit/dio-live-cognito).

A API implementa um CRUD simples de "itens": criar, listar, buscar por id e remover. Todos os endpoints, exceto o healthcheck, exigem um **token JWT válido emitido por um Cognito User Pool** — sem token (ou com token inválido/expirado), o API Gateway rejeita a chamada com `401` antes mesmo dela chegar à Lambda.

## Endpoints

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| GET | `/` | Nenhuma | Healthcheck simples |
| POST | `/items` | Cognito (Bearer token) | Cria um item — body: `{ "descricao": "texto", "preco": 10.5 }` |
| GET | `/items` | Cognito (Bearer token) | Lista todos os itens |
| GET | `/items/{id}` | Cognito (Bearer token) | Busca um item pelo id |
| DELETE | `/items/{id}` | Cognito (Bearer token) | Remove um item |

## Arquitetura

```
Cliente (Postman)
    │
    │  1. Login no Hosted UI do Cognito -> recebe um token JWT
    ▼
Cognito User Pool  ─────────────────────────────┐
    │                                            │ 2. token no header
    │                                            │    Authorization
    ▼                                            ▼
API Gateway (REST API) ──▶ Autorizador COGNITO_USER_POOLS ──▶ valida o token
    │ (token válido)
    ▼
AWS Lambda (Node.js 20.x) ──▶ DynamoDB (tabela Items)
```

O autorizador do Cognito roda **dentro do API Gateway**, como um passo gerenciado pela AWS antes da Lambda ser invocada — o código da Lambda nunca precisa validar o token manualmente, só lê as claims (como o e-mail do usuário) que o API Gateway já decodificou e injeta em `event.requestContext.authorizer.claims`.

Todo o stack — User Pool, App Client, domínio do Hosted UI, tabela do DynamoDB, as 5 funções Lambda, o autorizador do Cognito e a role do IAM com permissão apenas nas ações necessárias — é criado e gerenciado pelo CloudFormation por trás do Serverless Framework. Nada é criado manualmente no console da AWS.

## Diferenças em relação à implementação de referência

A [implementação original](https://github.com/cassianobrexbit/dio-live-cognito) é um roteiro para configurar tudo manualmente no console da AWS (API Gateway, DynamoDB, Lambda, Cognito, o autorizador) e traz o código de **uma única** função Lambda. Esta versão parte do mesmo objetivo (API protegida por um autorizador do Cognito) mas com uma abordagem diferente:

- **100% Infraestrutura como Código**: nenhum passo manual no console. User Pool, App Client, domínio do Hosted UI, tabela, funções e o autorizador do Cognito são todos definidos no `serverless.yml` e reproduzíveis com um único `serverless deploy`.
- **CRUD completo**: a referência só tinha a função de inserir item (`put_item_function.js`). Aqui há também listar, buscar por id e remover — todos protegidos pelo mesmo autorizador do Cognito.
- **AWS SDK v3**: a versão original usa o `aws-sdk` v2 (fim de suporte). Aqui os handlers usam `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` (v3).
- **Runtime atualizado**: `nodejs20.x`.
- **Validação de entrada e códigos HTTP corretos**: a função original sempre retorna `200`, mesmo quando o DynamoDB lança um erro (o `catch` também responde `200` com o erro serializado no corpo). Aqui: `400` para corpo inválido/campo faltando, `404` quando o item não existe, `201` ao criar, `500` só em erro real de infraestrutura — e é o **API Gateway** quem responde `401`/`403` quando o token está ausente, é inválido ou expirou, sem a Lambda sequer ser chamada.
- **Usa as claims do token**: ao criar um item, o handler grava em `createdBy` o e-mail do usuário autenticado, lido de `event.requestContext.authorizer.claims.email` — nunca de um campo do body, que o cliente poderia forjar.
- **Nome da tabela e do User Pool via variável de ambiente**, sem valores fixos espalhados pelo código.
- **Testável sem AWS**: com o [dynalite](https://github.com/mhart/dynalite) (emulador do DynamoDB em memória, Node puro), `npm test` roda o fluxo completo do CRUD contra os handlers reais — simulando o formato do evento que o API Gateway envia depois de validar o token, sem precisar de conta AWS.
- **Coleção do Postman incluída** (`postman/aws-cognito-auth-iac.postman_collection.json`), já configurada para o fluxo OAuth 2.0 do Cognito — a referência só descrevia esses passos em texto.

## Testando sem custo, sem conta AWS

```bash
npm install
npm test
```

O `npm test` sobe uma tabela DynamoDB em memória (via `dynalite`) e executa os handlers reais (criar, listar, buscar, remover, casos de erro), simulando o evento que o API Gateway envia depois de validar o token do Cognito — é a forma mais rápida de validar a lógica de negócio.

> **O que não dá para testar localmente**: a validação do token JWT em si é feita pelo autorizador do Cognito dentro do API Gateway, um serviço gerenciado da AWS — não há como (nem faria sentido) reproduzir isso localmente. É por isso que os testes automatizados focam no que é responsabilidade do código: ler e usar corretamente as claims que o API Gateway já validou.

## Publicando na AWS de verdade

1. Ter uma conta AWS e o [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) instalado.
2. Criar um usuário no IAM com permissão programática e configurar as credenciais:

   ```bash
   aws configure
   ```

3. Instalar o Serverless Framework e as dependências do projeto:

   ```bash
   npm install -g serverless@3
   npm install
   ```

4. Fazer o deploy:

   ```bash
   npx serverless deploy -v
   ```

   Ao final, o Serverless Framework imprime as URLs da API e, na seção `Stack Outputs`, o `UserPoolId`, o `UserPoolClientId` e o `UserPoolDomain` — você vai precisar desses três valores no próximo passo.

   > O domínio do Hosted UI (`CognitoUserPoolDomain` no `serverless.yml`) precisa ser único em **toda a AWS**. Se o deploy falhar com um erro de domínio já existente, troque o valor de `Domain` no `serverless.yml` (por exemplo, acrescentando seu nome ou um número) e rode o deploy de novo.

5. Para remover tudo da AWS (evitar cobranças):

   ```bash
   npx serverless remove
   ```

## Testando a API protegida no Postman

1. Importe `postman/aws-cognito-auth-iac.postman_collection.json` no Postman.
2. Na coleção, abra a aba **Variables** e preencha `api_base_url`, `cognito_domain` e `cognito_client_id` com os valores que o `serverless deploy` imprimiu no passo anterior.
3. Abra a requisição **"Criar item (POST /items)"** → aba **Authorization** → clique em **"Get New Access Token"**. O Postman abre o Hosted UI do Cognito: use o link **"Sign up"** para criar um usuário de teste (ou faça login, se já tiver um) — como `AutoVerifiedAttributes` está ativado, o Cognito manda um código de verificação por e-mail.
4. Depois de logar, o Postman captura o token automaticamente e passa a usá-lo no header `Authorization`. Clique em **"Use Token"** e depois em **Send**.
5. Copie o `id` retornado na criação e cole na variável `item_id` da coleção para testar as requisições de busca e remoção.
6. A requisição **"Criar item sem token (esperado: 401)"** mostra o autorizador do Cognito bloqueando a chamada — repare que ela nunca chega a executar a Lambda.

## Estrutura do projeto

```
serverless.yml          # infraestrutura: Cognito, DynamoDB, API Gateway, Lambda, IAM
src/
  hello.js              # GET / (público)
  insertItem.js         # POST /items (protegido)
  fetchItems.js         # GET /items (protegido)
  fetchItem.js          # GET /items/{id} (protegido)
  deleteItem.js         # DELETE /items/{id} (protegido)
  utils/
    dynamoClient.js      # client do DynamoDB (SDK v3)
    response.js           # helper de resposta HTTP padronizada com CORS
    auth.js                # extrai o e-mail autenticado das claims do Cognito
test/
  api.test.js            # testes de integração do CRUD, usando dynalite
postman/
  aws-cognito-auth-iac.postman_collection.json   # coleção pronta com OAuth 2.0
```

## Sobre o projeto

Desafio de projeto do módulo de Cloud/AWS da [DIO](https://www.dio.me/) ("Autenticação e autorização com Amazon Cognito"), a partir da [implementação de referência do expert](https://github.com/cassianobrexbit/dio-live-cognito).

## Licença

Distribuído sob a licença MIT — veja [LICENSE](LICENSE).
