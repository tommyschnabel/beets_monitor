let catalogData = null;
let catalogPromise = null;
let watchedAlbums = [];

window.onload = () => {
    loadCatalog();
    const initialTab = location.hash.replace('#', '') || 'catalog';
    if (['catalog', 'watched', 'recent', 'web'].includes(initialTab)) {
        switchTab(initialTab, false);
    }
};

window.addEventListener('popstate', () => {
    const tabName = location.hash.replace('#', '') || 'catalog';
    if (['catalog', 'watched', 'recent', 'web'].includes(tabName)) {
        switchTab(tabName, false);
    }
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = message;
    
    toast.appendChild(messageDiv);
    container.appendChild(toast);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

async function slskdSearch(query) {
    if (!query) return;
    try {
        const response = await fetch('/slskd_search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            showToast(`Searching slskd for "${query}"`, 'success');
        } else {
            showToast(`slskd search failed: ${data.message || response.statusText}`, 'error');
        }
    } catch (error) {
        console.error('Error triggering slskd search:', error);
        showToast(`slskd search failed: ${error.message}`, 'error');
    }
}

function loadCatalog() {
    catalogPromise = loadCatalogInternal();
    return catalogPromise;
}

async function loadCatalogInternal() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    document.getElementById('artistList').innerHTML = '';
    document.getElementById('trackStats').innerHTML = '';

    try {
        const response = await fetch('/get_catalog');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        catalogData = data.catalog;

        // Update track stats
        if (data.available_tracks !== undefined && data.total_tracks !== undefined) {
            document.getElementById('trackStats').textContent =
                `${data.available_tracks} / ${data.total_tracks} tracks available`;
        }

        renderCatalog();
        renderRecent();

    } catch (error) {
        console.error('Error loading catalog:', error);
        document.getElementById('error').textContent = `Error loading catalog: ${error.message}`;
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function updateCatalog() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    document.getElementById('artistList').innerHTML = '';

    try {
        const response = await fetch('/update_catalog', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        loadCatalog();

    } catch (error) {
        console.error('Error updating catalog:', error);
        document.getElementById('error').textContent = `Error updating catalog: ${error.message}`;
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function switchTab(tabName, pushState = true) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    document.getElementById(`${tabName}Tab`).classList.add('active');

    // Add active class to selected tab button
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');

    if (pushState) {
        history.pushState(null, '', `#${tabName}`);
    }

    // Load data for the selected tab
    if (tabName === 'watched') {
        loadWatchedAlbums();
    } else if (tabName === 'recent') {
        loadRecent();
    } else if (tabName === 'web') {
        loadArtistGraph();
    }
}

async function loadWatchedAlbums() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    document.getElementById('watchedList').innerHTML = '';

    try {
        // Titles are resolved from catalogData; make sure it's loaded first
        // (e.g. when the page opens directly on the watched tab).
        if (!catalogData) {
            await (catalogPromise || loadCatalog());
        }

        const response = await fetch('/watch_albums');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        watchedAlbums = data.watch_albums;
        renderWatchedAlbums();

    } catch (error) {
        console.error('Error loading watched albums:', error);
        document.getElementById('error').textContent = `Error loading watched albums: ${error.message}`;
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function renderWatchedAlbums() {
    const watchedList = document.getElementById('watchedList');

    if (!watchedAlbums || watchedAlbums.length === 0) {
        watchedList.innerHTML = '<li class="watched-item"><div class="watched-album-info"><div class="watched-album-title">No watched albums</div></div></li>';
        return;
    }

    // Build array of album data with artist name, album title and status
    const albumsData = [];
    watchedAlbums.forEach(albumId => {
        // Look up album data from catalog
        let albumData = null;
        let artistName = '';
        let albumTitle = '';
        let albumYear = '';
        let albumStatus = 'missing';

        // Search through catalog for this album
        if (catalogData) {
            for (const [artistId, artistData] of Object.entries(catalogData)) {
                if (artistData.release_groups && artistData.release_groups[albumId]) {
                    albumData = artistData.release_groups[albumId];
                    artistName = artistData.name;
                    albumTitle = albumData.title;
                    albumStatus = albumData.status || 'missing';
                    
                    // Extract year from release date if available
                    if (albumData.data && albumData.data.date) {
                        const yearMatch = albumData.data.date.match(/(\d{4})/);
                        if (yearMatch && yearMatch[1]) {
                            albumYear = yearMatch[1];
                        }
                    }
                    
                    break;
                }
            }
        }

        albumsData.push({
            albumId,
            artistName,
            albumTitle,
            albumYear,
            albumStatus
        });
    });

    // Alphabetical by artist name, then album title
    albumsData.sort((a, b) => {
        const artistCompare = a.artistName.localeCompare(b.artistName);
        return artistCompare !== 0 ? artistCompare : a.albumTitle.localeCompare(b.albumTitle);
    });

    // Render sorted albums
    albumsData.forEach(({albumId, artistName, albumTitle, albumYear, albumStatus}) => {
        const watchedItem = document.createElement('li');
        watchedItem.className = `watched-item status-${albumStatus}-row`;

        const starText = '★';
        const starClass = 'star-btn watched';

        // Format title with year if available
        const displayTitle = albumYear ? `${albumTitle} (${albumYear})` : albumTitle;

        watchedItem.innerHTML = `
            <div class="watched-header" onclick="toggleWatchedAlbumExpand('${albumId}')">
                <div class="watched-album-info">
                    <div class="watched-album-title">${escapeHtml(displayTitle || albumId)}</div>
                    <div class="watched-album-artist">${escapeHtml(artistName || 'Unknown Artist')}</div>
                </div>
                <div class="watched-album-status">
                    <div class="tooltip">
                        <button class="search-btn" data-query="${escapeHtml(`${artistName || ''} ${albumTitle}`)}" onclick="event.stopPropagation(); slskdSearch(this.dataset.query)">⌕</button>
                        <span class="tooltiptext">Search slskd for this album</span>
                    </div>
                    <div class="tooltip">
                        <button class="${starClass}" onclick="event.stopPropagation(); toggleWatchedAlbum('${albumId}')">${starText}</button>
                        <span class="tooltiptext">Remove from watch list</span>
                    </div>
                </div>
            </div>
            <div class="watched-content" id="watched-${albumId}">
                <ul class="track-list" id="watched-tracks-${albumId}"></ul>
            </div>
        `;

        watchedList.appendChild(watchedItem);
    });
}

function toggleWatchedAlbumExpand(albumId) {
    const content = document.getElementById(`watched-${albumId}`);

    if (content.classList.contains('active')) {
        content.classList.remove('active');
    } else {
        renderWatchedTracks(albumId);
        content.classList.add('active');
    }
}

function renderWatchedTracks(albumId) {
    const tracksContainer = document.getElementById(`watched-tracks-${albumId}`);
    tracksContainer.innerHTML = '';

    // Find album data from catalog
    let albumData = null;
    if (catalogData) {
        for (const [artistId, artistData] of Object.entries(catalogData)) {
            if (artistData.release_groups && artistData.release_groups[albumId]) {
                albumData = artistData.release_groups[albumId];
                break;
            }
        }
    }

    if (!albumData || !albumData.data || !albumData.data.disks || albumData.data.disks.length === 0) {
        tracksContainer.innerHTML = '<li class="track-item">No tracks found for this album</li>';
        return;
    }

    // Check if the release has any tracks
    let hasTracks = false;
    albumData.data.disks.forEach(disk => {
        if (disk.tracks && Object.keys(disk.tracks).length > 0) {
            hasTracks = true;
        }
    });

    if (!hasTracks) {
        tracksContainer.innerHTML = '<li class="track-item">No tracks found for this album</li>';
        return;
    }

    // Create a section for each disk
    albumData.data.disks.forEach((disk, diskIndex) => {
        const diskHeader = document.createElement('div');
        diskHeader.className = 'disk-header';
        diskHeader.textContent = `Disk ${diskIndex + 1}`;
        tracksContainer.appendChild(diskHeader);

        const diskTracksContainer = document.createElement('ul');
        diskTracksContainer.className = 'disk-tracks';

        // Get all tracks for this disk and sort them by position
        const diskTracks = [];
        if (disk.tracks) {
            Object.entries(disk.tracks).forEach(([trackId, trackInfo]) => {
                diskTracks.push({
                    id: trackId,
                    title: trackInfo.title,
                    position: trackInfo.position,
                    status: trackInfo.status
                });
            });
        }

        if (diskTracks.length === 0) {
            const noTracksItem = document.createElement('li');
            noTracksItem.className = 'track-item';
            noTracksItem.textContent = 'No tracks on this disk';
            diskTracksContainer.appendChild(noTracksItem);
        } else {
            // Sort tracks by position
            diskTracks.sort((a, b) => a.position - b.position);

            // Add each track to the disk's track container
            diskTracks.forEach(track => {
                const trackItem = document.createElement('li');
                trackItem.className = 'track-item';

                const statusClass = getStatusClass(track.status);
                trackItem.classList.add(`status-${track.status}-row`);

                trackItem.innerHTML = `
                    <span class="track-name">${track.position}. ${escapeHtml(track.title)}</span>
                `;

                diskTracksContainer.appendChild(trackItem);
            });
        }

        tracksContainer.appendChild(diskTracksContainer);
    });
}

async function toggleWatchedAlbum(albumId) {
    const isWatched = watchedAlbums.includes(albumId);
    
    // Find the artist ID for this album
    let artistId = null;
    if (catalogData) {
        for (const [aid, artistData] of Object.entries(catalogData)) {
            if (artistData.release_groups && artistData.release_groups[albumId]) {
                artistId = aid;
                break;
            }
        }
    }
    
    if (isWatched) {
        // Remove from watch list
        try {
            const response = await fetch(`/watch_albums/${albumId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP error! status: ${response.status}. ${errorData.message || 'No additional error information'}`);
            }

            const data = await response.json();

            if (data.status === 'error') {
                throw new Error(data.message);
            }

            // Update local watched albums list
            watchedAlbums = watchedAlbums.filter(id => id !== albumId);
            renderRecent();
            showToast('Album removed from watch list', 'success');
            
            // Re-render the current artist's releases to update star icons
            if (artistId) {
                renderReleases(artistId);
            }

        } catch (error) {
            console.error('Error removing watched album:', error);
            showToast(`Error removing watched album: ${error.message}`, 'error');
        }
    } else {
        // Add to watch list
        try {
            const response = await fetch('/watch_albums', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    album_id: albumId,
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP error! status: ${response.status}. ${errorData.message || 'No additional error information'}`);
            }

            const data = await response.json();

            if (data.status === 'error') {
                throw new Error(data.message);
            }

            // Update local watched albums list
            watchedAlbums.push(albumId);
            renderRecent();
            showToast('Album added to watch list', 'success');
            
            // Re-render the current artist's releases to update star icons
            if (artistId) {
                renderReleases(artistId);
            }

        } catch (error) {
            console.error('Error adding watched album:', error);
            showToast(`Error adding watched album: ${error.message}`, 'error');
        }
    }
}

async function removeWatchedAlbum(albumId) {
    if (!confirm(`Are you sure you want to remove this album from your watch list?`)) {
        return;
    }

    try {
        const response = await fetch(`/watch_albums/${albumId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}. ${errorData.message || 'No additional error information'}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        // Reload the watched albums list
        loadWatchedAlbums();

    } catch (error) {
        console.error('Error removing watched album:', error);
        showToast(`Error removing watched album: ${error.message}`, 'error');
    }
}

function renderCatalog() {
    const artistList = document.getElementById('artistList');

    if (!catalogData || Object.keys(catalogData).length === 0) {
        artistList.innerHTML = '<li class="artist-item"><div class="artist-header"><div class="artist-name">No artists found in catalog</div></div></li>';
        return;
    }

    // Alphabetical by artist name
    const sortedArtists = Object.entries(catalogData)
        .sort(([, artistA], [, artistB]) => artistA.name.localeCompare(artistB.name));

    sortedArtists.forEach(([artistId, artistData]) => {
        const artistItem = document.createElement('li');
        artistItem.className = 'artist-item';

        const statusClass = getStatusClass(artistData.status);
        artistItem.classList.add(`status-${artistData.status}-row`);

        // Count missing and partial albums
        let missingAlbums = 0;
        let partialAlbums = 0;

        if (artistData.release_groups) {
            Object.values(artistData.release_groups).forEach(release => {
                if (release.status === 'missing') {
                    missingAlbums++;
                } else if (release.status === 'partial') {
                    partialAlbums++;
                }
            });
        }

        artistItem.innerHTML = `
            <div class="artist-header" onclick="toggleArtist('${artistId}')">
                <div class="artist-name">${escapeHtml(artistData.name)}</div>
                <div class="artist-status">
                    ${missingAlbums > 0 ? `<span class="status-missing">${missingAlbums} missing albums</span>` : ''}
                    ${partialAlbums > 0 ? `<span class="status-partial">${partialAlbums} partial albums</span>` : ''}
                </div>
                <div class="tooltip">
                    <button class="search-btn" data-query="${escapeHtml(artistData.name)}" onclick="event.stopPropagation(); slskdSearch(this.dataset.query)">⌕</button>
                    <span class="tooltiptext">Search slskd for this artist</span>
                </div>
            </div>
            <div class="artist-content" id="artist-${artistId}">
                <ul class="release-list" id="releases-${artistId}"></ul>
            </div>
        `;

        artistList.appendChild(artistItem);
    });
}

function toggleArtist(artistId) {
    const content = document.getElementById(`artist-${artistId}`);

    if (content.classList.contains('active')) {
        content.classList.remove('active');
    } else {
        renderReleases(artistId);
        content.classList.add('active');
    }
}

function renderReleases(artistId) {
    const releasesContainer = document.getElementById(`releases-${artistId}`);
    releasesContainer.innerHTML = '';

    const artistData = catalogData[artistId];

    if (!artistData.release_groups || Object.keys(artistData.release_groups).length === 0) {
        releasesContainer.innerHTML = '<li class="release-item">No releases found for this artist</li>';
        return;
    }

    // Alphabetical by release title
    const sortedReleases = Object.entries(artistData.release_groups)
        .sort(([, releaseA], [, releaseB]) => releaseA.title.localeCompare(releaseB.title));

    sortedReleases.forEach(([releaseId, releaseData]) => {
        const releaseItem = document.createElement('li');
            releaseItem.className = 'release-item';

            const statusClass = getStatusClass(releaseData.status);
            releaseItem.classList.add(`status-${releaseData.status}-row`);

            // Count missing and partial tracks
            let missingTracks = 0;
            let partialTracks = 0;

            // Extract the year from the release date if available
            let releaseYear = '';
            if (releaseData.data && releaseData.data.date) {
                // Try to extract the year from the date string
                const yearMatch = releaseData.data.date.match(/(\d{4})/);
                if (yearMatch && yearMatch[1]) {
                    releaseYear = yearMatch[1];
                }
            }

            if (releaseData.data && releaseData.data.disks) {
                releaseData.data.disks.forEach(disk => {
                    Object.values(disk.tracks).forEach(track => {
                        if (track.status === 'missing') {
                            missingTracks++;
                        } else if (track.status === 'partial') {
                            partialTracks++;
                        }
                    });
                });
            }

            // Format the release title with year if available
            const displayTitle = releaseYear ? `${releaseData.title} (${releaseYear})` : releaseData.title;

            const isWatched = watchedAlbums.includes(releaseId);
            const starClass = isWatched ? 'star-btn watched' : 'star-btn';
            const starText = isWatched ? '★' : '☆';
            const starTooltip = isWatched ? 'Remove from watch list' : 'Add to watch list';
            
            releaseItem.innerHTML = `
                <div class="release-header" onclick="toggleRelease('${artistId}', '${releaseId}')">
                    <div class="release-title">${escapeHtml(displayTitle)}</div>
                    <div class="release-controls">
                        <div class="release-status">
                            ${missingTracks > 0 ? `<span class="status-missing">${missingTracks} missing songs</span>` : ''}
                            ${partialTracks > 0 ? `<span class="status-partial">${partialTracks} partial songs</span>` : ''}
                        </div>
                        <div class="tooltip">
                            <button class="search-btn" data-query="${escapeHtml(`${artistData.name} ${releaseData.title}`)}" onclick="event.stopPropagation(); slskdSearch(this.dataset.query)">⌕</button>
                            <span class="tooltiptext">Search slskd for this album</span>
                        </div>
                        <div class="tooltip">
                            <button class="${starClass}" onclick="event.stopPropagation(); toggleWatchedAlbum('${releaseId}')">${starText}</button>
                            <span class="tooltiptext">${starTooltip}</span>
                        </div>
                        <div class="tooltip">
                            <button class="remove-btn" onclick="event.stopPropagation(); removeRelease('${releaseId}')">×</button>
                            <span class="tooltiptext">Remove this album from tracking</span>
                        </div>
                    </div>
                </div>
                <div class="release-content" id="release-${artistId}-${releaseId}">
                    <ul class="track-list" id="tracks-${artistId}-${releaseId}"></ul>
                </div>
            `;

        releasesContainer.appendChild(releaseItem);
    });
}

function toggleRelease(artistId, releaseId) {
    const content = document.getElementById(`release-${artistId}-${releaseId}`);

    if (content.classList.contains('active')) {
        content.classList.remove('active');
    } else {
        renderTracks(artistId, releaseId);
        content.classList.add('active');
    }
}

function renderTracks(artistId, releaseId) {
    const tracksContainer = document.getElementById(`tracks-${artistId}-${releaseId}`);
    tracksContainer.innerHTML = '';

    const releaseData = catalogData[artistId].release_groups[releaseId];

    if (!releaseData.data || !releaseData.data.disks || releaseData.data.disks.length === 0) {
        tracksContainer.innerHTML = '<li class="track-item">No tracks found for this release</li>';
        return;
    }

    // Check if the release has any tracks
    let hasTracks = false;
    releaseData.data.disks.forEach(disk => {
        if (disk.tracks && Object.keys(disk.tracks).length > 0) {
            hasTracks = true;
        }
    });

    if (!hasTracks) {
        tracksContainer.innerHTML = '<li class="track-item">No tracks found for this release</li>';
        return;
    }

    // Create a section for each disk
    releaseData.data.disks.forEach((disk, diskIndex) => {
        const diskHeader = document.createElement('div');
        diskHeader.className = 'disk-header';
        diskHeader.textContent = `Disk ${diskIndex + 1}`;
        tracksContainer.appendChild(diskHeader);

        const diskTracksContainer = document.createElement('ul');
        diskTracksContainer.className = 'disk-tracks';

        // Get all tracks for this disk and sort them by position
        const diskTracks = [];
        if (disk.tracks) {
            Object.entries(disk.tracks).forEach(([trackId, trackInfo]) => {
                diskTracks.push({
                    id: trackId,
                    title: trackInfo.title,
                    position: trackInfo.position,
                    status: trackInfo.status
                });
            });
        }

        if (diskTracks.length === 0) {
            const noTracksItem = document.createElement('li');
            noTracksItem.className = 'track-item';
            noTracksItem.textContent = 'No tracks on this disk';
            diskTracksContainer.appendChild(noTracksItem);
        } else {
            // Sort tracks by position
            diskTracks.sort((a, b) => a.position - b.position);

            // Add each track to the disk's track container
            diskTracks.forEach(track => {
                const trackItem = document.createElement('li');
                trackItem.className = 'track-item';

                const statusClass = getStatusClass(track.status);
                trackItem.classList.add(`status-${track.status}-row`);

                trackItem.innerHTML = `
                    <span class="track-name">${track.position}. ${escapeHtml(track.title)}</span>
                `;

                diskTracksContainer.appendChild(trackItem);
            });
        }

        tracksContainer.appendChild(diskTracksContainer);
    });
}

function getStatusClass(status) {
    switch (status) {
        case 'missing': return 'status-missing';
        case 'partial': return 'status-partial';
        case 'complete': return 'status-available';
        default: return '';
    }
}

async function removeRelease(albumId) {
    if (!confirm(`Are you sure you want to ignore this album?`)) {
        return;
    }

    try {
        const response = await fetch('/ignore_album', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                album_id: albumId,
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}. ${errorData.message || 'No additional error information'}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        showToast('Album removed from tracking', 'success');
        loadCatalog();

    } catch (error) {
        console.error('Error removing release:', error);
        showToast(`Error removing release: ${error.message}`, 'error');
    }
}

/* ==================== Recent releases ==================== */

let recentRange = '90';

async function loadRecent() {
    try {
        const response = await fetch('/watch_albums');
        if (response.ok) watchedAlbums = (await response.json()).watch_albums || watchedAlbums;
    } catch (e) { /* stars just show stale state */ }
    if (!catalogData && catalogPromise) await catalogPromise;
    renderRecent();
}

function setRecentRange(range) {
    recentRange = range;
    renderRecent();
}

// MusicBrainz dates may be YYYY, YYYY-MM or YYYY-MM-DD; pad to a full date.
function fullDate(date) {
    const [y, m = '01', d = '01'] = date.split('-');
    return `${y}-${m}-${d}`;
}

function renderRecent() {
    const list = document.getElementById('recentList');
    if (!list || !catalogData) return;

    document.querySelectorAll('.recent-range button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === recentRange);
    });

    const rows = [];
    for (const [artistId, artistData] of Object.entries(catalogData)) {
        for (const [rgId, rg] of Object.entries(artistData.release_groups || {})) {
            rows.push({
                artistId,
                artistName: artistData.name,
                rgId,
                title: rg.title,
                date: (rg.data && rg.data.date) || '',
                status: rg.status || 'missing',
            });
        }
    }

    let shown = rows;
    if (recentRange === '90') {
        const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        shown = rows.filter(r => r.date && fullDate(r.date) >= cutoff);
    }
    // Newest first; undated albums sink to the bottom.
    shown.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.artistName.localeCompare(b.artistName));

    document.getElementById('recentCount').textContent =
        `${shown.length} album${shown.length === 1 ? '' : 's'}`;

    if (shown.length === 0) {
        list.innerHTML = '<li class="recent-empty">No releases in the last 90 days</li>';
        return;
    }

    list.innerHTML = shown.map(r => {
        const isWatched = watchedAlbums.includes(r.rgId);
        return `
            <li class="release-item recent-item status-${r.status}-row">
                <div class="release-header">
                    <div class="recent-date">${escapeHtml(r.date || '—')}</div>
                    <div class="recent-main">
                        <div class="release-title">${escapeHtml(r.title)}</div>
                        <div class="recent-artist">${escapeHtml(r.artistName)}</div>
                    </div>
                    <div class="release-controls">
                        <div class="release-status"><span class="${getStatusClass(r.status)}">${r.status}</span></div>
                        <div class="tooltip">
                            <button class="search-btn" data-query="${escapeHtml(`${r.artistName} ${r.title}`)}" onclick="slskdSearch(this.dataset.query)">⌕</button>
                            <span class="tooltiptext">Search slskd for this album</span>
                        </div>
                        <div class="tooltip">
                            <button class="${isWatched ? 'star-btn watched' : 'star-btn'}" onclick="toggleWatchedAlbum('${r.rgId}')">${isWatched ? '★' : '☆'}</button>
                            <span class="tooltiptext">${isWatched ? 'Remove from watch list' : 'Add to watch list'}</span>
                        </div>
                        <div class="tooltip">
                            <button class="remove-btn" onclick="removeRelease('${r.rgId}')">×</button>
                            <span class="tooltiptext">Remove this album from tracking</span>
                        </div>
                    </div>
                </div>
            </li>`;
    }).join('');
}

/* ==================== Artist Web (playlist builder) ==================== */
/*
 * Pick a starting artist, then explore outward: the graph shows the focused
 * artist with its most-alike neighbors, and the right pane lets you jump to
 * similar artists or browse everyone sharing a genre. Artists you like are
 * collected into a running playlist that is written out via /create_playlist.
 * All neighbor/genre math is done client-side from the fetched graph.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLAYLIST_STORAGE_KEY = 'artistWebPlaylist';

let artistGraph = { nodes: [], edges: [] };
let graphNodeById = {};
let focusArtistId = null;
// Back-stack of explore views: {type: 'artist'|'genre', id}.
let exploreHistory = [];
// What the explore pane shows: the focused artist, or a genre's artist list.
let exploreView = null;
let graphSim = null;
// Top of the shared-genre color scale, matching the drawn graph's strongest link.
let graphMaxShared = 1;
// Running playlist: ordered artist ids plus the chosen name.
let playlist = loadSavedPlaylist();

function loadSavedPlaylist() {
    try {
        const saved = JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY));
        if (saved && Array.isArray(saved.ids)) return { ids: saved.ids, name: saved.name || '', nameAuto: !!saved.nameAuto };
    } catch (e) { /* storage unavailable or corrupt */ }
    return { ids: [], name: '', nameAuto: false };
}

function savePlaylist() {
    try {
        localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlist));
    } catch (e) { /* storage unavailable */ }
}

