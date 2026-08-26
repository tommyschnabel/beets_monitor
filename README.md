# Beets Monitor

A Flask-based web interface for monitoring and managing beets music library imports.

## Features

- View and manage music catalog
- Import music files via beets (asynchronous)
- Update music library via beets (asynchronous)
- Find bad music files via beets (asynchronous)
- Soulseek (slskd) search trigger from the catalog UI
- Playlist export to Plex and Strawberry

Import/update/bad-files checks are proxied to a separate `actions_dashboard`
service (`ACTIONS_BASE_URL`), which is also where Discord webhook
notifications for those actions are sent from.

## Configuration

Copy `.env.example` to `.env` and fill in the values for your setup:

```bash
cp .env.example .env
```

- `BEETS_BASE_URL` (required) - host:port of the beets web plugin API
- `ACTIONS_BASE_URL` - base URL of the actions dashboard that runs
  `beet import/update/bad`
- `SLSKD_URL` / `SLSKD_API_KEY` - slskd base URL and API key; leave
  `SLSKD_URL` unset to disable the `/slskd_search` endpoint
- `PLEX_MUSIC_PREFIX` / `STRAWBERRY_MUSIC_PREFIX` / `PLAYLIST_DIR` - path
  prefixes used to translate beets' relative item paths into the absolute
  paths each playlist consumer expects
- `PLEX_URL` / `PLEX_TOKEN` / `PLEX_LIBRARY` - Plex integration, used to
  resolve tracks to ratingKeys for playlist export

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
