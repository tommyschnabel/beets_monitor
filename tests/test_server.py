"""Tests for the beets_monitor Flask API."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


@pytest.fixture
def client():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c


class FakeResponse:
    def __init__(self, status_code=200, payload=None, raise_error=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self._raise_error = raise_error

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self._raise_error:
            raise self._raise_error


class TestHealth:
    def test_reports_healthy(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "healthy"

    def test_cors_headers_are_added(self, client):
        resp = client.get("/health")
        assert resp.headers["Access-Control-Allow-Origin"] == "*"


class TestHealthEndpointFilter:
    def test_health_log_lines_are_dropped(self):
        f = server.HealthEndpointFilter()

        class Record:
            msg = 'GET /health HTTP/1.1" 200 -'

        assert f.filter(Record()) is False

    def test_other_lines_pass_through(self):
        f = server.HealthEndpointFilter()

        class Record:
            msg = 'POST /update_catalog HTTP/1.1" 200 -'

        assert f.filter(Record()) is True

    def test_non_string_messages_pass_through(self):
        f = server.HealthEndpointFilter()

        class Record:
            msg = object()

        assert f.filter(Record()) is True


class TestUpdateCatalog:
    def _stub_generation(self, monkeypatch, catalog):
        for name in ("generate_artists", "generate_release_groups", "generate_albums"):
            monkeypatch.setattr(server, name, lambda: None)
        monkeypatch.setattr(server, "update_current_catalog", lambda: catalog)

    def test_returns_the_rebuilt_catalog_with_counts(self, client, monkeypatch):
        self._stub_generation(monkeypatch, {"artist": {}})
        monkeypatch.setattr(server, "catalog_stats", lambda c: (10, 7))

        resp = client.post("/update_catalog")
        body = resp.get_json()

        assert resp.status_code == 200
        assert body["total_tracks"] == 10
        assert body["available_tracks"] == 7
        assert body["catalog"] == {"artist": {}}

    def test_a_generation_failure_is_a_500_not_a_traceback(self, client, monkeypatch):
        def boom():
            raise RuntimeError("musicbrainz unreachable")

        monkeypatch.setattr(server, "generate_artists", boom)

        resp = client.post("/update_catalog")
        assert resp.status_code == 500
        assert "musicbrainz unreachable" in resp.get_json()["message"]


class TestGetCatalog:
    def test_returns_the_catalog_from_disk(self, client, monkeypatch):
        monkeypatch.setattr(server, "load_current_catalog", lambda: {"a": {}})
        monkeypatch.setattr(server, "catalog_stats", lambda c: (3, 1))

        body = client.get("/get_catalog").get_json()
        assert body["catalog"] == {"a": {}}
        assert (body["total_tracks"], body["available_tracks"]) == (3, 1)

    def test_a_missing_catalog_file_is_a_404(self, client, monkeypatch):
        def boom():
            raise FileNotFoundError("current_catalog.json")

        monkeypatch.setattr(server, "load_current_catalog", boom)
        assert client.get("/get_catalog").status_code == 404

    def test_other_failures_are_a_500(self, client, monkeypatch):
        def boom():
            raise RuntimeError("disk on fire")

        monkeypatch.setattr(server, "load_current_catalog", boom)
        assert client.get("/get_catalog").status_code == 500


class TestIgnoreAlbum:
    def test_ignores_the_album(self, client, monkeypatch):
        called = []
        monkeypatch.setattr(server, "ignore_album", lambda aid: called.append(aid))

        resp = client.post("/ignore_album", json={"album_id": "rg-1"})
        assert resp.status_code == 200
        assert called == ["rg-1"]

    def test_a_missing_album_id_is_a_400(self, client):
        assert client.post("/ignore_album", json={}).status_code == 400

    def test_a_failure_in_ignore_album_is_a_500(self, client, monkeypatch):
        def boom(aid):
            raise RuntimeError("albums.json is locked")

        monkeypatch.setattr(server, "ignore_album", boom)
        assert client.post("/ignore_album", json={"album_id": "rg-1"}).status_code == 500


class TestArtistGraph:
    def test_returns_nodes_edges_and_counts(self, client, monkeypatch):
        graph = {"nodes": [{"id": "a"}, {"id": "b"}], "edges": [{"source": "a", "target": "b"}]}
        monkeypatch.setattr(server, "build_artist_graph", lambda min_shared=2: graph)

        body = client.get("/artist_graph").get_json()
        assert body["node_count"] == 2
        assert body["edge_count"] == 1

    def test_min_shared_is_forwarded(self, client, monkeypatch):
        seen = {}

        def fake(min_shared=2):
            seen["min_shared"] = min_shared
            return {"nodes": [], "edges": []}

        monkeypatch.setattr(server, "build_artist_graph", fake)
        client.get("/artist_graph?min_shared=4")
        assert seen["min_shared"] == 4

    def test_a_non_numeric_min_shared_falls_back_to_the_default(self, client, monkeypatch):
        seen = {}

        def fake(min_shared=2):
            seen["min_shared"] = min_shared
            return {"nodes": [], "edges": []}

        monkeypatch.setattr(server, "build_artist_graph", fake)
        client.get("/artist_graph?min_shared=lots")
        assert seen["min_shared"] == 2


class TestCreatePlaylist:
    def test_builds_the_playlists(self, client, monkeypatch):
        seen = {}

        def fake(artist_ids, name):
            seen.update(artist_ids=artist_ids, name=name)
            return {"tracks": 12, "paths": ["/playlists/plex/Chill.m3u8"]}

        monkeypatch.setattr(server, "build_playlists", fake)

        resp = client.post("/create_playlist", json={"artist_ids": ["a"], "name": "  Chill  "})
        assert resp.status_code == 200
        assert resp.get_json()["tracks"] == 12
        assert seen == {"artist_ids": ["a"], "name": "Chill"}

    def test_no_artists_is_a_400(self, client):
        resp = client.post("/create_playlist", json={"artist_ids": [], "name": "Chill"})
        assert resp.status_code == 400

    def test_a_blank_name_is_a_400(self, client):
        resp = client.post("/create_playlist", json={"artist_ids": ["a"], "name": "   "})
        assert resp.status_code == 400

    def test_a_missing_body_is_a_400(self, client):
        assert client.post("/create_playlist").status_code == 400

    def test_a_build_failure_is_a_500(self, client, monkeypatch):
        def boom(artist_ids, name):
            raise RuntimeError("/playlists is read-only")

        monkeypatch.setattr(server, "build_playlists", boom)
        resp = client.post("/create_playlist", json={"artist_ids": ["a"], "name": "Chill"})
        assert resp.status_code == 500


class TestUpdateArtistGenres:
    def test_refreshes_and_returns_the_graph(self, client, monkeypatch):
        seen = {}
        monkeypatch.setattr(server, "generate_artist_genres",
                            lambda force=False: seen.update(force=force))
        monkeypatch.setattr(server, "build_artist_graph",
                            lambda **kw: {"nodes": [{"id": "a"}], "edges": []})

        body = client.post("/update_artist_genres", json={}).get_json()
        assert body["node_count"] == 1
        assert seen["force"] is False

    def test_force_is_forwarded(self, client, monkeypatch):
        seen = {}
        monkeypatch.setattr(server, "generate_artist_genres",
                            lambda force=False: seen.update(force=force))
        monkeypatch.setattr(server, "build_artist_graph", lambda **kw: {"nodes": [], "edges": []})

        client.post("/update_artist_genres", json={"force": True})
        assert seen["force"] is True

    def test_a_failure_is_a_500(self, client, monkeypatch):
        def boom(force=False):
            raise RuntimeError("rate limited")

        monkeypatch.setattr(server, "generate_artist_genres", boom)
        assert client.post("/update_artist_genres", json={}).status_code == 500


class TestSlskdSearch:
    @pytest.fixture(autouse=True)
    def configured_slskd_url(self, monkeypatch):
        monkeypatch.setattr(server, "SLSKD_URL", "http://slskd:5030")

    def test_disabled_when_slskd_url_is_unset(self, client, monkeypatch):
        monkeypatch.setattr(server, "SLSKD_URL", "")
        assert client.post("/slskd_search", json={"query": "x"}).status_code == 501

    def test_starts_a_search(self, client, monkeypatch):
        seen = {}

        def fake_post(url, json=None, headers=None, timeout=None):
            seen.update(url=url, json=json, headers=headers)
            return FakeResponse(payload={"id": "search-1"})

        monkeypatch.setattr(server.requests, "post", fake_post)

        body = client.post("/slskd_search", json={"query": "  boards of canada  "}).get_json()
        assert body["query"] == "boards of canada"
        assert seen["json"] == {"searchText": "boards of canada"}
        assert seen["url"].endswith("/api/v0/searches")

    def test_the_api_key_is_sent_when_configured(self, client, monkeypatch):
        seen = {}
        monkeypatch.setattr(server, "SLSKD_API_KEY", "secret-key")

        def fake_post(url, json=None, headers=None, timeout=None):
            seen.update(headers=headers)
            return FakeResponse(payload={})

        monkeypatch.setattr(server.requests, "post", fake_post)
        client.post("/slskd_search", json={"query": "x"})
        assert seen["headers"]["X-API-Key"] == "secret-key"

    def test_a_blank_query_is_a_400(self, client):
        assert client.post("/slskd_search", json={"query": "   "}).status_code == 400

    def test_an_upstream_error_is_a_500(self, client, monkeypatch):
        monkeypatch.setattr(
            server.requests, "post",
            lambda *a, **k: FakeResponse(raise_error=RuntimeError("slskd is down")),
        )
        assert client.post("/slskd_search", json={"query": "x"}).status_code == 500


class TestWatchAlbums:
    def test_lists_the_watch_list_with_a_count(self, client, monkeypatch):
        monkeypatch.setattr(server, "load_watch_albums", lambda: ["rg-1", "rg-2"])
        body = client.get("/watch_albums").get_json()
        assert body["watch_albums"] == ["rg-1", "rg-2"]
        assert body["count"] == 2

    def test_a_watched_album_is_found(self, client, monkeypatch):
        monkeypatch.setattr(server, "load_watch_albums", lambda: ["rg-1"])
        body = client.get("/watch_albums/rg-1").get_json()
        assert body["watched"] is True

    def test_an_unwatched_album_is_a_404(self, client, monkeypatch):
        monkeypatch.setattr(server, "load_watch_albums", lambda: [])
        assert client.get("/watch_albums/rg-1").status_code == 404

    def test_adding_an_album_returns_201(self, client, monkeypatch):
        added = []
        monkeypatch.setattr(server, "add_watch_album", lambda aid: added.append(aid))

        resp = client.post("/watch_albums", json={"album_id": "rg-1"})
        assert resp.status_code == 201
        assert added == ["rg-1"]

    def test_adding_without_an_album_id_is_a_400(self, client):
        assert client.post("/watch_albums", json={}).status_code == 400

    def test_adding_a_duplicate_is_a_400(self, client, monkeypatch):
        def boom(aid):
            raise ValueError("already watched")

        monkeypatch.setattr(server, "add_watch_album", boom)
        resp = client.post("/watch_albums", json={"album_id": "rg-1"})
        assert resp.status_code == 400
        assert "already watched" in resp.get_json()["message"]

    def test_an_unexpected_add_failure_is_a_500(self, client, monkeypatch):
        def boom(aid):
            raise RuntimeError("config dir is read-only")

        monkeypatch.setattr(server, "add_watch_album", boom)
        assert client.post("/watch_albums", json={"album_id": "rg-1"}).status_code == 500

    def test_deleting_an_album_returns_200(self, client, monkeypatch):
        removed = []
        monkeypatch.setattr(server, "remove_watch_album", lambda aid: removed.append(aid))

        resp = client.delete("/watch_albums/rg-1")
        assert resp.status_code == 200
        assert removed == ["rg-1"]

    def test_deleting_an_absent_album_is_a_404(self, client, monkeypatch):
        def boom(aid):
            raise ValueError("not in watch list")

        monkeypatch.setattr(server, "remove_watch_album", boom)
        assert client.delete("/watch_albums/rg-1").status_code == 404

    def test_an_unexpected_delete_failure_is_a_500(self, client, monkeypatch):
        def boom(aid):
            raise RuntimeError("config dir is read-only")

        monkeypatch.setattr(server, "remove_watch_album", boom)
        assert client.delete("/watch_albums/rg-1").status_code == 500
