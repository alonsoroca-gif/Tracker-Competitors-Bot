# Domo MCP Server

A Model Context Protocol (MCP) server for querying **multiple** Domo datasets via OAuth API with **local CSV caching** for fast, offline queries.

## Features

- **Multi-Dataset Support**: Query multiple datasets (JIRA, Zendesk, and more) individually or cross-dataset
- **Local CSV Caching**: Downloads datasets once daily, queries run locally from cached CSV files
- **OAuth Authentication**: Automatic token management with client credentials flow
- **SQL Queries**: Execute SQL queries on locally cached data (no API calls per query)
- **Selective Refresh**: Refresh one dataset or all datasets at once
- **Cross-Dataset Queries**: Query across multiple datasets to find common trends
- **Dataset Metadata**: Retrieve dataset information and schema from API

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Add to your MCP configuration (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "domo": {
      "command": "node",
      "args": [
        "/Users/sdangerfield/dev/mcp-domo/dist/index.js"
      ]
    }
  }
}
```

## Configuration

Currently uses hardcoded dev credentials:
- `DOMO_CLIENT_ID`: 9ee50b68-5c1a-4760-87d4-849915e4b68b
- `DOMO_CLIENT_SECRET`: ce5d325f7533023e8959de0713f159d5f40211f84c5a61fde60a7754806b79d0

**Configured Datasets:**
- **JIRA** (`jira`): `120454dd-a8ff-4ab9-bf55-fae5c2e87852` → `~/.domo-mcp/jira-data.csv`
- **Zendesk** (`zendesk`): `74eb3c98-8ed4-4591-af94-ef21e87b5a3c` → `~/.domo-mcp/zendesk-data.csv`

**Note**: For production, these should be moved to environment variables. To add more datasets, edit `src/dataset-config.ts`.

## Usage Workflow

1. **Initial Setup**: Run `domo_refresh_data` to download all datasets (or specify one: `domo_refresh_data jira`)
2. **Daily Refresh**: Run `domo_refresh_data` once per day to keep your cache up to date
   - Refresh all: `domo_refresh_data` (no arguments)
   - Refresh one: `domo_refresh_data jira` or `domo_refresh_data zendesk`
3. **Query Locally**: Use `domo_query` to run SQL queries against cached data (no API calls needed)
   - Query specific dataset: `domo_query` with `dataset: "jira"` parameter
   - Cross-dataset query: `domo_query` without dataset parameter (queries all datasets)

## Available Tools

### `domo_query`
Execute a SQL query on one or more **locally cached** datasets. Queries run against cached CSV files, not the API.

**Parameters:**
- `sql` (string, required): SQL query to execute
- `dataset` (string, optional): Dataset ID to query (`jira`, `zendesk`, or omit for cross-dataset)
- `datasets` (array, optional): Array of dataset IDs for cross-dataset queries (e.g., `["jira", "zendesk"]`)

**Supported SQL:**
- `SELECT * FROM table` - Select all columns
- `SELECT col1, col2 FROM table` - Select specific columns
- `WHERE column = 'value'` - Filter rows
- `WHERE column LIKE '%value%'` - Pattern matching
- `WHERE column != 'value'` - Not equal
- `WHERE column > 100` - Numeric comparisons
- `ORDER BY column ASC/DESC` - Sort results
- `LIMIT n` - Limit number of results

**Examples:**
```json
{
  "sql": "SELECT * FROM table LIMIT 10",
  "dataset": "jira"
}
```

```json
{
  "sql": "SELECT issue_key, Status FROM table WHERE \"Issue Type\" = 'Epic' LIMIT 20"
}
```

Cross-dataset queries (adds `dataset` column to results):
```json
{
  "sql": "SELECT * FROM table LIMIT 10"
}
```

### `domo_refresh_data`
Download the latest dataset(s) from Domo API and save locally. **Run this once per day** to keep your cache fresh.

**Parameters:**
- `dataset` (string, optional): Dataset ID to refresh (`jira`, `zendesk`, or omit to refresh all)
- `includeHeader` (boolean, optional): Include column headers in the CSV (default: true)

**Examples:**
```json
{
  "dataset": "jira",
  "includeHeader": true
}
```

```json
{}
```
(Refreshes all datasets)

### `domo_get_cache_info`
Get information about locally cached datasets (file paths, last modified times, row counts, etc.).

**Parameters:**
- `dataset` (string, optional): Dataset ID to get info for (`jira`, `zendesk`, or omit for all)

**Examples:**
```json
{
  "dataset": "jira"
}
```

```json
{}
```
(Returns info for all datasets)

### `domo_list_datasets`
List all available datasets and their configuration.

**Example:**
```json
{}
```

### `domo_get_info`
Get metadata about the dataset from Domo API (name, description, schema, etc.). This still hits the API.

**Example:**
```json
{}
```

## Available Resources

- `domo://dataset/info`: Dataset metadata as JSON (from API)
- `domo://dataset/data`: Full dataset as CSV (from local cache if available, otherwise from API)

## Local Cache Locations

Cached datasets are stored in: `~/.domo-mcp/`

- **JIRA**: `~/.domo-mcp/jira-data.csv`
- **Zendesk**: `~/.domo-mcp/zendesk-data.csv`

These files are automatically created when you run `domo_refresh_data` and are used by all `domo_query` operations.

## Adding New Datasets

To add a new dataset, edit `src/dataset-config.ts` and add a new entry to the `DATASETS` array:

```typescript
{
  id: 'new-dataset-id',
  name: 'Human Readable Name',
  datasetId: 'domo-dataset-id-here',
  filePath: 'new-dataset-data.csv',
}
```

Then rebuild: `npm run build`

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

## Domo API Reference

- [Domo Platform API Documentation](https://developer.domo.com/)
- OAuth Token Endpoint: `https://api.domo.com/oauth/token`
- Dataset Query Endpoint: `https://api.domo.com/v1/datasets/query/execute/{DATASET_ID}`
- Dataset Data Endpoint: `https://api.domo.com/v1/datasets/{DATASET_ID}/data`
