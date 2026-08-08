"""Tests for the catalog helpers."""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import catalog  # noqa: E402


@pytest.fixture
def config_dir(tmp_path, monkeypatch):
    """Run in a temp cwd with a ./config directory, as the container does."""
    (tmp_path / "config").mkdir()
    monkeypatch.chdir(tmp_path)
    return tmp_path / "config"


class TestSaveJson:
    def test_writes_valid_json(self, tmp_path):
        path = tmp_path / "out.json"
        catalog.save_json(str(path), {"a": 1})
        assert json.loads(path.read_text()) == {"a": 1}

    def test_leaves_no_temp_file_behind(self, tmp_path):
        path = tmp_path / "out.json"
        catalog.save_json(str(path), {"a": 1})
        assert not (tmp_path / "out.json.tmp").exists()

    def test_replaces_an_existing_file(self, tmp_path):
        path = tmp_path / "out.json"
        path.write_text('{"old": true}')
        catalog.save_json(str(path), {"new": True})
        assert json.loads(path.read_text()) == {"new": True}


class TestNormalizeTitle:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Don't Stop", "Dont Stop"),
            ("Don’t Stop", "Dont Stop"),  # curly apostrophe from MusicBrainz
            ('He said "hi"', "He said hi"),
            ("Track  with   spaces", "Track with spaces"),
            ("  padded  ", "padded"),
            ("A × B", "A x B"),
            ("Intro...", "Intro"),
            ("Song [Live]", "Song Live"),
        ],
    )
    def test_normalization(self, raw, expected):
        assert catalog.normalize_title(raw) == expected

    def test_beets_and_musicbrainz_variants_agree(self):
        assert catalog.normalize_title("Don't Stop") == catalog.normalize_title("Don’t Stop")


class TestToPlaylistPath:
    def test_relative_path_is_prefixed(self):
        got = catalog.to_playlist_path("Artist/Album/01 Track.flac", "/music")
        assert got == "/music/Artist/Album/01 Track.flac"

    def test_absolute_music_path_is_not_doubled(self):
        got = catalog.to_playlist_path(
            f"{catalog.PLEX_MUSIC_PREFIX}/Artist/Album/01 Track.flac", "/data"
        )
        assert got == "/data/Artist/Album/01 Track.flac"

    def test_leading_slash_is_stripped(self):
        assert catalog.to_playlist_path("/Artist/Track.flac", "/music") == "/music/Artist/Track.flac"


class TestSanitizeFilename:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Chill Mix", "Chill Mix"),
            ("Rock/Metal", "Rock Metal"),
            ("back\\slash", "back slash"),
            ("lots    of spaces", "lots of spaces"),
            ("...", "playlist"),
            ("", "playlist"),
            ("   ", "playlist"),
        ],
    )
    def test_sanitization(self, raw, expected):
        assert catalog.sanitize_filename(raw) == expected

    def test_result_is_a_single_path_segment(self):
        assert "/" not in catalog.sanitize_filename("a/b/c")
        assert os.sep not in catalog.sanitize_filename("a/b/c")


class TestGetWithBackoff:
    @pytest.fixture(autouse=True)
    def no_sleep(self, monkeypatch):
        self.slept = []
        monkeypatch.setattr(catalog.time, "sleep", lambda s: self.slept.append(s))

    def _responder(self, monkeypatch, statuses, headers=None):
        calls = []

        class Resp:
            def __init__(self, status_code):
                self.status_code = status_code
                self.headers = headers or {}

        def fake_get(url, headers=None, timeout=None):
            calls.append(url)
            return Resp(statuses[min(len(calls) - 1, len(statuses) - 1)])

        monkeypatch.setattr(catalog.requests, "get", fake_get)
        return calls

    def test_success_returns_immediately(self, monkeypatch):
        calls = self._responder(monkeypatch, [200])
        assert catalog.get_with_backoff("https://mb.test/a").status_code == 200
        assert len(calls) == 1

    def test_retries_on_429_then_succeeds(self, monkeypatch):
        calls = self._responder(monkeypatch, [429, 200])
        assert catalog.get_with_backoff("https://mb.test/a").status_code == 200
        assert len(calls) == 2

    def test_retries_on_503(self, monkeypatch):
        calls = self._responder(monkeypatch, [503, 200])
        catalog.get_with_backoff("https://mb.test/a")
        assert len(calls) == 2

    def test_gives_up_after_max_attempts(self, monkeypatch):
        calls = self._responder(monkeypatch, [429])
        resp = catalog.get_with_backoff("https://mb.test/a")
        assert resp.status_code == 429
        assert len(calls) == catalog.max_attempts

    def test_retry_after_header_is_honoured(self, monkeypatch):
        self._responder(monkeypatch, [429, 200], headers={"Retry-After": "4"})
        catalog.get_with_backoff("https://mb.test/a")
        assert 4.0 in self.slept

    def test_backoff_is_capped(self, monkeypatch):
        self._responder(monkeypatch, [429])
        catalog.get_with_backoff("https://mb.test/a")
        assert max(self.slept) <= catalog.max_backoff_secs

    def test_exception_is_retried_then_raised(self, monkeypatch):
        calls = []

        def boom(url, headers=None, timeout=None):
            calls.append(url)
            raise ConnectionError("no route")

        monkeypatch.setattr(catalog.requests, "get", boom)
        with pytest.raises(ConnectionError):
            catalog.get_with_backoff("https://mb.test/a")
        assert len(calls) == catalog.max_attempts


