"""
Beets Monitor Module

A module for monitoring and managing music catalogs between Beets and Plex.
"""

from .catalog import (
    generate_artists,
    generate_release_groups,
    generate_albums,
    get_current_catalog,
    update_current_catalog,
    load_current_catalog,
    load_artists,
    load_release_groups,
    load_albums,
    get_with_backoff,
    async_flush_std_out
)

__all__ = [
    'generate_artists',
    'generate_release_groups',
    'generate_albums',
    'get_current_catalog',
    'update_current_catalog',
    'load_current_catalog',
    'load_artists',
    'load_release_groups',
    'load_albums',
    'get_with_backoff',
    'async_flush_std_out'
]

__version__ = "1.0.0"
