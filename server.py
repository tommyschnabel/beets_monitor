import logging
import sys

# Configure logging BEFORE importing Flask to ensure our settings take precedence
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Filter to suppress logging for health endpoint
class HealthEndpointFilter(logging.Filter):
    def filter(self, record):
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            if '/health' in record.msg:
                return False
        return True

# Apply filter to werkzeug logger before Flask initializes it
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.addFilter(HealthEndpointFilter())

from flask import Flask, jsonify, send_from_directory, request
from datetime import datetime
import os
import requests

# Import the module functions directly from the catalog module
from catalog import (
    generate_artists,
    generate_release_groups,
    generate_albums,
    update_current_catalog,
    load_current_catalog,
    ignore_album,
    catalog_stats,
    load_watch_albums,
    add_watch_album,
    remove_watch_album,
    generate_artist_genres,
    build_artist_graph,
    build_playlists,
)

app = Flask(__name__, static_folder='static')

# Suppress werkzeug logging entirely by setting level to WARNING
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.WARNING)

# Actions dashboard base URL - used to proxy beets maintenance commands
ACTIONS_BASE_URL = os.environ.get('ACTIONS_BASE_URL', 'http://actions_dashboard:5001')

# slskd (Soulseek) integration - used to trigger searches from the catalog UI
SLSKD_URL = os.environ.get('SLSKD_URL', '')
SLSKD_API_KEY = os.environ.get('SLSKD_API_KEY', '')

