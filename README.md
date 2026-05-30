# Beets Monitor

A Flask-based web interface for monitoring and managing beets music library imports.

## Features

- View and manage music catalog
- Import music files via beets (asynchronous)
- Update music library via beets (asynchronous)
- Find bad music files via beets (asynchronous)
- Discord webhook notifications for import, update, and bad files check status

## Discord Webhook Configuration

To receive Discord notifications when music imports complete:

1. **Create a Discord Webhook:**
   - Go to your Discord server settings
   - Navigate to **Integrations** > **Webhooks**
   - Click **New Webhook**
   - Name it (e.g., "Beets Import")
   - Select the channel where you want notifications
   - Click **Copy Webhook URL**

2. **Configure the Environment Variable:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and paste your Discord webhook URL:
     ```
     DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
     ```
   - If not set, a default webhook URL will be used

3. **Restart the Application:**
   - The application will now send Discord notifications when:
     - Music import completes successfully (✅ green)
     - Music import fails (❌ red)
     - An exception occurs during import (❌ red)

## API Endpoints

### POST `/import`
Triggers a beets import of music files from `/downloads`. The import runs asynchronously in the background, and a Discord webhook notification is sent upon completion.

**Response:**
```json
{
  "status": "success",
  "message": "Music import started in background",
  "timestamp": "2025-01-03T23:00:00.000000"
}
```

### POST `/update`
Triggers a beets library update. The update runs asynchronously in the background, and a Discord webhook notification is sent upon completion.

**Response:**
```json
{
  "status": "success",
  "message": "Music library update started in background",
  "timestamp": "2025-01-03T23:00:00.000000"
}
```

### POST `/bad`
Triggers a beets bad files check. The check runs asynchronously in the background, and a Discord webhook notification is sent upon completion with the results attached as a file.

**Response:**
```json
{
  "status": "success",
  "message": "Bad files check started in background",
  "timestamp": "2025-01-03T23:00:00.000000"
}
```

### GET `/health`
Health check endpoint.

### GET `/get_catalog`
Retrieve the current music catalog.

### POST `/update_catalog`
Update the catalog by regenerating artist, release group, and album data.

### POST `/ignore_album`
Ignore an album by adding it to the ignored list.

## Running the Application

```bash
python3 server.py
```

The application runs on `http://0.0.0.0:5001`

## User Permissions

The container runs as the `abc` user (UID 1000, GID 1000) to match LinuxServer.io containers and ensure proper file permissions when interacting with the beets container and shared volumes.