class TestCatalogStats:
    def _catalog(self, statuses):
        return {
            "artist-1": {
                "release_groups": {
                    "rg-1": {
                        "data": {
                            "disks": [
                                {"tracks": {str(i): {"status": s} for i, s in enumerate(statuses)}}
                            ]
                        }
                    }
                }
            }
        }

    def test_counts_total_and_complete(self):
        total, available = catalog.catalog_stats(
            self._catalog(["complete", "complete", "missing"])
        )
        assert (total, available) == (3, 2)

    def test_empty_catalog(self):
        assert catalog.catalog_stats({}) == (0, 0)

    def test_release_group_without_data_is_skipped(self):
        cat = {"artist-1": {"release_groups": {"rg-1": {}}}}
        assert catalog.catalog_stats(cat) == (0, 0)


class TestWatchAlbums:
    def test_missing_file_returns_empty_list(self, config_dir):
        assert catalog.load_watch_albums() == []

    def test_add_then_load(self, config_dir):
        catalog.add_watch_album("rg-1")
        assert catalog.load_watch_albums() == ["rg-1"]

    def test_adding_twice_raises(self, config_dir):
        catalog.add_watch_album("rg-1")
        with pytest.raises(ValueError):
            catalog.add_watch_album("rg-1")

    def test_remove(self, config_dir):
        catalog.add_watch_album("rg-1")
        catalog.add_watch_album("rg-2")
        catalog.remove_watch_album("rg-1")
        assert catalog.load_watch_albums() == ["rg-2"]

    def test_removing_an_absent_album_raises(self, config_dir):
        with pytest.raises(ValueError):
            catalog.remove_watch_album("rg-nope")

    def test_corrupt_file_degrades_to_empty(self, config_dir):
        (config_dir / "watch_albums.json").write_text("{not json")
        assert catalog.load_watch_albums() == []


class TestBuildArtistGraph:
    def _stub(self, monkeypatch, genres, current=None):
        monkeypatch.setattr(catalog, "load_artist_genres", lambda: genres)
        monkeypatch.setattr(catalog, "load_current_catalog", lambda: current or {})

    def test_artists_without_genres_are_dropped(self, monkeypatch):
        self._stub(monkeypatch, {
            "a": {"name": "A", "genres": [{"name": "rock"}]},
            "b": {"name": "B", "genres": []},
        })
        graph = catalog.build_artist_graph()
        assert [n["id"] for n in graph["nodes"]] == ["a"]

    def test_edge_weight_is_the_shared_genre_count(self, monkeypatch):
        self._stub(monkeypatch, {
            "a": {"name": "A", "genres": [{"name": "rock"}, {"name": "punk"}]},
            "b": {"name": "B", "genres": [{"name": "rock"}, {"name": "punk"}]},
        })
        graph = catalog.build_artist_graph(min_shared=2)
        assert len(graph["edges"]) == 1
        assert graph["edges"][0]["weight"] == 2
        assert graph["edges"][0]["shared"] == ["punk", "rock"]

    def test_weak_links_are_dropped_above_the_threshold(self, monkeypatch):
        self._stub(monkeypatch, {
            "a": {"name": "A", "genres": [{"name": "rock"}, {"name": "punk"}]},
            "b": {"name": "B", "genres": [{"name": "rock"}, {"name": "punk"}]},
            "c": {"name": "C", "genres": [{"name": "rock"}]},
        })
        graph = catalog.build_artist_graph(min_shared=2)
        # a-b survives on weight 2; c only has weight-1 links.
        strong = [e for e in graph["edges"] if e["weight"] >= 2]
        assert len(strong) == 1

    def test_stranded_node_keeps_its_strongest_link(self, monkeypatch):
        self._stub(monkeypatch, {
            "a": {"name": "A", "genres": [{"name": "rock"}, {"name": "punk"}]},
            "b": {"name": "B", "genres": [{"name": "rock"}, {"name": "punk"}]},
            "c": {"name": "C", "genres": [{"name": "rock"}]},
        })
        graph = catalog.build_artist_graph(min_shared=2)
        linked = {e["source"] for e in graph["edges"]} | {e["target"] for e in graph["edges"]}
        assert "c" in linked, "nodes must not be stranded without any edge"

    def test_status_comes_from_the_current_catalog(self, monkeypatch):
        self._stub(
            monkeypatch,
            {"a": {"name": "A", "genres": [{"name": "rock"}]}},
            current={"a": {"status": "complete"}},
        )
        assert catalog.build_artist_graph()["nodes"][0]["status"] == "complete"

    def test_status_defaults_to_unknown(self, monkeypatch):
        self._stub(monkeypatch, {"a": {"name": "A", "genres": [{"name": "rock"}]}})
        assert catalog.build_artist_graph()["nodes"][0]["status"] == "unknown"

    def test_artists_with_no_shared_genres_have_no_edges(self, monkeypatch):
        self._stub(monkeypatch, {
            "a": {"name": "A", "genres": [{"name": "rock"}]},
            "b": {"name": "B", "genres": [{"name": "jazz"}]},
        })
        assert catalog.build_artist_graph()["edges"] == []
