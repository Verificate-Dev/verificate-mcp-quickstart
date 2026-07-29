# Verificate MCP stdio bridge — zero-dependency Node server.
# Runs the MCP server on stdio; set VERIFICATE_TOKEN to enable tool calls.
FROM node:20-alpine
WORKDIR /app
COPY package.json index.js ./
# No npm install needed: the bridge has no runtime dependencies.
ENTRYPOINT ["node", "index.js"]