# Add CORS support for API endpoints
@app.after_request
def add_cors_headers(response):
    """Add CORS headers to all responses"""
    if request.path.startswith('/api/') or request.path.startswith('/watch_albums') or request.path in ['/get_catalog', '/update_catalog', '/health', '/ignore_album', '/import', '/update', '/bad', '/artist_graph', '/update_artist_genres', '/create_playlist', '/slskd_search']:
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/')
def serve_index():
    """Serve the main HTML page"""
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files from the static directory"""
    return send_from_directory('static', filename)

@app.route('/update_catalog', methods=['POST'])
def update_catalog():
    """Update the catalog by running all generation functions"""
    try:
        # Run all catalog generation functions
        generate_artists()
        generate_release_groups()
        generate_albums()

        # Generate and save current catalog
        catalog = update_current_catalog()
        total_tracks, available_tracks = catalog_stats(catalog)

        return jsonify({
            'status': 'success',
            'message': 'Catalog updated successfully',
            'timestamp': datetime.now().isoformat(),
            'total_tracks': total_tracks,
            'available_tracks': available_tracks,
            'catalog': catalog,
        }), 200

    except Exception as e:
        app.logger.error(f'Exception in /update_catalog: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/get_catalog', methods=['GET'])
def get_catalog():
    """Get the current catalog from disk with track counts at top level"""
    try:
        catalog = load_current_catalog()
        total_tracks, available_tracks = catalog_stats(catalog)

        return jsonify({
            'status': 'success',
            'catalog': catalog,
            'total_tracks': total_tracks,
            'available_tracks': available_tracks,
            'timestamp': datetime.now().isoformat()
        }), 200

    except FileNotFoundError:
        return jsonify({
            'status': 'error',
            'message': 'Catalog file not found',
            'timestamp': datetime.now().isoformat()
        }), 404

    except Exception as e:
        app.logger.error(f'Exception in /get_catalog: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/ignore_album', methods=['POST'])
def ignore_album_endpoint():
    """Ignore an album by adding it to ignored_release_groups.json and removing it from albums.json"""
    try:
        data = request.get_json()
        album_id = data.get('album_id')

        if not album_id:
            return jsonify({
                'status': 'error',
                'message': 'album_id is required',
                'timestamp': datetime.now().isoformat()
            }), 400

        try:
            ignore_album(album_id)
        except Exception as e:
            app.logger.error(f'Exception in ignore_album for album_id {album_id}: {e}', exc_info=True)
            return jsonify({
                'status': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

        return jsonify({
            'status': 'success',
            'message': 'Album ignored successfully',
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        app.logger.error(f'Exception in /ignore_album: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/artist_graph', methods=['GET'])
def artist_graph():
    """Return the genre-linked artist web (nodes + weighted shared-genre edges).

    Reads from cached genre data on disk; no live MusicBrainz calls. Use the
    optional `min_shared` query param (default 2) to tune edge density.
    """
    try:
        try:
            min_shared = int(request.args.get('min_shared', 2))
        except (TypeError, ValueError):
            min_shared = 2

        graph = build_artist_graph(min_shared=min_shared)

        return jsonify({
            'status': 'success',
            'nodes': graph['nodes'],
            'edges': graph['edges'],
            'node_count': len(graph['nodes']),
            'edge_count': len(graph['edges']),
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        app.logger.error(f'Exception in /artist_graph: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/create_playlist', methods=['POST'])
def create_playlist():
    """Build M3U8 playlists (Plex + Strawberry path variants) from a set of artists.

    Expects JSON {"artist_ids": [mbid, ...], "name": "<playlist name>"}. Writes
    /playlists/plex/<name>.m3u8 and /playlists/strawberry/<name>.m3u8 containing
    every song in the beets library by those artists.
    """
    try:
        data = request.get_json(silent=True) or {}
        artist_ids = data.get('artist_ids') or []
        name = (data.get('name') or '').strip()

        if not artist_ids:
            return jsonify({
                'status': 'error',
                'message': 'No artists provided',
                'timestamp': datetime.now().isoformat()
            }), 400
        if not name:
            return jsonify({
                'status': 'error',
                'message': 'Playlist name is required',
                'timestamp': datetime.now().isoformat()
            }), 400

        result = build_playlists(artist_ids, name)

        return jsonify({
            'status': 'success',
            **result,
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        app.logger.error(f'Exception in /create_playlist: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/update_artist_genres', methods=['POST'])
def update_artist_genres():
    """Fetch/refresh per-artist genres from MusicBrainz and return the rebuilt graph.

    Respects the 45-day per-artist refresh cooldown unless `force` is passed in the
    JSON body. This can be slow on first run (~1 req/sec per un-cached artist).
    """
    try:
        data = request.get_json(silent=True) or {}
        force = bool(data.get('force', False))

        generate_artist_genres(force=force)
        graph = build_artist_graph()

        return jsonify({
            'status': 'success',
            'message': 'Artist genres updated successfully',
            'nodes': graph['nodes'],
            'edges': graph['edges'],
            'node_count': len(graph['nodes']),
            'edge_count': len(graph['edges']),
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        app.logger.error(f'Exception in /update_artist_genres: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

# Beets maintenance commands, proxied to the actions dashboard which runs
# `beet import/update/bad` inside the beets container and reports to Discord.
BEETS_ACTION_PATHS = {
    'import': '/beets/import',
    'update': '/beets/update',
    'bad': '/beets/bad',
}

@app.route('/<any(import, update, bad):action>', methods=['POST'])
def beets_action(action):
    """Forward a beets maintenance command to the actions dashboard"""
    try:
        resp = requests.post(f'{ACTIONS_BASE_URL}{BEETS_ACTION_PATHS[action]}', timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        app.logger.error(f'Exception proxying /{action} to actions dashboard: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 502

@app.route('/slskd_search', methods=['POST'])
def slskd_search():
    """Kick off a Soulseek search in slskd for the given query."""
    try:
        if not SLSKD_URL:
            return jsonify({
                'status': 'error',
                'message': 'SLSKD_URL is not configured',
                'timestamp': datetime.now().isoformat()
            }), 501

        data = request.get_json() or {}
        query = (data.get('query') or '').strip()

        if not query:
            return jsonify({
                'status': 'error',
                'message': 'query is required',
                'timestamp': datetime.now().isoformat()
            }), 400

        headers = {'Content-Type': 'application/json'}
        if SLSKD_API_KEY:
            headers['X-API-Key'] = SLSKD_API_KEY

        resp = requests.post(
            f'{SLSKD_URL}/api/v0/searches',
            json={'searchText': query},
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()

        return jsonify({
            'status': 'success',
            'query': query,
            'search': resp.json(),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        app.logger.error(f'Exception in /slskd_search: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    }), 200

# Watch Albums CRUD Endpoints

@app.route('/watch_albums', methods=['GET'])
def get_watch_albums():
    """Get all watch albums (list of album IDs)"""
    try:
        watch_albums = load_watch_albums()
        return jsonify({
            'status': 'success',
            'watch_albums': watch_albums,
            'count': len(watch_albums),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        app.logger.error(f'Exception in /watch_albums GET: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/watch_albums/<album_id>', methods=['GET'])
def get_watch_album(album_id):
    """Check if a specific album is in the watch list"""
    try:
        watch_albums = load_watch_albums()
        
        if album_id not in watch_albums:
            return jsonify({
                'status': 'error',
                'message': f'Album {album_id} not found in watch list',
                'timestamp': datetime.now().isoformat()
            }), 404
        
        return jsonify({
            'status': 'success',
            'watched': True,
            'album_id': album_id,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        app.logger.error(f'Exception in /watch_albums/{album_id} GET: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/watch_albums', methods=['POST'])
def create_watch_album():
    """Add a new album to the watch list"""
    try:
        data = request.get_json()
        album_id = data.get('album_id')
        
        if not album_id:
            return jsonify({
                'status': 'error',
                'message': 'album_id is required',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        try:
            add_watch_album(album_id)
        except ValueError as e:
            return jsonify({
                'status': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }), 400
        except Exception as e:
            app.logger.error(f'Exception in add_watch_album for album_id {album_id}: {e}', exc_info=True)
            return jsonify({
                'status': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': 'Album added to watch list successfully',
            'album_id': album_id,
            'timestamp': datetime.now().isoformat()
        }), 201
        
    except Exception as e:
        app.logger.error(f'Exception in /watch_albums POST: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/watch_albums/<album_id>', methods=['DELETE'])
def delete_watch_album(album_id):
    """Remove an album from the watch list"""
    try:
        try:
            remove_watch_album(album_id)
        except ValueError as e:
            return jsonify({
                'status': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }), 404
        except Exception as e:
            app.logger.error(f'Exception in remove_watch_album for album_id {album_id}: {e}', exc_info=True)
            return jsonify({
                'status': 'error',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': 'Album removed from watch list successfully',
            'album_id': album_id,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        app.logger.error(f'Exception in /watch_albums/{album_id} DELETE: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=os.environ.get('FLASK_DEBUG') == '1')
