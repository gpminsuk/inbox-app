# Agent Server for Inbox App

This Python Flask server integrates browser-use for agentic actions in the Inbox App. It allows your application to execute actions on the web using natural language prompts.

## Features

- REST API for executing browser automation tasks
- Integration with browser-use for web automation
- Logging of all agent activities
- Docker support for containerized deployment

## Setup and Installation

### Local Development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Install Playwright browsers:
   ```bash
   playwright install chromium
   ```

3. Run the server:
   ```bash
   python app.py
   ```

The server will be available at http://localhost:8080.

### Testing

You can test the agent server using the included test script:

```bash
python test_agent.py "Search for the latest news about AI and summarize the top 3 articles"
```

Or with a specific starting URL:

```bash
python test_agent.py "Find the pricing information for this product" "https://example.com/product"
```

### Docker Deployment

The agent server is designed to run as a Docker container alongside your Inbox App:

```bash
docker-compose up agent-server
```

## API Endpoints

### POST /run-agent

Execute an agent task with browser-use.

**Request Body:**
```json
{
  "prompt": "The task to perform",
  "url": "Optional starting URL",
  "timeout": 60
}
```

**Response:**
```json
{
  "success": true,
  "result": "Result from browser-use",
  "prompt": "Original prompt"
}
```

### GET /health

Simple health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

### POST /close-browser

Close the browser instance to free resources.

**Response:**
```json
{
  "success": true,
  "message": "Browser closed successfully"
}
```

## Integration with Inbox App

The agent server is called by the Inbox App when a user clicks the "Execute" button on an action. The app sends the action description and email context to the agent server, which then uses browser-use to perform the requested task.

The results are logged in the Inbox App's database and displayed to the user.
