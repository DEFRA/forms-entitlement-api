# forms-entitlement-api

Core delivery platform Node.js Backend Template.

- [forms-entitlement-api](#forms-entitlement-api)
  - [Requirements](#requirements)
    - [Node.js](#nodejs)
  - [Local development](#local-development)
    - [Setup](#setup)
    - [Development](#development)
    - [Testing](#testing)
      - [Unit Tests](#unit-tests)
      - [Integration Tests](#integration-tests)
    - [Production](#production)
    - [Npm scripts](#npm-scripts)
    - [Update dependencies](#update-dependencies)
    - [Formatting](#formatting)
      - [Windows prettier issue](#windows-prettier-issue)
  - [API endpoints](#api-endpoints)
  - [Development helpers](#development-helpers)
    - [MongoDB Locks](#mongodb-locks)
    - [Proxy](#proxy)
  - [Docker](#docker)
    - [Development image](#development-image)
    - [Production image](#production-image)
    - [Docker Compose](#docker-compose)
    - [Dependabot](#dependabot)
    - [SonarCloud](#sonarcloud)
  - [Licence](#licence)
    - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd forms-entitlement-api
nvm use
```

## Local development

### Setup

1. Install Docker

2. Bring up runtime dependencies

```bash
docker compose up
```

3. Create a `.env` file with the following mandatory environment variables populated at root level:

```text
MONGO_URI="mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"

# DefraDev
OIDC_JWKS_URI="https://login.microsoftonline.com/<TENANT_HERE>/discovery/v2.0/keys"
OIDC_VERIFY_AUD="<AUD_HERE>"
OIDC_VERIFY_ISS="https://login.microsoftonline.com/<TENANT_HERE>/v2.0"
ROLE_EDITOR_GROUP_ID="<GROUP_ID_TO_BE_INSERTED_HERE>"

AZURE_CLIENT_ID="<CLIENT_ID_TO_BE_INSERTED_HERE>"
AZURE_CLIENT_SECRET="<CLIENT_SECRET_TO_BE_INSERTED_HERE>"

AWS_ACCESS_KEY_ID="dummy"
AWS_SECRET_ACCESS_KEY="dummy"

SNS_ENDPOINT="http://localhost:4566"
SNS_TOPIC_ARN="arn:aws:sns:eu-west-2:000000000000:forms_entitlement_events"
```

For proxy options, see `~/src/utils/setup-proxy.js`. The proxy should be configured out of the box for most libraries (axios/request/undici/wreck).

### Development

Install application dependencies:

```bash
npm install
```

To run the application in `development` mode run:

```bash
npm run dev
```

### Testing

#### Unit Tests

To run unit tests:

```bash
npm run test
```

#### Integration Tests

Integration tests verify the full API using Docker containers for infrastructure.

**Automated CI/CD:**

```bash
npm run test:integration
```

**Local Development with Postman:**

```bash
# 1. Start test infrastructure
npm run test:integration:setup

# 2. Seed test database
npm run test:integration:seed-local

# 3. Start your local server (new terminal)
npm run dev

4. Import into Postman:
  - Collection: test/integration/postman/forms-entitlement-api-ci-mock.postman_collection.json
  - Environment: test/integration/postman/forms-entitlement-api-local.postman_environment.json

5. Run tests manually in Postman

# 6. Clean up when done
npm run test:integration:stop
```

**Prerequisites:**

- Docker running
- Newman CLI: `npm install -g newman`
- **Temporarily update your `.env` file** with test configuration:

  ```bash
  # 1. Add test database configuration
  MONGO_URI='mongodb://localhost:27018/forms-entitlement-api-test?replicaSet=rs0&directConnection=true'
  MONGO_DATABASE=forms-entitlement-api-test

  # 2. OIDC Mock Server
  OIDC_JWKS_URI="http://localhost:5556/.well-known/openid-configuration/jwks"
  OIDC_VERIFY_AUD="newman-test-client"
  OIDC_VERIFY_ISS="http://oidc:80"

  # 3. Mock Azure AD
  AZURE_CLIENT_ID="mock-client-id"
  AZURE_CLIENT_SECRET="mock-client-secret"
  AZURE_TENANT_ID="mock-tenant-id"
  ```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## API endpoints

| Endpoint                  | Description             |
| ------------------------- | ----------------------- |
| `GET: /health `           | Health check endpoint   |
| `GET: /roles `            | Get a list of all roles |
| `GET: /users`.            | Get a list of all users |
| `GET: /users/<userid>`    | Get a specific user     |
| `POST: /users`            | Add a user              |
| `PUT: /users/<userid>`    | Update a specific user  |
| `DELETE: /users/<userid>` | Delete a specific user  |

## Development helpers

### MongoDB Locks

The application uses the `mongo-locks` library for distributed locking. You can acquire locks via `server.locker` or `request.locker`:

```javascript
async function doStuff(server) {
  const lock = await server.locker.lock('unique-resource-name')

  if (!lock) {
    // Lock unavailable
    return
  }

  try {
    // do stuff
  } finally {
    await lock.free()
  }
}
```

Keep it small and atomic.

You may use **using** for automatic lock resource management:

```javascript
async function doStuff(server) {
  await using lock = await server.locker.lock('unique-resource-name')

  if (!lock) {
    // Lock unavailable
    return
  }

  // do stuff

  // lock automatically released
}
```

Helper methods are also available in `/src/repositories/lock-repository.js` for backward compatibility.

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Docker

### Development image

Build:

```bash
docker build --target development --no-cache --tag forms-entitlement-api:development .
```

Run:

```bash
docker run -e PORT=3004 -p 3004:3004 forms-entitlement-api:development
```

### Production image

Build:

```bash
docker build --no-cache --tag forms-entitlement-api .
```

Run:

```bash
docker run -e PORT=3004 -p 3004:3004 forms-entitlement-api
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
