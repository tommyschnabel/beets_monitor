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
