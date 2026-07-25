import json
import os
import re
import requests
import sys
import threading
import time
import logging

from datetime import datetime, timedelta
from xml.etree import ElementTree

# Configure logger
logger = logging.getLogger(__name__)

# Get the base URL from environment variable or use default
base = os.getenv('BEETS_BASE_URL', 'ai2:8337')
user_agent = 'beets_monitor/0.0.1 ( REDACTED )'

backoff_base = 2
max_backoff_secs = 10
max_attempts = 6

def save_json(path, data, indent=None):
    """Write JSON to disk atomically so a crash mid-write can't corrupt the file."""
    tmp_path = f'{path}.tmp'
    with open(tmp_path, 'w') as f:
        f.write(json.dumps(data, indent=indent))
    os.replace(tmp_path, path)

def normalize_title(title):
    """Normalize a track title by removing common punctuation and extra whitespace.

    This helps with matching tracks that may have different punctuation in Beets
    vs MusicBrainz (e.g., "Don't Stop" vs "Don’t Stop").
    """
    # Remove different punctuation marks
    normalized = re.sub(r"['’\"“…”.,\[\]]", '', title)
    # Replace ×
    normalized = re.sub(r"[\×]", "x", normalized)
    # Replace multiple spaces with single space and strip
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized

def load_artists():
    try:
        with open('./config/artists.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except Exception as e:
        logger.error(f'Failed to load artists.json: {e}', exc_info=True)
        return {}

def load_albums():
    try:
        with open('./config/albums.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except Exception as e:
        logger.error(f'Failed to load albums.json: {e}', exc_info=True)
        return {}

def load_artist_metadata_last_refresh():
    try:
        with open('./config/artist_last_refresh.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except Exception as e:
        logger.error(f'Failed to load artist_last_refresh.json: {e}', exc_info=True)
        return {}

def load_release_groups():
    try:
        with open('./config/release_groups.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except Exception as e:
        logger.error(f'Failed to load release_groups.json: {e}', exc_info=True)
        return {}

def load_ignored_release_groups():
    try:
        with open('./config/ignored_release_groups.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except Exception as e:
        logger.error(f'Failed to load ignored_release_groups.json: {e}', exc_info=True)
        return {}

def load_current_catalog():
    try:
        with open('./config/current_catalog.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except Exception as e:
        logger.error(f'Failed to load current_catalog.json: {e}', exc_info=True)
        return {}

def load_artist_genres():
    """Load cached per-artist genre data from artist_genres.json.

    Returns:
        Dict keyed by artist MBID: {artist_id: {'name', 'genres': [{'name','count'}], 'fetched': ts}}
    """
    try:
        with open('./config/artist_genres.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except FileNotFoundError:
        logger.info('artist_genres.json not found, returning empty dict')
        return {}
    except Exception as e:
        logger.error(f'Failed to load artist_genres.json: {e}', exc_info=True)
        return {}

def save_artist_genres(artist_genres):
    """Save per-artist genre data to artist_genres.json."""
    try:
        save_json('./config/artist_genres.json', artist_genres)
        logger.info(f'Saved genres for {len(artist_genres)} artists to disk')
    except Exception as e:
        logger.error(f'Failed to save artist_genres.json: {e}', exc_info=True)
        raise

def load_beets_items():
    """Load beets items from the beets_items.json file

    Returns:
        List of beets items
    """
    try:
        with open('./config/beets_items.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except FileNotFoundError:
        logger.info('beets_items.json not found, returning empty list')
        return []
    except Exception as e:
        logger.error(f'Failed to load beets_items.json: {e}', exc_info=True)
        return []

def save_beets_items(beets_items):
    """Save beets items to the beets_items.json file

    Args:
        beets_items: List of beets items
    """
    try:
        save_json('./config/beets_items.json', beets_items, indent=2)
        logger.info(f'Saved {len(beets_items)} beets items to disk')
    except Exception as e:
        logger.error(f'Failed to save beets_items.json: {e}', exc_info=True)
        raise

def load_watch_albums():
    """Load watch albums from the watch_albums.json file
    
    Returns:
        List of album IDs (MusicBrainz release group IDs)
    """
    try:
        with open('./config/watch_albums.json', 'r') as f:
            lines = ''.join(f.readlines())
            return json.loads(lines)
    except FileNotFoundError:
        logger.info('watch_albums.json not found, returning empty list')
        return []
    except Exception as e:
        logger.error(f'Failed to load watch_albums.json: {e}', exc_info=True)
        return []

def save_watch_albums(watch_albums):
    """Save watch albums to the watch_albums.json file
    
    Args:
        watch_albums: List of album IDs (MusicBrainz release group IDs)
    """
    try:
        save_json('./config/watch_albums.json', watch_albums, indent=2)
        logger.info(f'Saved {len(watch_albums)} watch albums to disk')
    except Exception as e:
        logger.error(f'Failed to save watch_albums.json: {e}', exc_info=True)
        raise

def add_watch_album(album_id):
    """Add an album to the watch list
    
    Args:
        album_id: The MusicBrainz release group ID of the album
    """
    watch_albums = load_watch_albums()
    
    if album_id in watch_albums:
        logger.warning(f'Album {album_id} is already in watch list')
        raise ValueError(f'Album {album_id} is already in watch list')
    
    watch_albums.append(album_id)
    save_watch_albums(watch_albums)
    logger.info(f'Added album {album_id} to watch list')

def remove_watch_album(album_id):
    """Remove an album from the watch list
    
    Args:
        album_id: The MusicBrainz release group ID of the album to remove
    """
    watch_albums = load_watch_albums()
    
    if album_id not in watch_albums:
        logger.warning(f'Album {album_id} is not in watch list')
        raise ValueError(f'Album {album_id} is not in watch list')
    
    watch_albums.remove(album_id)
    save_watch_albums(watch_albums)
    logger.info(f'Removed album {album_id} from watch list')

def generate_artists():
    start_time = time.time()
    try:
        beets_start = time.time()
        resp = requests.get(f'http://{base}/album/')
        beets_duration = time.time() - beets_start
        logger.info(f'Beets API call (albums) completed in {beets_duration:.2f}s')
        albums = resp.json()['albums']

        artists = {}
        for album in albums:
            if 'artists_sort' in album and len(album['artists_sort']) > 0:
                artist = album['artists_sort'][0]
            elif 'artist_credit' in album:
                artist = album['artist_credit']
            else:
                artist = album['albumartist']

            if 'mb_albumartistids' in album and len(album['mb_albumartistids']) > 0:
                artist_id = album['mb_albumartistids'][0]
            elif 'mb_artistid' in album:
                artist_id = album['mb_artistid']
            else:
                artist_id = album['mb_albumartistid']

            artists[artist_id] = artist

        save_json('./config/artists.json', artists)
        duration = time.time() - start_time
        logger.info(f'Generated artists: {len(artists)} artists found in {duration:.2f}s')
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f'Failed to generate artists after {duration:.2f}s: {e}', exc_info=True)
        raise

def generate_release_groups(skip_to=''):
    start_time = time.time()
    artists = load_artists()
    release_groups = load_release_groups()
    artist_last_refresh = load_artist_metadata_last_refresh()

    metadata_refresh_cooldown = (datetime.now() + timedelta(days=-45)).timestamp()
    logger.info(f'Starting release group generation for {len(artists)} artists')

    skipping = True
    for artist, artist_name in artists.items():
        if skip_to == '' or artist_name == skip_to: # Skipping to artist
            skipping = False
        if artist in artist_last_refresh: # Respect refresh cooldown
            last_refresh = artist_last_refresh[artist]
            if last_refresh > metadata_refresh_cooldown:
                continue

        if skipping or artist == '':
            continue

        logger.info(f'Requesting for {artist_name}')
        release_groups_resp = get_with_backoff(f'https://musicbrainz.org/ws/2/release-group?artist={artist}&fmt=json')

        if release_groups_resp.status_code > 299:
            logger.error(f'Request failed for {artist_name}: {release_groups_resp.text}')
            continue

        for release_group in release_groups_resp.json()['release-groups']:
            title = release_group['title']
            id = release_group['id']
            if release_group.get('primary-type') == 'Album' and id not in release_groups:
                secondary_types = release_group.get('secondary-types') or []
                if 'Compilation' not in secondary_types and 'Live' not in secondary_types:
                    release_groups[id] = {
                        'title': title,
                        'artist_id': artist,
                    }
                logger.info(f'Got release group for: {artist_name}: {title}\t({id})')

        # Update the last refresh timestamp for this artist
        artist_last_refresh[artist] = datetime.now().timestamp()

        save_json('./config/release_groups.json', release_groups)
        save_json('./config/artist_last_refresh.json', artist_last_refresh)
    
    duration = time.time() - start_time
    logger.info(f'Generated release groups: {len(release_groups)} release groups found in {duration:.2f}s')

def generate_albums():
    start_time = time.time()
    release_groups = load_release_groups()
    albums = load_albums()
    ignored_release_groups = load_ignored_release_groups()
    logger.info(f'Starting album generation for {len(release_groups)} release groups')

    for rg_id, rg_data in release_groups.items():
        if rg_id in albums:
            continue

        if rg_id in ignored_release_groups:
            continue

        title = rg_data['title']
        logger.info(f'Fetching album for release group: {title}')
        resp = get_with_backoff(f'https://musicbrainz.org/ws/2/release-group/{rg_id}?inc=releases&fmt=json')

        if resp.status_code > 299:
            logger.error(f'Request failed for {rg_id}: {resp.text}')
            continue

        data = resp.json()
        releases = data.get('releases', [])

        # Find earliest release
        earliest = None
        for release in releases:
            if not earliest:
                if release.get('date'):
                    earliest = release
            elif release.get('date') and release.get('date') < earliest.get('date'):
                earliest = release

        if not earliest:
            logger.warning(f'No valid release found for {title} ({rg_id}), adding to ignore list')
            ignored_release_groups[rg_id] = {
                'title': title,
                'artist_id': rg_data['artist_id'],
                'reason': 'no_earliest_release_found'
            }
            save_json('./config/ignored_release_groups.json', ignored_release_groups)
            continue

        album_id = earliest['id']
        album_title = earliest['title']
        disks = []

        # Fetch tracks from the release
        track_resp = get_with_backoff(f'https://musicbrainz.org/ws/2/release/{album_id}?inc=recordings&fmt=json')

        if track_resp.status_code > 299:
            logger.error(f'Track request failed for {album_id}: {track_resp.text}')
            ignored_release_groups[rg_id] = {
                'title': title,
                'artist_id': rg_data['artist_id'],
                'reason': 'track_request_failed'
            }
            save_json('./config/ignored_release_groups.json', ignored_release_groups)
            continue

        track_data = track_resp.json()
        for medium in track_data.get('media', []):
            tracks = {}
            disk = {
                'tracks': tracks,
            }
            disks.append(disk)
            for track in medium.get('tracks', []):
                tracks[track['id']] = {
                    'position': track['position'],
                    'title':    track['title'],
                }

        albums[rg_id] = {
            'disks': disks,
            'title': album_title,
            'date': earliest['date'],
        }

        logger.info(f'Got metadata for: {title} ({album_id})')
        save_json('./config/albums.json', albums)
    
    duration = time.time() - start_time
    logger.info(f'Generated albums: {len(albums)} albums found in {duration:.2f}s')

def generate_artist_genres(force=False):
    """Fetch and cache the genre list for each catalog artist from MusicBrainz.

    Uses the curated `genres` field (a vetted subset of free-form tags), keyed by
    artist MBID. Respects a 45-day refresh cooldown per artist (unless force=True)
    and the 1 req/sec rate limit via get_with_backoff, mirroring generate_release_groups.
    """
    start_time = time.time()
    artists = load_artists()
    artist_genres = load_artist_genres()

    refresh_cooldown = (datetime.now() + timedelta(days=-45)).timestamp()
    logger.info(f'Starting genre generation for {len(artists)} artists')

    fetched_count = 0
    for artist_id, artist_name in artists.items():
        if not artist_id:
            continue

        # Respect refresh cooldown unless forced
        if not force and artist_id in artist_genres:
            last_fetched = artist_genres[artist_id].get('fetched', 0)
            if last_fetched > refresh_cooldown:
                continue

        logger.info(f'Requesting genres for {artist_name}')
        resp = get_with_backoff(f'https://musicbrainz.org/ws/2/artist/{artist_id}?inc=genres&fmt=json')

        if resp.status_code > 299:
            logger.error(f'Genre request failed for {artist_name} ({artist_id}): {resp.text}')
            continue

        data = resp.json()
        genres = [
            {'name': g['name'], 'count': g.get('count', 0)}
            for g in sorted(data.get('genres', []), key=lambda g: -g.get('count', 0))
        ]

        artist_genres[artist_id] = {
            'name': artist_name,
            'genres': genres,
            'fetched': datetime.now().timestamp(),
        }
        fetched_count += 1
        logger.info(f'Got {len(genres)} genres for {artist_name}')

        save_artist_genres(artist_genres)

    duration = time.time() - start_time
    logger.info(f'Generated artist genres: refreshed {fetched_count} artists in {duration:.2f}s')
    return artist_genres

def build_artist_graph(min_shared=2):
    """Build a genre-linked artist graph from cached genre data.

    Nodes are catalog artists that have at least one genre. Edges connect two
    artists that share genres, weighted by the number of shared genres. Only edges
    with weight >= min_shared are returned to avoid a hairball from ubiquitous
    genres like "rock"; any node left with no such edge keeps its single strongest
    (weight >= 1) link so it is not stranded. Node status is pulled from the current
    catalog when available for coloring.
    """
    start_time = time.time()
    artist_genres = load_artist_genres()
    current_catalog = load_current_catalog()

    # Build nodes and a genre-name-set per artist for fast intersection.
    nodes = []
    genre_sets = {}
    for artist_id, info in artist_genres.items():
        genre_names = [g['name'] for g in info.get('genres', [])]
        if not genre_names:
            continue
        genre_sets[artist_id] = set(genre_names)
        status = current_catalog.get(artist_id, {}).get('status', 'unknown')
        nodes.append({
            'id': artist_id,
            'name': info.get('name', artist_id),
            'genres': genre_names,
            'status': status,
        })

    # Compute weighted edges from shared genres over all artist pairs.
    artist_ids = list(genre_sets.keys())
    edges = []
    best_edge = {}  # artist_id -> (weight, edge) strongest weight>=1 link, for stranded nodes
    connected = set()

    for i in range(len(artist_ids)):
        a = artist_ids[i]
        for j in range(i + 1, len(artist_ids)):
            b = artist_ids[j]
            shared = genre_sets[a] & genre_sets[b]
            weight = len(shared)
            if weight == 0:
                continue

            edge = {'source': a, 'target': b, 'weight': weight, 'shared': sorted(shared)}

            # Track each node's strongest link as a fallback against stranding.
            for node_id in (a, b):
                if node_id not in best_edge or weight > best_edge[node_id][0]:
                    best_edge[node_id] = (weight, edge)

            if weight >= min_shared:
                edges.append(edge)
                connected.add(a)
                connected.add(b)

    # Rescue stranded nodes by adding their single strongest link.
    for node in nodes:
        node_id = node['id']
        if node_id in connected or node_id not in best_edge:
            continue
        edge = best_edge[node_id][1]
        if edge not in edges:
            edges.append(edge)
        connected.add(edge['source'])
        connected.add(edge['target'])

    duration = time.time() - start_time
    logger.info(f'Built artist graph: {len(nodes)} nodes, {len(edges)} edges in {duration:.2f}s')
    return {'nodes': nodes, 'edges': edges}

def fetch_beets_items():
    """Fetch the raw list of items from the Beets web API.

    Unlike get_current_catalog(), this does no full-catalog building - it just
    returns the items. Requires the beets web plugin to be configured with
    include_paths: yes so each item carries its `path`.
    """
    resp = requests.get(f'http://{base}/item/')
    return resp.json()['items']

# Beets returns item paths RELATIVE to its music directory (e.g.
# "Artist/Album (Year)/track.mp3"). The same files live on disk at
# /music/library; Plex (and beets) see them at /music, while
# Strawberry runs natively on the host and sees the raw host path. We prepend
# the consumer-appropriate prefix to the relative path.
PLEX_MUSIC_PREFIX = '/music'
STRAWBERRY_MUSIC_PREFIX = '/music/library'
PLAYLIST_DIR = '/playlists'

# Plex playlist import. Plex's /playlists/upload endpoint is a silent no-op on
# our build (returns 200, creates nothing), so we instead resolve each track's
# path to its Plex ratingKey and create the playlist via POST /playlists. The
# track paths use PLEX_MUSIC_PREFIX (/music), which is where Plex's music library
# is mounted, so they match the file= attribute Plex stores for each track.
PLEX_URL = os.getenv('PLEX_URL', 'http://plex:32400')
PLEX_TOKEN = os.getenv('PLEX_TOKEN', '')
PLEX_LIBRARY = os.getenv('PLEX_LIBRARY', 'Music')

def to_playlist_path(item_path, prefix):
    """Join a beets item path onto a consumer prefix.

    Beets normally returns a relative path, but tolerate an absolute /music/...
    path too by stripping that prefix first.
    """
    rel = item_path
    if rel.startswith(PLEX_MUSIC_PREFIX + '/'):
        rel = rel[len(PLEX_MUSIC_PREFIX) + 1:]
    rel = rel.lstrip('/')
    return f'{prefix}/{rel}'

def sanitize_filename(name):
    """Turn an arbitrary playlist name into a safe single-path-segment filename."""
    # Drop path separators and control characters, collapse whitespace.
    cleaned = re.sub(r'[/\\\x00-\x1f]', ' ', name)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Avoid names that are all dots or empty.
    cleaned = cleaned.strip('.').strip()
    return cleaned or 'playlist'

def _plex_get(path, params=None):
    p = dict(params or {})
    p['X-Plex-Token'] = PLEX_TOKEN
    resp = requests.get(f'{PLEX_URL}{path}', params=p, timeout=60)
    resp.raise_for_status()
    return ElementTree.fromstring(resp.content)

def _plex_music_section():
    """Return the Plex library section key for PLEX_LIBRARY, or None."""
    tree = _plex_get('/library/sections')
    for child in tree.findall('Directory'):
        if child.get('title') == PLEX_LIBRARY:
            return child.get('key')
    return None

def _plex_track_map(section):
    """Return {file_path: ratingKey} for every track in the given section.

    Fetches all tracks in pages; one full pass builds the lookup we use to turn
    m3u track paths into the ratingKeys the create-playlist call needs.
    """
    path_to_key = {}
    start, size = 0, 5000
    while True:
        root = _plex_get(
            f'/library/sections/{section}/all',
            {'type': 10, 'X-Plex-Container-Start': start,
             'X-Plex-Container-Size': size},
        )
        tracks = root.findall('Track')
        for tr in tracks:
            key = tr.get('ratingKey')
            for part in tr.iter('Part'):
                path_to_key[part.get('file')] = key
        if len(tracks) < size:
            break
        start += size
    return path_to_key

def _plex_machine_id():
    return _plex_get('/').get('machineIdentifier')

def _plex_existing_playlists():
    return {
        pl.get('title'): pl.get('ratingKey')
        for pl in _plex_get('/playlists/all').findall('Playlist')
    }

def upload_plex_playlist(title, track_paths):
    """Create/replace a Plex audio playlist named title from track_paths.

    track_paths are /music-prefixed file paths (matching Plex's stored file=
    attribute). We resolve them to ratingKeys and POST /playlists. If a playlist
    with the same title exists it is deleted first so we replace rather than dupe.
    Best-effort: logs and returns False on failure so the m3u8 files still write.
    """
    if not PLEX_TOKEN:
        logger.warning('PLEX_TOKEN not set; skipping Plex playlist import')
        return False
    try:
        section = _plex_music_section()
        if not section:
            logger.warning(
                f'Plex music library "{PLEX_LIBRARY}" not found; skipping import'
            )
            return False

        track_map = _plex_track_map(section)
        keys = [track_map[p] for p in track_paths if p in track_map]
        missing = len(track_paths) - len(keys)
        if not keys:
            logger.warning(
                f'Plex playlist "{title}": 0/{len(track_paths)} tracks matched; '
                'skipping import'
            )
            return False

        existing = _plex_existing_playlists()
        if title in existing:
            requests.delete(
                f'{PLEX_URL}/playlists/{existing[title]}',
                params={'X-Plex-Token': PLEX_TOKEN},
                timeout=30,
            ).raise_for_status()

        machine_id = _plex_machine_id()
        uri = (
            f'server://{machine_id}/com.plexapp.plugins.library'
            f'/library/metadata/{",".join(keys)}'
        )
        resp = requests.post(
            f'{PLEX_URL}/playlists',
            params={
                'type': 'audio',
                'title': title,
                'smart': '0',
                'uri': uri,
                'X-Plex-Token': PLEX_TOKEN,
            },
            timeout=60,
        )
        resp.raise_for_status()
        logger.info(
            f'Imported Plex playlist "{title}": {len(keys)} tracks '
            f'({missing} unmatched)'
        )
        return True
    except requests.exceptions.RequestException as e:
        logger.warning(f'Plex playlist import failed: {e}')
        return False

def build_playlists(artist_ids, name):
    """Build two M3U8 playlists (Plex + Strawberry path variants) of every song
    by the given artists, and write them to /playlists/{plex,strawberry}/.

    Args:
        artist_ids: iterable of artist MBIDs (graph node ids == mb_albumartistid).
        name: playlist name (auto-derived from the focused artist on the frontend).

    Returns:
        dict with name, track_count, artist_count, plex_path, strawberry_path.
    """
    start_time = time.time()
    wanted = set(artist_ids)
    items = fetch_beets_items()

    selected = []
    for item in items:
        artist_id = item.get('mb_albumartistid') or item.get('mb_artistid')
        if artist_id not in wanted:
            continue
        if not item.get('path'):
            continue
        selected.append(item)

    # Keep albums together and in track order.
    def sort_key(item):
        return (
            (item.get('albumartist') or item.get('artist') or '').lower(),
            (item.get('album') or '').lower(),
            item.get('disc') or 0,
            item.get('track') or 0,
        )
    selected.sort(key=sort_key)

    found_artists = {
        (item.get('mb_albumartistid') or item.get('mb_artistid')) for item in selected
    }

    def build_lines(prefix):
        lines = ['#EXTM3U']
        for item in selected:
            path = to_playlist_path(item['path'], prefix)
            duration = int(item.get('length') or 0)
            artist = item.get('artist') or item.get('albumartist') or ''
            title = item.get('title') or ''
            lines.append(f'#EXTINF:{duration},{artist} - {title}')
            lines.append(path)
        return '\n'.join(lines) + '\n'

    safe_name = sanitize_filename(name)
    plex_dir = os.path.join(PLAYLIST_DIR, 'plex')
    strawberry_dir = os.path.join(PLAYLIST_DIR, 'strawberry')
    os.makedirs(plex_dir, exist_ok=True)
    os.makedirs(strawberry_dir, exist_ok=True)

    plex_path = os.path.join(plex_dir, f'{safe_name}.m3u8')
    strawberry_path = os.path.join(strawberry_dir, f'{safe_name}.m3u8')

    with open(plex_path, 'w', encoding='utf-8') as f:
        f.write(build_lines(PLEX_MUSIC_PREFIX))
    with open(strawberry_path, 'w', encoding='utf-8') as f:
        f.write(build_lines(STRAWBERRY_MUSIC_PREFIX))

    plex_track_paths = [
        to_playlist_path(item['path'], PLEX_MUSIC_PREFIX) for item in selected
    ]
    plex_imported = upload_plex_playlist(safe_name, plex_track_paths)

    duration = time.time() - start_time
    logger.info(
        f'Built playlist "{safe_name}": {len(selected)} tracks from '
        f'{len(found_artists)} artists in {duration:.2f}s'
    )
    return {
        'name': safe_name,
        'track_count': len(selected),
        'artist_count': len(found_artists),
        'plex_path': plex_path,
        'strawberry_path': strawberry_path,
        'plex_imported': plex_imported,
    }

def ignore_album(album_id):
    try:
        ignored_release_groups = load_ignored_release_groups()
        albums = load_albums()
        release_groups = load_release_groups()

        if album_id in albums:
            albums.pop(album_id)
        release_group = release_groups.pop(album_id, None)

        ignored_release_groups[album_id] = {
            'artist_id': '' if release_group is None else release_group['artist_id'],
            'title': '' if release_group is None else release_group['title'],
            'reason': 'ignored from UI'
        }

        save_json('./config/ignored_release_groups.json', ignored_release_groups)
        save_json('./config/albums.json', albums)
        save_json('./config/release_groups.json', release_groups)

        logger.info(f'Ignored album: {album_id}')
    except Exception as e:
        logger.error(f'Failed to ignore album {album_id}: {e}', exc_info=True)
        raise

def get_full_catalog():
    start_time = time.time()
    generate_artists()
    generate_release_groups()
    generate_albums()

    artists = load_artists()
    release_groups = load_release_groups()
    albums = load_albums()
    ignored_releases = load_ignored_release_groups()

    catalog = {}
    for artist, artist_name in artists.items():
        catalog[artist] = {
            'name': artist_name,
            'release_groups': {},
        }

    for release_group, rg_data in release_groups.items():
        artist_id = rg_data.get('artist_id')
        if artist_id in catalog:
            catalog[artist_id]['release_groups'][release_group] = rg_data

    for album, album_data in albums.items():
        if album not in release_groups or album in ignored_releases:
            continue

        artist_id = release_groups[album]['artist_id']
        if artist_id not in artists or album not in catalog[artist_id]['release_groups']:
            continue

        catalog[artist_id]['release_groups'][album]['data'] = album_data

    duration = time.time() - start_time
    logger.info(f'get_full_catalog completed in {duration:.2f}s')
    return catalog

def get_current_catalog():
    """Get the current catalog structure based on actual items in Beets and add track status"""
    start_time = time.time()
    try:
        # Fetch beets items from API
        beets_start = time.time()
        resp = requests.get(f'http://{base}/item/')
        beets_duration = time.time() - beets_start
        logger.info(f'Beets API call (items) completed in {beets_duration:.2f}s')
        beets_items = resp.json()['items']
        logger.info(f'Loaded {len(beets_items)} items from Beets')
        # Save the fetched items to disk
        save_beets_items(beets_items)
    except Exception as e:
        logger.error(f'Failed to get items from Beets: {e}', exc_info=True)
        raise

    # Get the full catalog structure to work with
    full_catalog = get_full_catalog()

    # Create a mapping of tracks by artist and release group using track positions
    tracks_by_artist_rg = {}

    # Also index every track title Beets holds per artist. Beets dedupes by
    # recording, so a track can already live under a *different* album (e.g.
    # "The Hardest Part" filed under the EP rather than the LP it also appears
    # on). Matching on artist + normalized title lets those still count as
    # present for the album they otherwise look missing from.
    beets_titles_by_artist = {}

    # Organize items by artist and release group
    # Use mb_albumartistid instead of mb_artistid to handle tracks where the track artist
    # differs from the album artist (e.g., featured artists on compilation albums)
    for item in beets_items:
        artist_id = item.get('mb_albumartistid') or item.get('mb_artistid')
        release_group_id = item.get('mb_releasegroupid')
        track_position = item.get('track')

        # Skip items missing a MusicBrainz artist id (e.g. untagged imports)
        if not artist_id:
            continue

        # Index by title regardless of album / release group id / position so
        # duplicate-across-albums tracks still register as present below.
        track_title = item.get('title')
        if track_title:
            beets_titles_by_artist.setdefault(artist_id, set()).add(
                normalize_title(track_title)
            )

        # Position-based matching still needs the release group id.
        if not release_group_id:
            continue

        if artist_id not in tracks_by_artist_rg:
            tracks_by_artist_rg[artist_id] = {}

        if release_group_id not in tracks_by_artist_rg[artist_id]:
            tracks_by_artist_rg[artist_id][release_group_id] = {}

        if track_position is not None:
            tracks_by_artist_rg[artist_id][release_group_id][track_position] = True

    # Add track status to the full catalog structure
    for artist_id, artist_data in full_catalog.items():
        if artist_id not in tracks_by_artist_rg and artist_id not in beets_titles_by_artist:
            continue

        # Normalized track titles Beets holds for this artist, across all albums.
        artist_titles = beets_titles_by_artist.get(artist_id, set())

        # Initialize artist-level status tracking
        artist_has_complete = False
        artist_has_partial = False
        artist_all_complete = True

        for release_group_id, rg_data in artist_data['release_groups'].items():
            # Positions Beets has for this exact release group (may be absent if Beets
            # holds the album under a different release group id -- title matching below
            # still recovers those tracks).
            rg_positions = tracks_by_artist_rg.get(artist_id, {}).get(release_group_id, {})

            # If Beets has neither positions for this release group nor any title
            # match for the artist, the album really is missing.
            if not rg_positions and not artist_titles:
                rg_data['status'] = 'missing'
                artist_all_complete = False
                continue

            # Initialize album-level status tracking
            album_total_tracks = 0
            album_complete_tracks = 0

            # If this release group has album data with disks/tracks
            if 'data' in rg_data and 'disks' in rg_data['data']:
                mb_positions = set(rg_positions.keys())
                for disk in rg_data['data']['disks']:
                    for track_id, track_info in disk['tracks'].items():
                        track_position = track_info['position']
                        album_total_tracks += 1

                        # Complete if the position matches within this release group, or
                        # if Beets already holds a track with the same title for this
                        # artist (covers duplicates Beets filed under a different album).
                        title_norm = normalize_title(track_info['title'])
                        if track_position in mb_positions or title_norm in artist_titles:
                            track_info['status'] = 'complete'
                            album_complete_tracks += 1
                        else:
                            track_info['status'] = 'missing'

                # Determine album status based on track availability
                if album_total_tracks == 0:
                    rg_data['status'] = 'missing'
                elif album_complete_tracks == 0:
                    rg_data['status'] = 'missing'
                elif album_complete_tracks == album_total_tracks:
                    rg_data['status'] = 'complete'
                else:
                    rg_data['status'] = 'partial'
            else:
                # Album has no track data, but we found tracks in Beets
                rg_data['status'] = 'partial'

            # Update artist-level status tracking
            if rg_data['status'] == 'complete':
                artist_has_complete = True
            elif rg_data['status'] == 'partial':
                artist_has_partial = True
                artist_all_complete = False
            else:  # missing
                artist_all_complete = False

        # Determine artist status
        if not artist_data['release_groups']:  # No release groups
            artist_data['status'] = 'missing'
        elif artist_has_partial:
            artist_data['status'] = 'partial'
        elif artist_all_complete:
            artist_data['status'] = 'complete'
        else:
            # If there are only missing and complete albums, but at least one complete
            if artist_has_complete:
                artist_data['status'] = 'partial'
            else:
                artist_data['status'] = 'missing'

    # Final pass: Ensure all tracks have a status field
    for artist_id, artist_data in full_catalog.items():
        for release_group_id, rg_data in artist_data['release_groups'].items():
            if 'data' in rg_data and 'disks' in rg_data['data']:
                for disk in rg_data['data']['disks']:
                    for track_id, track_info in disk['tracks'].items():
                        # Add missing status if not present
                        if 'status' not in track_info:
                            track_info['status'] = 'missing'

    # Remove artists that have no release groups
    artists_to_remove = []
    for artist_id, artist_data in full_catalog.items():
        if not artist_data['release_groups']:
            artists_to_remove.append(artist_id)
    
    for artist_id in artists_to_remove:
        del full_catalog[artist_id]
    
    if artists_to_remove:
        logger.info(f'Removed {len(artists_to_remove)} artists with no releases')

    duration = time.time() - start_time
    logger.info(f'get_current_catalog completed in {duration:.2f}s')
    return full_catalog

def catalog_stats(catalog):

    # Calculate overall track counts
    total_tracks = 0
    available_tracks = 0

    # Calculate track counts for each artist and album
    for _, artist_data in catalog.items():
        for _, release_data in artist_data['release_groups'].items():

            # Count tracks in this album
            if 'data' in release_data and 'disks' in release_data['data']:
                for disk in release_data['data']['disks']:
                    for track_id, track_info in disk['tracks'].items():
                        total_tracks += 1
                        if track_info['status'] == 'complete':
                            available_tracks += 1
    return total_tracks, available_tracks

def update_current_catalog():
    """Update the current catalog and save to disk"""
    start_time = time.time()
    try:
        current_catalog = get_current_catalog()
        save_json('./config/current_catalog.json', current_catalog)
        duration = time.time() - start_time
        logger.info(f'Updated current catalog and saved to disk in {duration:.2f}s')
        return current_catalog
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f'Failed to update current catalog after {duration:.2f}s: {e}', exc_info=True)
        raise

def get_with_backoff(url):
    attempts = 0
    while True:
        try:
            resp = requests.get(url, headers={'User-Agent': user_agent}, timeout=30)
            # MusicBrainz rate limit: 1 request per second
            time.sleep(1)
            if resp.status_code not in (429, 503) or attempts + 1 >= max_attempts:
                return resp
            retry_after = resp.headers.get('Retry-After')
            sleep_duration = float(retry_after) if retry_after else min(backoff_base ** attempts, max_backoff_secs)
            logger.warning(f'Backing off: attempt={attempts + 1} sleep_secs={sleep_duration} status={resp.status_code}')
        except Exception as e:
            if attempts + 1 >= max_attempts:
                raise
            sleep_duration = min(backoff_base ** attempts, max_backoff_secs)
            logger.warning(f'Backing off: attempt={attempts + 1} sleep_secs={sleep_duration} error={e}')
        time.sleep(sleep_duration)
        attempts += 1

def _flush_out():
    while True:
        time.sleep(1)
        sys.stdout.flush()

def async_flush_std_out():
    t = threading.Thread(target=_flush_out)
    t.daemon = True
    t.start()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    update_current_catalog()

