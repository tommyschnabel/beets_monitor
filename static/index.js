let catalogData = null;
let watchedAlbums = [];

window.onload = loadCatalog;

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

async function loadCatalog() {
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

function toggleDropdown() {
    const dropdown = document.getElementById('beetsDropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
window.onclick = function(event) {
    if (!event.target.matches('.dropdown-btn')) {
        const dropdowns = document.getElementsByClassName('dropdown-content');
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

async function importMusic() {
    // Close dropdown
    document.getElementById('beetsDropdown').classList.remove('show');
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';

    try {
        const response = await fetch('/import', {
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

        showToast('Music import started successfully!', 'success');

    } catch (error) {
        console.error('Error importing music:', error);
        document.getElementById('error').textContent = `Error importing music: ${error.message}`;
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function updateMusic() {
    // Close dropdown
    document.getElementById('beetsDropdown').classList.remove('show');
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';

    try {
        const response = await fetch('/update', {
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

        showToast('Music library update started successfully!', 'success');

    } catch (error) {
        console.error('Error updating music library:', error);
        document.getElementById('error').textContent = `Error updating music library: ${error.message}`;
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function findBad() {
    // Close dropdown
    document.getElementById('beetsDropdown').classList.remove('show');
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';

    try {
        const response = await fetch('/bad', {
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

        showToast('Bad files check started successfully!', 'success');

    } catch (error) {
        console.error('Error checking for bad files:', error);
        document.getElementById('error').textContent = `Error checking for bad files: ${error.message}`;
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function switchTab(tabName) {
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
    event.target.classList.add('active');
    
    // Load data for the selected tab
    if (tabName === 'watched') {
        loadWatchedAlbums();
    } else if (tabName === 'web') {
        loadArtistGraph();
    }
}

async function loadWatchedAlbums() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    document.getElementById('watchedList').innerHTML = '';

    try {
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

    // Build array of album data with artist name, album title, status, and missing track count
    const albumsData = [];
    watchedAlbums.forEach(albumId => {
        // Look up album data from catalog
        let albumData = null;
        let artistName = '';
        let albumTitle = '';
        let albumYear = '';
        let albumStatus = 'missing';
        let missingTracks = 0;

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
                    
                    // Count missing tracks
                    if (albumData.data && albumData.data.disks) {
                        albumData.data.disks.forEach(disk => {
                            Object.values(disk.tracks).forEach(track => {
                                if (track.status === 'missing') {
                                    missingTracks++;
                                }
                            });
                        });
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
            albumStatus,
            missingTracks
        });
    });

    // Sort by missing tracks ascending, then by artist name
    albumsData.sort((a, b) => {
        // First sort by missing tracks ascending
        const missingCompare = a.missingTracks - b.missingTracks;
        if (missingCompare !== 0) {
            return missingCompare;
        }
        
        // Then sort by artist name
        return a.artistName.localeCompare(b.artistName);
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
                    <div class="watched-album-title">${displayTitle || albumId}</div>
                    <div class="watched-album-artist">${artistName || 'Unknown Artist'}</div>
                </div>
                <div class="watched-album-status">
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
                    <span class="track-name">${track.position}. ${track.title}</span>
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

    const sortedArtists = Object.entries(catalogData).sort(([idA, artistA], [idB, artistB]) => {
        // Put completed artists first
        const aComplete = artistA.status === 'complete';
        const bComplete = artistB.status === 'complete';

        if (aComplete && !bComplete) return -1;
        if (!aComplete && bComplete) return 1;

        // Secondary sort by artist name (alphanumeric)
        return artistA.name.localeCompare(artistB.name);
    });

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
                <div class="artist-name">${artistData.name}</div>
                <div class="artist-status">
                    ${missingAlbums > 0 ? `<span class="status-missing">${missingAlbums} missing albums</span>` : ''}
                    ${partialAlbums > 0 ? `<span class="status-partial">${partialAlbums} partial albums</span>` : ''}
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

    const sortedReleases = Object.entries(artistData.release_groups).sort(([idA, releaseA], [idB, releaseB]) => {
        // Get the date for each release
        const dateA = releaseA.data ? releaseA.data.date : '';
        const dateB = releaseB.data ? releaseB.data.date : '';

        // If both have dates, compare them (newest first)
        if (dateA && dateB) {
            return dateB.localeCompare(dateA);
        }

        // If one has a date and the other doesn't, the one with a date comes first
        if (dateA) return -1;
        if (dateB) return 1;

        // If neither has a date, fall back to comparing titles
        return releaseA.title.localeCompare(releaseB.title);
    });

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
                    <div class="release-title">${displayTitle}</div>
                    <div class="release-controls">
                        <div class="release-status">
                            ${missingTracks > 0 ? `<span class="status-missing">${missingTracks} missing songs</span>` : ''}
                            ${partialTracks > 0 ? `<span class="status-partial">${partialTracks} partial songs</span>` : ''}
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
                    <span class="track-name">${track.position}. ${track.title}</span>
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

    } catch (error) {
        console.error('Error removing release:', error);
        showToast(`Error removing release: ${error.message}`, 'error');
    }
}

/* ==================== Artist Web (genre-linked ego graph) ==================== */
/*
 * A full 160-node force graph is an unreadable hairball, so we show a focused
 * "ego" view: one artist in the center with only its most-alike neighbors around
 * it. Clicking a neighbor re-centers the web on them, so you explore outward one
 * hop at a time. All neighbor math is done client-side from the fetched edge set.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

let artistGraph = { nodes: [], edges: [] };
let graphNodeById = {};
let focusArtistId = null;
let focusHistory = [];
let graphSim = null;

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

        if (artistGraph.nodes.length === 0) {
            stopGraphSim();
            svg.innerHTML = '';
            hideArtistPanel();
            empty.innerHTML =
                'No genre data yet.<br>Click <strong>“Fetch genres from MusicBrainz”</strong> to build the web.<br>' +
                '<span style="font-size:13px;">(First run fetches one artist per second, so it may take a couple of minutes.)</span>';
            empty.style.display = 'block';
            return;
        }

        populateArtistDatalist();

        // Keep the current focus across a refetch when possible; otherwise start
        // from the most-connected artist so the default view is rich.
        if (!focusArtistId || !graphNodeById[focusArtistId]) {
            focusArtistId = highestDegreeArtist();
            focusHistory = [];
        }

        renderGraph();

    } catch (error) {
        console.error('Error loading artist graph:', error);
        empty.innerHTML = `Error loading artist web: ${error.message}`;
        empty.style.display = 'block';
    }
}

function degreeMap() {
    const degree = {};
    artistGraph.edges.forEach(e => {
        degree[e.source] = (degree[e.source] || 0) + 1;
        degree[e.target] = (degree[e.target] || 0) + 1;
    });
    return degree;
}

function highestDegreeArtist() {
    const degree = degreeMap();
    let best = artistGraph.nodes[0] ? artistGraph.nodes[0].id : null;
    let bestDeg = -1;
    artistGraph.nodes.forEach(n => {
        const d = degree[n.id] || 0;
        if (d > bestDeg) { bestDeg = d; best = n.id; }
    });
    return best;
}

function populateArtistDatalist() {
    const datalist = document.getElementById('artistOptions');
    const names = artistGraph.nodes.map(n => n.name).sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = '';
    names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        datalist.appendChild(opt);
    });
}

function onArtistSearch() {
    const value = document.getElementById('artistSearch').value.trim().toLowerCase();
    if (!value) return;
    const match = artistGraph.nodes.find(n => n.name.toLowerCase() === value)
        || artistGraph.nodes.find(n => n.name.toLowerCase().includes(value));
    if (match) {
        setFocus(match.id);
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
    hideArtistPanel();

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

function stopGraphSim() {
    if (graphSim) {
        cancelAnimationFrame(graphSim.raf);
        graphSim = null;
    }
}

function setFocus(artistId, pushHistory = true) {
    if (!graphNodeById[artistId]) return;
    if (artistId === focusArtistId) return;
    if (pushHistory && focusArtistId) {
        focusHistory.push(focusArtistId);
    }
    focusArtistId = artistId;
    document.getElementById('artistSearch').value = graphNodeById[artistId].name;
    renderGraph();
}

function goBack() {
    if (focusHistory.length === 0) return;
    focusArtistId = focusHistory.pop();
    document.getElementById('artistSearch').value = graphNodeById[focusArtistId].name;
    renderGraph();
}

// All edges incident to the focus artist, ranked by shared-genre count (most alike first).
function neighborsOf(artistId) {
    const out = [];
    artistGraph.edges.forEach(e => {
        if (e.source === artistId) out.push({ id: e.target, weight: e.weight, shared: e.shared });
        else if (e.target === artistId) out.push({ id: e.source, weight: e.weight, shared: e.shared });
    });
    out.sort((a, b) => b.weight - a.weight);
    return out;
}

function renderGraph() {
    stopGraphSim();
    const svg = document.getElementById('webGraph');
    svg.innerHTML = '';
    document.getElementById('webEmpty').style.display = 'none';

    if (!focusArtistId || !graphNodeById[focusArtistId]) {
        return;
    }

    const maxNeighbors = parseInt(document.getElementById('maxNeighborsFilter').value, 10);
    const focus = graphNodeById[focusArtistId];
    const allNeighbors = neighborsOf(focusArtistId);
    const shown = allNeighbors.slice(0, maxNeighbors);
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

    const nodeEls = simNodes.map(n => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', `graph-node status-${n.status || 'unknown'}${n.isFocus ? ' focus' : ''}`);
        g.dataset.id = n.id;

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', n.radius);
        g.appendChild(circle);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('dy', -n.radius - 5);
        label.textContent = n.name + (n.isFocus ? '' : `  (${n.weight})`);
        if (n.isFocus) label.setAttribute('class', 'focus-label');
        g.appendChild(label);

        g.addEventListener('pointerdown', ev => onNodePointerDown(ev, n));
        nodeGroup.appendChild(g);
        n.el = g;
        return n;
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
    showArtistPanel(focusArtistId, allNeighbors);
}

// ---- Pan / zoom + node dragging ----

function setupGraphInteractions(svg, root) {
    const t = graphSim.transform;

    function applyTransform() {
        root.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
    }
    applyTransform();

    graphSim.toGraphCoords = (ev) => {
        const rect = svg.getBoundingClientRect();
        return {
            x: (ev.clientX - rect.left - t.x) / t.k,
            y: (ev.clientY - rect.top - t.y) / t.k,
        };
    };

    let panning = false;
    let panStart = null;
    svg.addEventListener('pointerdown', ev => {
        if (ev.target.closest('.graph-node')) return;
        panning = true;
        panStart = { x: ev.clientX - t.x, y: ev.clientY - t.y };
        svg.classList.add('panning');
    });
    window.addEventListener('pointermove', ev => {
        if (!panning) return;
        t.x = ev.clientX - panStart.x;
        t.y = ev.clientY - panStart.y;
        applyTransform();
    });
    window.addEventListener('pointerup', () => {
        panning = false;
        svg.classList.remove('panning');
    });

    svg.addEventListener('wheel', ev => {
        ev.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        const scale = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newK = Math.max(0.3, Math.min(4, t.k * scale));
        t.x = mx - ((mx - t.x) * newK) / t.k;
        t.y = my - ((my - t.y) * newK) / t.k;
        t.k = newK;
        applyTransform();
    }, { passive: false });
}

function onNodePointerDown(ev, node) {
    ev.stopPropagation();
    node.fixed = true;
    let moved = false;
    const startFixed = node.isFocus;

    function move(e) {
        moved = true;
        const p = graphSim.toGraphCoords(e);
        node.x = p.x; node.y = p.y;
        node.vx = 0; node.vy = 0;
        node.el.setAttribute('transform', `translate(${node.x},${node.y})`);
        if (graphSim) graphSim.reheat();
    }
    function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        node.fixed = startFixed;
        // A click (no drag) on a neighbor re-centers the web on them.
        if (!moved && !node.isFocus) setFocus(node.id);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

// ---- Detail panel ----

function showArtistPanel(artistId, allNeighbors) {
    const panel = document.getElementById('artistPanel');
    const node = graphNodeById[artistId];
    if (!node) return;

    const statusLabel = node.status || 'unknown';
    const genreChips = (node.genres || [])
        .map(g => `<span class="genre-chip">${escapeHtml(g)}</span>`)
        .join('');

    const similarItems = allNeighbors.length
        ? allNeighbors.map(s => {
            const nb = graphNodeById[s.id];
            const name = nb ? nb.name : s.id;
            const dotStatus = nb ? (nb.status || 'unknown') : 'unknown';
            return `<li onclick="setFocus('${escapeAttr(s.id)}')" title="Shared: ${escapeAttr((s.shared || []).join(', '))}">
                <span class="similar-name"><span class="legend-dot status-${dotStatus}-dot"></span>${escapeHtml(name)}</span>
                <span class="similar-count">${s.weight} shared</span>
            </li>`;
        }).join('')
        : '<li style="cursor:default;">No linked artists at this threshold</li>';

    const backBtn = focusHistory.length
        ? `<button class="panel-back" onclick="goBack()">← Back</button>` : '';

    panel.innerHTML = `
        ${backBtn}
        <h3>${escapeHtml(node.name)}</h3>
        <div class="panel-status status-${statusLabel}">${statusLabel} in library</div>
        <div class="panel-section-title">Genres</div>
        <div class="genre-chips">${genreChips || '<span style="color:#777;">None</span>'}</div>
        <div class="panel-section-title">Most alike (${allNeighbors.length})</div>
        <ul class="similar-list">${similarItems}</ul>
    `;
    panel.style.display = 'block';
}

function hideArtistPanel() {
    const panel = document.getElementById('artistPanel');
    if (panel) panel.style.display = 'none';
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
