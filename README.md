# Beets Monitor

[![Tests](https://github.com/tommyschnabel/beets_monitor/actions/workflows/Test.yml/badge.svg)](https://github.com/tommyschnabel/beets_monitor/actions/workflows/Test.yml)
[![Docker](https://github.com/tommyschnabel/beets_monitor/actions/workflows/BuildImage.yml/badge.svg)](https://github.com/tommyschnabel/beets_monitor/actions/workflows/BuildImage.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Flask-based web interface for monitoring and managing a
[beets](https://beets.io) music library. It compares your library against
MusicBrainz to show which albums you're missing for each artist.

## Features

- Catalog view: every release group for the artists in your library, with
  the albums and tracks you already have
- Ignore list and watch list for albums
- Artist graph linking artists by shared MusicBrainz genres
- Playlist export (M3U8) for Plex and Strawberry
- Soulseek search trigger through [slskd](https://github.com/slskd/slskd)
- Buttons for `beet import`, `beet update` and `beet bad`, run through an
  optional actions service (see [Actions service](#actions-service-optional))

## Requirements

- A beets install with the
  [`web` plugin](https://beets.readthedocs.io/en/stable/plugins/web.html)
  enabled and reachable from Beets Monitor. Set `BEETS_BASE_URL` to its
  `host:port`.
- Optional: slskd, Plex, and an actions service (see below).

## Quick start with Docker Compose

1. Copy the example configuration and fill it in:

   ```bash
   cp .env.example .env
   ```

2. Create `docker-compose.yml` (a copy is in this repo):

   ```yaml
   services:
     beets_monitor:
       image: ghcr.io/tommyschnabel/beets_monitor:latest
       container_name: beets_monitor
       restart: unless-stopped
       env_file: .env
       ports:
         - "5001:5001"
       volumes:
         # Catalog state (artists, albums, watch list, cached genres)
         - ./config:/app/config
         # Where /create_playlist writes M3U8 files; must match PLAYLIST_DIR
         - ./playlists:/playlists
   ```

3. Start it:

   ```bash
   mkdir -p config playlists
   docker compose up -d
   ```

4. Open `http://localhost:5001` and click **Update Catalog**. The first run
   can take a while because MusicBrainz limits requests to about one per
   second.

If beets runs in the same compose project, add a `beets` service and set
`BEETS_BASE_URL=beets:8337`.

## Docker

```bash
docker run -d \
  --name beets_monitor \
  --env-file .env \
  -p 5001:5001 \
  -v "$(pwd)/config:/app/config" \
  -v "$(pwd)/playlists:/playlists" \
  ghcr.io/tommyschnabel/beets_monitor:latest
```

To build the image yourself:

```bash
docker build -t beets_monitor .
```

The container runs as the `abc` user (UID 1000, GID 1000) to match
LinuxServer.io containers. The mounted `config` and `playlists` directories
must be writable by that UID.

## Running without Docker

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
set -a; source .env; set +a
python3 server.py
```

The app listens on `http://0.0.0.0:5001` and keeps its state in `./config`.

## Configuration

All configuration is through environment variables (see `.env.example`).

| Variable | Required | Description |
|---|---|---|
| `BEETS_BASE_URL` | yes | `host:port` of the beets web plugin API |
| `MUSICBRAINZ_USER_AGENT` | recommended | User agent sent to MusicBrainz. MusicBrainz asks for contact info, so include an email or URL |
| `ACTIONS_BASE_URL` | no | Base URL of the actions service used by `/import`, `/update` and `/bad` |
| `SLSKD_URL` | no | slskd base URL. Leave unset to disable `/slskd_search` |
| `SLSKD_API_KEY` | no | slskd API key |
| `PLEX_MUSIC_PREFIX` | no | Path prefix Plex uses for your music directory |
| `STRAWBERRY_MUSIC_PREFIX` | no | Path prefix Strawberry uses for your music directory |
| `PLAYLIST_DIR` | no | Directory playlists are written to |
| `PLEX_URL` / `PLEX_TOKEN` / `PLEX_LIBRARY` | no | Plex connection, used to resolve tracks during playlist export |
| `FLASK_DEBUG` | no | Set to `1` for the Flask debug server. **Never enable in production:** the Werkzeug debugger allows remote code execution |

Beets returns item paths relative to its music directory. The `*_PREFIX`
variables turn those into the absolute paths each playlist consumer expects.

## Actions service (optional)

Beets Monitor doesn't run beets commands itself. `POST /import`,
`/update` and `/bad` are forwarded to `ACTIONS_BASE_URL` as:

- `POST {ACTIONS_BASE_URL}/beets/import`
- `POST {ACTIONS_BASE_URL}/beets/update`
- `POST {ACTIONS_BASE_URL}/beets/bad`

That service should run the matching `beet` command (for example with
`docker exec` into your beets container) and return a JSON response, which
is passed back unchanged. Without it, these endpoints return `502`. The rest
of the app works normally.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/get_catalog` | Current catalog with track counts |
| POST | `/update_catalog` | Rebuild artists, release groups and albums from beets and MusicBrainz |
| POST | `/ignore_album` | Body `{"album_id": "<mbid>"}`. Hide an album from the catalog |
| GET | `/artist_graph` | Artists linked by shared genres. Optional `?min_shared=2` |
| POST | `/update_artist_genres` | Refresh artist genres from MusicBrainz. Body `{"force": true}` skips the 45-day cooldown |
| POST | `/create_playlist` | Body `{"artist_ids": [...], "name": "..."}`. Writes Plex and Strawberry M3U8 files |
| POST | `/slskd_search` | Body `{"query": "..."}`. Starts a slskd search |
| POST | `/import`, `/update`, `/bad` | Forwarded to the actions service |
| GET | `/watch_albums` | List watched albums |
| GET | `/watch_albums/<album_id>` | Get one watched album |
| POST | `/watch_albums` | Body `{"album_id": "<mbid>"}`. Watch an album |
| DELETE | `/watch_albums/<album_id>` | Stop watching an album |

## Utility scripts

`scripts/` contains standalone maintenance scripts. They aren't part of the
web app or the Docker image.

- `scripts/cleanup_flac.py DIR [--dry-run]` deletes `.flac` files that have
  an `.mp3` with the same name next to them.
- `scripts/dupes.py DIR [--dry-run]` finds numbered duplicate MP3s (for
  example `Song (1).mp3`), replaces the original with the highest-numbered
  copy, and deletes the other copies.

Run either script with `--help` for all options. Try `--dry-run` first,
because both scripts delete files.

## Development

```bash
pip install -r requirements.txt pytest
pytest
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
