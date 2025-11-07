# n8n MCP Server

An MCP (Model Context Protocol) server that enables Claude to interact with your self-hosted n8n workflows. This server provides tools to list, inspect, execute, and monitor n8n workflows directly from Claude.

## Features

- **list_workflows** - Get all workflows with their IDs, names, and active status
- **get_workflow** - Fetch the complete JSON definition of a specific workflow
- **get_executions** - Get recent execution history for a workflow with status and error details
- **trigger_workflow** - Manually trigger a workflow execution with optional input data

## Prerequisites

- Node.js 18 or higher
- A self-hosted n8n instance with API access enabled
- n8n API key

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd n8n-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Getting your n8n API Key

1. Log in to your n8n instance
2. Go to Settings → API
3. Click "Create API Key" if you don't have one
4. Copy the API key

### Setting up Environment Variables

Create a `.env` file in your project root or set environment variables directly:

```bash
N8N_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key-here
```

**Important:**
- The `N8N_URL` should be your full n8n instance URL (e.g., `https://n8n.example.com`)
- Do not include a trailing slash in the URL
- Keep your API key secure and never commit it to version control

### Configuring Claude Desktop

Add this server to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the following configuration:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/absolute/path/to/n8n-mcp-server/build/index.js"],
      "env": {
        "N8N_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `/absolute/path/to/n8n-mcp-server` with the actual path to this project.

## Usage

Once configured, restart Claude Desktop. You can now ask Claude to interact with your n8n workflows:

### Example Prompts

- "List all my n8n workflows"
- "Show me the details of workflow ID abc123"
- "Get the recent execution history for my data sync workflow"
- "Trigger the workflow with ID xyz789"
- "What workflows do I have that are currently active?"

## Available Tools

### 1. list_workflows

Lists all workflows in your n8n instance.

**Returns:**
```json
{
  "success": true,
  "count": 5,
  "workflows": [
    {
      "id": "1",
      "name": "My Workflow",
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z",
      "tags": []
    }
  ]
}
```

### 2. get_workflow

Fetches the complete workflow definition including all nodes and connections.

**Parameters:**
- `workflow_id` (string, required): The ID of the workflow to fetch

**Returns:**
```json
{
  "success": true,
  "workflow": {
    "id": "1",
    "name": "My Workflow",
    "active": true,
    "nodes": [...],
    "connections": {...},
    "settings": {...}
  }
}
```

### 3. get_executions

Gets recent execution history for a workflow.

**Parameters:**
- `workflow_id` (string, required): The ID of the workflow
- `limit` (number, optional): Number of executions to return (default: 10, max: 100)

**Returns:**
```json
{
  "success": true,
  "workflowId": "1",
  "count": 3,
  "executions": [
    {
      "id": "exec1",
      "workflowId": "1",
      "finished": true,
      "mode": "manual",
      "startedAt": "2024-01-01T00:00:00.000Z",
      "stoppedAt": "2024-01-01T00:01:00.000Z",
      "status": "success",
      "error": null
    }
  ]
}
```

### 4. trigger_workflow

Manually triggers a workflow execution.

**Parameters:**
- `workflow_id` (string, required): The ID of the workflow to trigger
- `data` (object, optional): Input data to pass to the workflow

**Returns:**
```json
{
  "success": true,
  "message": "Workflow triggered successfully",
  "workflowId": "1",
  "executionId": "exec123",
  "workflowActive": true
}
```

## Development

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Development Mode

```bash
npm run dev
```

## Error Handling

The server includes comprehensive error handling:

- **Authentication errors (401/403)**: Invalid or missing API key
- **Not found errors (404)**: Workflow or resource doesn't exist
- **Network errors**: Connection issues with n8n instance
- **Invalid parameters**: Missing or invalid tool parameters

All errors are returned in a structured format with clear messages.

## Security Considerations

- Never commit your API key to version control
- Use environment variables or secure configuration management
- Ensure your n8n instance uses HTTPS in production
- Regularly rotate your API keys
- Limit API key permissions if possible

## Troubleshooting

### "N8N_URL environment variable is required"
Ensure you've set the `N8N_URL` in your Claude Desktop configuration.

### "Authentication failed"
Check that your API key is correct and has the necessary permissions.

### "Resource not found"
Verify the workflow ID exists and your API key has access to it.

### Connection timeout
Ensure your n8n instance is accessible and not behind a firewall that blocks the requests.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.