async function loadArtistGraph() {
    const empty = document.getElementById('webEmpty');
    const svg = document.getElementById('webGraph');
    empty.style.display = 'none';

    const minShared = document.getElementById('minSharedFilter').value;

    try {
        const response = await fetch(`/artist_graph?min_shared=${minShared}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'error') {
            throw new Error(data.message);
        }

        artistGraph = { nodes: data.nodes || [], edges: data.edges || [] };
        graphNodeById = {};
        artistGraph.nodes.forEach(n => { graphNodeById[n.id] = n; });

        document.getElementById('webStats').textContent =
            `${data.node_count} artists · ${data.edge_count} links`;

        // Drop playlist entries for artists that no longer exist in the graph.
        playlist.ids = playlist.ids.filter(id => graphNodeById[id]);
        renderPlaylist();

        if (artistGraph.nodes.length === 0) {
            stopGraphSim();
            svg.innerHTML = '';
            focusArtistId = null;
            exploreView = null;
            renderExplore();
            empty.innerHTML =
                'No genre data yet.<br>Click <strong>“Fetch genres”</strong> to build the web.<br>' +
                '<span style="font-size:13px;">(First run fetches one artist per second, so it may take a couple of minutes.)</span>';
            empty.style.display = 'block';
            return;
        }

        populateArtistDatalist();

        if (focusArtistId && !graphNodeById[focusArtistId]) {
            focusArtistId = null;
            exploreView = null;
            exploreHistory = [];
        }
        renderGraph();
        renderExplore();
        renderPlaylist();
    } catch (error) {
        console.error('Error loading artist graph:', error);
        empty.innerHTML = `Error loading artist web: ${error.message}`;
        empty.style.display = 'block';
    }
}

function populateArtistDatalist() {
    const datalist = document.getElementById('artistOptions');
    const names = artistGraph.nodes.map(n => n.name).sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
}

function onArtistSearch() {
    const input = document.getElementById('artistSearch');
    const value = input.value.trim().toLowerCase();
    if (!value) return;
    const match = artistGraph.nodes.find(n => n.name.toLowerCase() === value)
        || artistGraph.nodes.find(n => n.name.toLowerCase().includes(value));
    if (match) {
        focusArtist(match.id);
        input.value = '';
        input.blur();
    } else {
        showToast(`No artist matching “${value}” in the web`, 'error');
    }
}

function applyGraphFilter() {
    // Min-shared changes the edge set, which comes from the server.
    loadArtistGraph();
}

async function refreshArtistGenres() {
    const empty = document.getElementById('webEmpty');
    empty.innerHTML = 'Fetching genres from MusicBrainz… this can take a couple of minutes on first run.';
    empty.style.display = 'block';
    stopGraphSim();
    document.getElementById('webGraph').innerHTML = '';

    try {
        const response = await fetch('/update_artist_genres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        showToast('Artist genres updated', 'success');
        loadArtistGraph();
    } catch (error) {
        console.error('Error refreshing artist genres:', error);
        empty.innerHTML = `Error fetching genres: ${error.message}`;
        showToast(`Error fetching genres: ${error.message}`, 'error');
    }
}

// ---- Navigation ----

function pushExploreHistory() {
    if (exploreView) exploreHistory.push(exploreView);
}

function focusArtist(artistId) {
    if (!graphNodeById[artistId]) return;
    if (exploreView && exploreView.type === 'artist' && exploreView.id === artistId) return;
    pushExploreHistory();
    exploreView = { type: 'artist', id: artistId };
    if (artistId !== focusArtistId) {
        focusArtistId = artistId;
        renderGraph();
    } else {
        highlightGraph();
    }
    renderExplore();
    // Playlist dots are colored relative to the focused artist.
    renderPlaylist();
}

// Genre view keeps the graph on the current artist and highlights matches.
function openGenre(genre) {
    pushExploreHistory();
    exploreView = { type: 'genre', id: genre };
    highlightGraph();
    renderExplore();
}

function goBack() {
    if (exploreHistory.length === 0) return;
    exploreView = exploreHistory.pop();
    if (exploreView.type === 'artist' && exploreView.id !== focusArtistId) {
        focusArtistId = exploreView.id;
        renderGraph();
    } else {
        highlightGraph();
    }
    renderExplore();
    // Playlist dots are colored relative to the focused artist.
    renderPlaylist();
}

// All edges incident to an artist, ranked by shared-genre count (most alike first).
function neighborsOf(artistId) {
    const out = [];
    artistGraph.edges.forEach(e => {
        if (e.source === artistId) out.push({ id: e.target, weight: e.weight, shared: e.shared });
        else if (e.target === artistId) out.push({ id: e.source, weight: e.weight, shared: e.shared });
    });
    out.sort((a, b) => b.weight - a.weight);
    return out;
}

function artistsWithGenre(genre) {
    return artistGraph.nodes
        .filter(n => (n.genres || []).includes(genre))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Playlist ----

function inPlaylist(artistId) {
    return playlist.ids.includes(artistId);
}

function togglePlaylistArtist(artistId) {
    if (inPlaylist(artistId)) {
        playlist.ids = playlist.ids.filter(id => id !== artistId);
    } else {
        playlist.ids.push(artistId);
        prefillPlaylistName();
    }
    onPlaylistChanged();
}

function addArtistsToPlaylist(artistIds) {
    const before = playlist.ids.length;
    artistIds.forEach(id => { if (!inPlaylist(id)) playlist.ids.push(id); });
    prefillPlaylistName();
    const added = playlist.ids.length - before;
    showToast(added ? `Added ${added} artist${added === 1 ? '' : 's'}` : 'All already in playlist', 'success');
    onPlaylistChanged();
}

function clearPlaylist() {
    if (playlist.ids.length && !confirm('Remove all artists from the playlist?')) return;
    playlist.ids = [];
    if (playlist.nameAuto) {
        playlist.name = '';
        document.getElementById('playlistName').value = '';
    }
    onPlaylistChanged();
}

// Name a fresh playlist after its first artist, unless the user (or a Plex
// import) already chose a name.
function prefillPlaylistName() {
    if (playlist.ids.length === 0) return;
    if (playlist.name.trim() && !playlist.nameAuto) return;
    const first = graphNodeById[playlist.ids[0]];
    if (!first) return;
    playlist.name = `${first.name} & Similar`;
    playlist.nameAuto = true;
    document.getElementById('playlistName').value = playlist.name;
}

function onPlaylistNameInput(value) {
    playlist.name = value;
    playlist.nameAuto = false;
    savePlaylist();
}

function onPlaylistChanged() {
    savePlaylist();
    renderPlaylist();
    renderExplore();
    highlightGraph();
}

function renderPlaylist() {
    document.getElementById('playlistCount').textContent = playlist.ids.length;
    const nameInput = document.getElementById('playlistName');
    if (document.activeElement !== nameInput) nameInput.value = playlist.name;

    const list = document.getElementById('playlistList');
    if (playlist.ids.length === 0) {
        list.innerHTML = '<li class="pane-empty">No artists yet. Use <strong>+</strong> to add them.</li>';
    } else {
        list.innerHTML = playlist.ids.map(id => {
            const node = graphNodeById[id];
            const name = node ? node.name : id;
            return `<li>
                ${artistLink(id, name)}
                <button class="row-btn remove" onclick="togglePlaylistArtist('${escapeAttr(id)}')" title="Remove">×</button>
            </li>`;
        }).join('');
    }
    document.getElementById('playlistCreateBtn').disabled = playlist.ids.length === 0;
}

async function createPlaylist() {
    const name = document.getElementById('playlistName').value.trim();
    if (!name) {
        showToast('Enter a playlist name', 'error');
        document.getElementById('playlistName').focus();
        return;
    }
    if (playlist.ids.length === 0) {
        showToast('Add at least one artist', 'error');
        return;
    }

    const createBtn = document.getElementById('playlistCreateBtn');
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    try {
        const response = await fetch('/create_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artist_ids: playlist.ids, name })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        showToast(
            `Playlist “${data.name}” created: ${data.track_count} tracks from ${data.artist_count} artists`,
            'success'
        );
    } catch (error) {
        console.error('Error creating playlist:', error);
        showToast(`Error creating playlist: ${error.message}`, 'error');
    } finally {
        createBtn.textContent = 'Create playlist';
        createBtn.disabled = playlist.ids.length === 0;
    }
}

// ---- Load from Plex ----

// Artists of the Plex playlist being previewed in the modal.
let plexPreview = null;

async function openPlexModal() {
    plexPreview = null;
    const body = document.getElementById('plexModalBody');
    body.innerHTML = '<h3>Load from Plex</h3><div class="pane-empty">Loading playlists…</div>';
    document.getElementById('plexModal').style.display = 'flex';
    try {
        const response = await fetch('/plex_playlists');
        const data = await response.json();
        if (!response.ok || data.status === 'error') {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        const items = data.playlists.length
            ? data.playlists.map(pl => `
                <li>
                    <button class="row-link" onclick="loadPlexPlaylist('${escapeAttr(pl.id)}')">
                        <span class="row-name">${escapeHtml(pl.title)}</span>
                    </button>
                    <span class="similar-count">${pl.track_count} tracks${pl.smart ? ' · smart' : ''}</span>
                </li>`).join('')
            : '<li class="pane-empty">No audio playlists on Plex.</li>';
        body.innerHTML = `<h3>Load from Plex</h3><ul class="similar-list modal-list">${items}</ul>`;
    } catch (error) {
        console.error('Error loading Plex playlists:', error);
        body.innerHTML = `<h3>Load from Plex</h3><div class="pane-empty">Error: ${escapeHtml(error.message)}</div>`;
    }
}

async function loadPlexPlaylist(playlistId) {
    const body = document.getElementById('plexModalBody');
    body.innerHTML = '<h3>Load from Plex</h3><div class="pane-empty">Matching tracks to artists…</div>';
    try {
        const response = await fetch(`/plex_playlists/${encodeURIComponent(playlistId)}/artists`);
        const data = await response.json();
        if (!response.ok || data.status === 'error') {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        plexPreview = data;
        // Artists missing from the catalog aren't in the web, so they can't join the playlist here.
        const items = data.artists.map(a => {
            const inWeb = !!graphNodeById[a.id];
            return `<li class="${inWeb ? '' : 'disabled'}" title="${inWeb ? '' : 'Not in the artist web'}">
                <label class="check-row">
                    <input type="checkbox" value="${escapeHtml(a.id)}" ${inWeb ? 'checked' : 'disabled'}
                           onchange="updatePlexSelectedCount()">
                    <span class="row-name">${escapeHtml(a.name)}</span>
                </label>
                <span class="similar-count">${a.track_count} track${a.track_count === 1 ? '' : 's'}</span>
            </li>`;
        }).join('');
        const unmatched = data.unmatched_count
            ? `<div class="pane-empty">${data.unmatched_count} track${data.unmatched_count === 1 ? '' : 's'} not found in beets.</div>` : '';
        body.innerHTML = `
            <button class="panel-back" onclick="openPlexModal()">← Playlists</button>
            <h3>${escapeHtml(data.title)}</h3>
            <div class="panel-section-title">
                Artists (<span id="plexSelectedCount">0</span> selected)
                <span class="pane-actions">
                    <button class="modal-link-btn" onclick="togglePlexArtists(true)">All</button>
                    <button class="modal-link-btn" onclick="togglePlexArtists(false)">None</button>
                </span>
            </div>
            <ul id="plexArtistList" class="similar-list modal-list">${items || '<li class="pane-empty">No matching artists.</li>'}</ul>
            ${unmatched}
            <div class="modal-actions">
                <button class="update-btn modal-secondary" onclick="closePlexModal()">Cancel</button>
                <button id="plexAddBtn" class="update-btn" onclick="addPlexArtists()">Add to playlist</button>
            </div>`;
        updatePlexSelectedCount();
    } catch (error) {
        console.error('Error loading Plex playlist:', error);
        body.innerHTML = `
            <button class="panel-back" onclick="openPlexModal()">← Playlists</button>
            <div class="pane-empty">Error: ${escapeHtml(error.message)}</div>`;
    }
}

function checkedPlexArtistIds() {
    return [...document.querySelectorAll('#plexArtistList input:checked')].map(cb => cb.value);
}

function togglePlexArtists(checked) {
    document.querySelectorAll('#plexArtistList input:not(:disabled)').forEach(cb => { cb.checked = checked; });
    updatePlexSelectedCount();
}

function updatePlexSelectedCount() {
    const count = checkedPlexArtistIds().length;
    document.getElementById('plexSelectedCount').textContent = count;
    document.getElementById('plexAddBtn').disabled = count === 0;
}

// Add the checked artists, adopt the Plex name for a fresh playlist, and
// start exploring from the first artist.
function addPlexArtists() {
    const ids = checkedPlexArtistIds();
    if (ids.length === 0) return;
    if (playlist.ids.length === 0 || !playlist.name.trim() || playlist.nameAuto) {
        playlist.name = plexPreview.title;
        playlist.nameAuto = false;
        document.getElementById('playlistName').value = plexPreview.title;
    }
    closePlexModal();
    addArtistsToPlaylist(ids);
    focusArtist(ids[0]);
}

function closePlexModal() {
    document.getElementById('plexModal').style.display = 'none';
}

// ---- Explore pane ----

// Number of genres an artist shares with the focused artist.
function sharedWithFocus(artistId) {
    const focus = graphNodeById[focusArtistId];
    const node = graphNodeById[artistId];
    if (!focus || !node) return 0;
    const focusGenres = new Set(focus.genres || []);
    return (node.genres || []).filter(g => focusGenres.has(g)).length;
}

// Dot colored like the graph: white for the focus, shared-genre scale otherwise.
function sharedDot(artistId) {
    let color = 'var(--unknown)';
    let title = 'No genres shared with focused artist';
    if (artistId === focusArtistId) {
        color = '#fff';
        title = 'Focused artist';
    } else {
        const shared = sharedWithFocus(artistId);
        if (shared > 0) {
            color = sharedColor(Math.min(shared, graphMaxShared), graphMaxShared);
            title = `${shared} genre${shared === 1 ? '' : 's'} shared with focused artist`;
        }
    }
    return `<span class="legend-dot" style="background: ${color}" title="${title}"></span>`;
}

function artistLink(id, name) {
    return `<button class="row-link" onclick="focusArtist('${escapeAttr(id)}')">
        ${sharedDot(id)}
        <span class="row-name">${escapeHtml(name)}</span>
    </button>`;
}

function addButton(id) {
    const added = inPlaylist(id);
    return `<button class="row-btn${added ? ' added' : ''}" onclick="togglePlaylistArtist('${escapeAttr(id)}')"
        title="${added ? 'Remove from playlist' : 'Add to playlist'}">${added ? '✓' : '+'}</button>`;
}

function renderExplore() {
    const pane = document.getElementById('explorePane');
    const backBtn = exploreHistory.length
        ? '<button class="panel-back" onclick="goBack()">← Back</button>' : '';

    if (!exploreView) {
        pane.innerHTML = `
            <div class="pane-empty">
                Search for an artist above to start exploring.<br>
                Click artists and genres to wander, and <strong>+</strong> to collect them.
            </div>`;
        return;
    }

    if (exploreView.type === 'artist') {
        const node = graphNodeById[exploreView.id];
        if (!node) return;
        const status = node.status || 'unknown';
        const added = inPlaylist(node.id);
        const genreChips = (node.genres || [])
            .map(g => `<button class="genre-chip" onclick="openGenre('${escapeAttr(g)}')">${escapeHtml(g)}</button>`)
            .join('');
        const neighbors = neighborsOf(node.id);
        const similarItems = neighbors.length
            ? neighbors.map(s => {
                const nb = graphNodeById[s.id];
                return `<li title="Shared: ${escapeHtml((s.shared || []).join(', '))}">
                    ${artistLink(s.id, nb ? nb.name : s.id)}
                    <span class="similar-count">${s.weight}</span>
                    ${addButton(s.id)}
                </li>`;
            }).join('')
            : '<li class="pane-empty">No linked artists at this threshold</li>';
        const notAdded = neighbors.map(s => s.id).filter(id => !inPlaylist(id));

        pane.innerHTML = `
            ${backBtn}
            <div class="pane-head">
                <div>
                    <h3>${escapeHtml(node.name)}</h3>
                    <div class="panel-status status-${status}">${status} in library</div>
                </div>
                <button class="update-btn${added ? ' modal-secondary' : ''}" onclick="togglePlaylistArtist('${escapeAttr(node.id)}')">
                    ${added ? '✓ In playlist' : '+ Add'}
                </button>
            </div>
            <div class="panel-section-title">Genres</div>
            <div class="genre-chips">${genreChips || '<span class="pane-empty">None</span>'}</div>
            <div class="panel-section-title">
                Most alike (${neighbors.length})
                ${notAdded.length ? `<button class="modal-link-btn" onclick="addArtistsToPlaylist(neighborsOf('${escapeAttr(node.id)}').map(s => s.id))">Add all</button>` : ''}
            </div>
            <ul class="similar-list">${similarItems}</ul>
        `;
        return;
    }

    const genre = exploreView.id;
    const artists = artistsWithGenre(genre);
    const notAdded = artists.filter(a => !inPlaylist(a.id));
    pane.innerHTML = `
        ${backBtn}
        <div class="pane-head">
            <div>
                <div class="pane-kicker">Genre</div>
                <h3>${escapeHtml(genre)}</h3>
                <div class="panel-status">${artists.length} artist${artists.length === 1 ? '' : 's'}</div>
            </div>
            ${notAdded.length ? `<button class="update-btn" onclick="addArtistsToPlaylist(artistsWithGenre('${escapeAttr(genre)}').map(a => a.id))">+ Add all</button>` : ''}
        </div>
        <ul class="similar-list">
            ${artists.map(a => `<li>${artistLink(a.id, a.name)}${addButton(a.id)}</li>`).join('')}
        </ul>
    `;
}

// ---- Graph ----

function stopGraphSim() {
    if (graphSim) {
        cancelAnimationFrame(graphSim.raf);
        graphSim = null;
    }
}

// Re-apply playlist rings and genre highlighting without rebuilding the graph.
function highlightGraph() {
    if (!graphSim) return;
    const genre = exploreView && exploreView.type === 'genre' ? exploreView.id : null;
    graphSim.nodes.forEach(n => {
        n.el.classList.toggle('in-playlist', inPlaylist(n.id));
        n.el.classList.toggle('dimmed', !!genre && !(n.genres || []).includes(genre));
    });
}

function renderGraph() {
    stopGraphSim();
    const svg = document.getElementById('webGraph');
    svg.innerHTML = '';
    document.getElementById('webEmpty').style.display = 'none';

    const hint = document.getElementById('webHint');
    if (!focusArtistId || !graphNodeById[focusArtistId]) {
        hint.style.display = artistGraph.nodes.length ? 'flex' : 'none';
        return;
    }
    hint.style.display = 'none';

    const maxNeighbors = parseInt(document.getElementById('maxNeighborsFilter').value, 10);
    const focus = graphNodeById[focusArtistId];
    const shown = neighborsOf(focusArtistId).slice(0, maxNeighbors);
    const shownIds = new Set(shown.map(n => n.id));

    const rect = svg.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    const cx = width / 2;
    const cy = height / 2;

    const root = document.createElementNS(SVG_NS, 'g');
    const edgeGroup = document.createElementNS(SVG_NS, 'g');
    const nodeGroup = document.createElementNS(SVG_NS, 'g');
    root.appendChild(edgeGroup);
    root.appendChild(nodeGroup);
    svg.appendChild(root);

    const maxW = shown.length ? shown[0].weight : 1;
    graphMaxShared = maxW;
    updateSharedLegend(maxW);
    const minW = shown.length ? shown[shown.length - 1].weight : 1;
    const Rmin = Math.min(width, height) * 0.16;
    const Rmax = Math.min(width, height) * 0.40;

    // Focus node pinned at center.
    const focusSim = {
        ...focus, x: cx, y: cy, vx: 0, vy: 0, fixed: true, radius: 15, isFocus: true,
    };

    // Neighbors placed radially; stronger links start closer to the center.
    const neighborSims = shown.map((nb, i) => {
        const node = graphNodeById[nb.id];
        const angle = (i / Math.max(1, shown.length)) * Math.PI * 2 - Math.PI / 2;
        const norm = maxW === minW ? 0.5 : (nb.weight - minW) / (maxW - minW);
        const dist = Rmax - norm * (Rmax - Rmin);
        return {
            ...node,
            weight: nb.weight,
            shared: nb.shared,
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0,
            fixed: false,
            radius: 7 + Math.min(10, nb.weight * 2),
            desired: dist,
        };
    });

    const simNodes = [focusSim, ...neighborSims];
    const simById = {};
    simNodes.forEach(n => { simById[n.id] = n; });

    // Spokes from the focus to each shown neighbor.
    const spokeEdges = neighborSims.map(nb => ({
        s: focusSim, t: nb, weight: nb.weight, shared: nb.shared, kind: 'spoke',
    }));

    // Faint links among neighbors that are themselves alike, to hint at clusters.
    const interEdges = [];
    artistGraph.edges.forEach(e => {
        if (shownIds.has(e.source) && shownIds.has(e.target)) {
            interEdges.push({ s: simById[e.source], t: simById[e.target], weight: e.weight, shared: e.shared, kind: 'inter' });
        }
    });

    const allEdges = [...interEdges, ...spokeEdges];

    const edgeEls = allEdges.map(e => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', e.kind === 'spoke' ? 'graph-edge spoke' : 'graph-edge inter');
        line.setAttribute('stroke-width', e.kind === 'spoke' ? Math.min(4, e.weight) : 1);
        // Show the shared genres on hover.
        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = `${e.s.name} ↔ ${e.t.name}: ${(e.shared || []).join(', ')}`;
        line.appendChild(title);
        edgeGroup.appendChild(line);
        e.el = line;
        return e;
    });

    simNodes.forEach(n => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', `graph-node${n.isFocus ? ' focus' : ''}`);
        g.dataset.id = n.id;

        const ring = document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('class', 'playlist-ring');
        ring.setAttribute('r', n.radius + 5);
        g.appendChild(ring);

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('class', 'node-dot');
        circle.setAttribute('r', n.radius);
        if (!n.isFocus) circle.style.fill = sharedColor(n.weight, maxW);
        g.appendChild(circle);

        const tip = document.createElementNS(SVG_NS, 'title');
        tip.textContent = n.isFocus ? n.name
            : `${n.name}: ${n.weight} shared (${(n.shared || []).join(', ')})`;
        g.appendChild(tip);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('dy', -n.radius - 8);
        label.textContent = n.name;
        if (n.isFocus) label.setAttribute('class', 'focus-label');
        g.appendChild(label);

        g.addEventListener('pointerdown', ev => onNodePointerDown(ev, n));
        nodeGroup.appendChild(g);
        n.el = g;
    });

    // Light force pass (few nodes) purely to de-overlap neighbor labels.
    const charge = -2600;
    const spokeStrength = 0.06;
    const interStrength = 0.02;
    let alpha = 1;

    function tick() {
        alpha *= 0.94;

        for (let i = 0; i < simNodes.length; i++) {
            const a = simNodes[i];
            for (let j = i + 1; j < simNodes.length; j++) {
                const b = simNodes[j];
                let dx = a.x - b.x, dy = a.y - b.y;
                let dist2 = dx * dx + dy * dy || 0.01;
                const force = (charge * alpha) / dist2;
                const dist = Math.sqrt(dist2);
                const fx = (dx / dist) * force, fy = (dy / dist) * force;
                if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
                if (!b.fixed) { b.vx += fx; b.vy += fy; }
            }
        }

        spokeEdges.forEach(e => {
            const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const k = (dist - e.t.desired) * spokeStrength * alpha;
            const fx = (dx / dist) * k, fy = (dy / dist) * k;
            if (!e.t.fixed) { e.t.vx -= fx; e.t.vy -= fy; }
        });

        interEdges.forEach(e => {
            const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const k = (dist - 90) * interStrength * alpha;
            const fx = (dx / dist) * k, fy = (dy / dist) * k;
            if (!e.s.fixed) { e.s.vx += fx; e.s.vy += fy; }
            if (!e.t.fixed) { e.t.vx -= fx; e.t.vy -= fy; }
        });

        simNodes.forEach(n => {
            if (!n.fixed) {
                n.vx *= 0.8; n.vy *= 0.8;
                n.x += n.vx; n.y += n.vy;
            }
            n.el.setAttribute('transform', `translate(${n.x},${n.y})`);
        });

        edgeEls.forEach(e => {
            e.el.setAttribute('x1', e.s.x); e.el.setAttribute('y1', e.s.y);
            e.el.setAttribute('x2', e.t.x); e.el.setAttribute('y2', e.t.y);
        });

        if (alpha > 0.02) {
            graphSim.raf = requestAnimationFrame(tick);
        }
    }

    graphSim = {
        raf: 0,
        nodes: simNodes,
        transform: { x: 0, y: 0, k: 1 },
        root,
        reheat() { alpha = Math.max(alpha, 0.4); },
    };
    graphSim.raf = requestAnimationFrame(tick);

    setupGraphInteractions(svg, root);
    highlightGraph();
}

// Sequential purple scale: more shared genres = brighter, more saturated.
function sharedColor(weight, maxWeight) {
    const t = maxWeight <= 1 ? 1 : (weight - 1) / (maxWeight - 1);
    const light = 32 + t * 40;
    const sat = 35 + t * 50;
    return `hsl(262, ${sat}%, ${light}%)`;
}

function updateSharedLegend(maxWeight) {
    document.getElementById('sharedLegendMax').textContent = maxWeight;
    document.getElementById('sharedLegendBar').style.background =
        `linear-gradient(to right, ${sharedColor(1, maxWeight)}, ${sharedColor(maxWeight, maxWeight)})`;
}

// ---- Pan / zoom + node dragging ----

// Window-level listeners are bound once; they act on whichever svg/transform is current.
let panState = null;
window.addEventListener('pointermove', ev => {
    if (!panState || !graphSim) return;
    const t = graphSim.transform;
    t.x = ev.clientX - panState.x;
    t.y = ev.clientY - panState.y;
    graphSim.applyTransform();
});
window.addEventListener('pointerup', () => {
    if (!panState) return;
    panState = null;
    document.getElementById('webGraph').classList.remove('panning');
});

function setupGraphInteractions(svg, root) {
    const t = graphSim.transform;

    graphSim.applyTransform = () => {
        root.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
    };
    graphSim.applyTransform();

    graphSim.toGraphCoords = (ev) => {
        const rect = svg.getBoundingClientRect();
        return {
            x: (ev.clientX - rect.left - t.x) / t.k,
            y: (ev.clientY - rect.top - t.y) / t.k,
        };
    };

    // svg element is reused across renders, so bind its own listeners only once.
    if (svg.dataset.bound) return;
    svg.dataset.bound = '1';

    svg.addEventListener('pointerdown', ev => {
        if (!graphSim || ev.target.closest('.graph-node')) return;
        const tr = graphSim.transform;
        panState = { x: ev.clientX - tr.x, y: ev.clientY - tr.y };
        svg.classList.add('panning');
    });

    svg.addEventListener('wheel', ev => {
        if (!graphSim) return;
        ev.preventDefault();
        const tr = graphSim.transform;
        const rect = svg.getBoundingClientRect();
        const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        const scale = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newK = Math.max(0.3, Math.min(4, tr.k * scale));
        tr.x = mx - ((mx - tr.x) * newK) / tr.k;
        tr.y = my - ((my - tr.y) * newK) / tr.k;
        tr.k = newK;
        graphSim.applyTransform();
    }, { passive: false });
}

function onNodePointerDown(ev, node) {
    ev.stopPropagation();
    node.fixed = true;
    let moved = false;
    const startFixed = node.isFocus;
    const start = { x: ev.clientX, y: ev.clientY };

    function move(e) {
        if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
        moved = true;
        const p = graphSim.toGraphCoords(e);
        node.x = p.x; node.y = p.y;
        node.vx = 0; node.vy = 0;
        node.el.setAttribute('transform', `translate(${node.x},${node.y})`);
        if (graphSim) graphSim.reheat();
    }
    function up(e) {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        node.fixed = startFixed;
        if (moved) return;
        // Shift-click toggles playlist membership; a plain click focuses the artist.
        if (e.shiftKey) togglePlaylistArtist(node.id);
        else focusArtist(node.id);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Tooltips render in a single fixed element so row overflow can't clip them
(function initTooltips() {
    const tip = document.createElement('div');
    tip.id = 'global-tooltip';
    const attach = () => document.body.appendChild(tip);
    if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);

    let current = null;
    const hide = () => { current = null; tip.classList.remove('visible'); };

    document.addEventListener('mouseover', e => {
        const el = e.target.closest('.tooltip');
        if (!el || el === current) return;
        const text = el.querySelector('.tooltiptext')?.textContent.trim();
        if (!text) return hide();
        current = el;
        tip.textContent = text;
        const r = el.getBoundingClientRect();
        const t = tip.getBoundingClientRect();
        let top = r.top - t.height - 6;
        if (top < 4) top = r.bottom + 6;
        const left = Math.min(Math.max(4, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 4);
        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.classList.add('visible');
    });
    document.addEventListener('mouseout', e => {
        if (current && !current.contains(e.relatedTarget)) hide();
    });
    document.addEventListener('scroll', hide, true);
    document.addEventListener('click', hide);
})();
