









// --------------------------------------------------
// GLOBAL STATE
// --------------------------------------------------
let currentMovie = null;

const SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">
  <rect width="100%" height="100%" fill="#ddd"/>
  <text x="50%" y="50%" font-size="20" fill="#888" text-anchor="middle" dominant-baseline="middle">no image</text>
</svg>`;
const PLACEHOLDER_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent(SVG_STRING);

const WORKER_URL = "https://streamboxweb-api.bpvw7gw5zw.workers.dev";

// --------------------------------------------------
// PAGE LOAD
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadMovieDetails();
});

// --------------------------------------------------
// URL HELPERS
// --------------------------------------------------
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        source: params.get('source')
    };
}

function compareIds(a, b) {
    return String(a) === String(b);
}

// --------------------------------------------------
// MAIN CONTROLLER
// --------------------------------------------------
function loadMovieDetails() {
    const { id, source } = getUrlParams();
    const container = document.getElementById('moviedetails');

    if (!id) {
        container.innerHTML = '<div class="error">No movie ID provided</div>';
        return;
    }

    loadFromTMDB(id, source, container);
}

// --------------------------------------------------
// TMDB API
// --------------------------------------------------
function loadFromTMDB(id, source, container) {
    if (source === "tvshows") {
        const urlTv = `${WORKER_URL}/?endpoint=tv/${id}&language=en-US&append_to_response=credits,videos`;
        fetch(urlTv)
            .then(r => r.json())
            .then(m => {
                if (m && m.id) {
                    displayTvShowDetails(mapTMDBTvShow(m));
                } else {
                    loadFromLocalSources(id, source, container);
                }
            })
            .catch(() => {
                loadFromLocalSources(id, source, container);
            });
    } else {
        const url = `${WORKER_URL}/?endpoint=movie/${id}&language=en-US&append_to_response=credits,videos`;
        fetch(url)
            .then(r => r.json())
            .then(m => {
                if (m && m.id) {
                    displayMovieDetails(mapTMDBMovie(m));
                } else {
                    loadFromLocalSources(id, source, container);
                }
            })
            .catch(() => {
                loadFromLocalSources(id, source, container);
            });
    }
}


function mapTMDBTvShow(m) {
    return {
        id: m.id,
        name: m.name || m.title,
        title: m.original_title || m.title || m.name,
        poster: m.poster || (m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : PLACEHOLDER_POSTER),
        description: m.overview || m.description || "",
        year: m.first_air_date ? m.first_air_date.substring(0, 4) : (m.release_date ? m.release_date.substring(0, 4) : (m.year || "")),
        rating: m.vote_average || m.rating,
        runtime: m.episode_run_time ? (Array.isArray(m.episode_run_time) ? m.episode_run_time[0] : m.episode_run_time) : null,
        gener: m.genre_ids || [],
        genres: Array.isArray(m.genres)
            ? (typeof m.genres[0] === "string" ? m.genres : m.genres.map(g => g.name).filter(Boolean))
            : [],
        cast: m.credits && Array.isArray(m.credits.cast)
            ? m.credits.cast.slice(0, 12).map(c => c.name).filter(Boolean)
            : (Array.isArray(m.cast) ? m.cast : []),
        alt: "",
        show: `${WORKER_URL}/embed?url=https://vidsrc.icu/embed/tv/${m.id}`,
        source: 'tvshows',
        totalEpisodes: m.number_of_episodes || 0,
        totalSeasons: m.number_of_seasons || 1
    };
}

function mapTMDBMovie(m) {
    return {
        id: m.id,
        name: m.name || m.title,
        title: m.original_title || m.title || m.name,
        poster: m.poster || (m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : PLACEHOLDER_POSTER),
        description: m.overview || m.description || "",
        year: m.release_date ? m.release_date.substring(0, 4) : (m.first_air_date ? m.first_air_date.substring(0, 4) : (m.year || "")),
        rating: m.vote_average || m.rating,
        runtime: typeof m.runtime === "number" ? m.runtime : (m.runtime && m.runtime.value ? m.runtime.value : null),
        gener: m.genre_ids || [],
        genres: Array.isArray(m.genres)
            ? (typeof m.genres[0] === "string" ? m.genres : m.genres.map(g => g.name).filter(Boolean))
            : [],
        cast: m.credits && Array.isArray(m.credits.cast)
            ? m.credits.cast.slice(0, 12).map(c => c.name).filter(Boolean)
            : (Array.isArray(m.cast) ? m.cast : []),
        alt: "",
        show: `${WORKER_URL}/embed?url=https://vidsrc.icu/embed/movie/${m.id}`,
        source: 'toppicks'
    };
}

function mapTMDBDetails(m) {
    const genres = Array.isArray(m.genres) ? m.genres.map(g => g.name).filter(Boolean) : [];
    const cast = m.credits && Array.isArray(m.credits.cast)
        ? m.credits.cast.slice(0, 12).map(c => c.name).filter(Boolean)
        : [];
    return {
        id: m.id,
        title: m.original_title || m.title || m.name,
        name: m.title || m.name,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : PLACEHOLDER_POSTER,
        description: m.overview,
        year: m.release_date ? m.release_date.substring(0, 4) : "",
        rating: m.vote_average,
        runtime: m.runtime || null,
        gener: [],
        alt: "",
        show: `${WORKER_URL}/embed?url=https://vidsrc.icu/embed/movie/${m.id}`
    };
}

// --------------------------------------------------
// LOCAL FALLBACKS
// --------------------------------------------------
function loadFromLocalSources(id, source, container) {
    if (source === 'newrich') {
        loadFromNewRich(id, container);
    } else if (source === 'tvshows') {
        loadFromTvShowsJson(id, container);
    } else {
        loadFromMoviesJson(id, container);
    }
}










function loadFromNewRich(id, container) {
    fetch(`${WORKER_URL}/?endpoint=movie/upcoming&language=en-US&page=1`)
        .then(res => res.json())
        .then(data => {
            const movies = [
                ...(data.ComingSoon || [])
            ];
            const movie = movies.find(m => compareIds(m.id, id));
            movie ? displayMovieDetails(movie) : loadFromMoviesJson(id, container);
        })
        .catch(() => loadFromMoviesJson(id, container));
}
















async function loadFromMoviesJson(id, container) {
    try {
        const fetchPromises = [];
        for (let i = 0; i <= 500; i++) {
            fetchPromises.push(
                fetch(`${WORKER_URL}/?endpoint=movie/popular&language=en-US&page=${i}`)
                    .then(r => r.json())
            );
        }
        const responses = await Promise.all(fetchPromises);
        const movies = responses.flatMap(r => r.results || []);
        const movie = movies.find(m => compareIds(m.id, id));
        movie ? displayMovieDetails(movie) : container.innerHTML = '<div class="error">Movie not found</div>';
    } catch (error) {
        console.error("Error loading TopPicks:", error);
        container.innerHTML = '<div class="error">Error loading movie</div>';
    }
}
















async function loadFromTvShowsJson(id, container) {
    try {
        const fetchPromises = [];
        for (let i = 0; i <= 500; i++) {
            fetchPromises.push(
                fetch(`${WORKER_URL}/?endpoint=tv/popular&language=en-US&page=${i}`)
                    .then(r => r.json())
            );
        }
        const responses = await Promise.all(fetchPromises);
        const movies = responses.flatMap(r => r.results || []);
        const movie = movies.find(m => compareIds(m.id, id));
        movie ? displayTvShowDetails(movie) : container.innerHTML = '<div class="error">TV Show not found</div>';
    } catch (error) {
        console.error("Error loading TopPicks:", error);
        container.innerHTML = '<div class="error">Error loading TV show</div>';
    }
}
















// --------------------------------------------------
// DISPLAY MOVIE
// --------------------------------------------------
function displayMovieDetails(movie) {
    currentMovie = movie;
    const container = document.getElementById('moviedetails');
    const myList = JSON.parse(localStorage.getItem('myList')) || [];
    const isInList = myList.some(m => String(m.id) === String(movie.id));
    const buttonText = isInList ? '✔Added To List' : 'Add To List';
    const genresArray = movie.gener || movie.genres || [];
    const movieData = JSON.stringify(movie).replace(/'/g, '&#39;');

    container.innerHTML = `
    <div class="dets">
        <h1 id="detail">${movie.name || movie.original_title || movie.title || 'Untitled'}</h1>
        <img src="${movie.poster}" class="dets-video" onerror="this.src='${PLACEHOLDER_POSTER}'">
        <div class="movie-info">
            <div class="movie-meta">
                ${movie.year ? `<span class="year">${movie.year}</span>` : ''}
                ${movie.rating ? `<span class="rating">🌟${movie.rating} rating</span>` : ''}
                ${movie.runtime ? `<span class="duration">${movie.runtime} min</span>` : ''}
            </div>
            <div class="geners">
                ${Array.isArray(genresArray) ? genresArray.map(g => `<span class="gener-tag">${g}</span>`).join(', ') : ''}
            </div>
            ${movie.description ? `<p class="description">${movie.description}</p>` : '...'}
            ${movie.cast && movie.cast.length ? `<div class="cast"><h3>Cast</h3><p>${movie.cast.join(' . ')}</p></div>` : ''}
            <div class="actions">
                <a href="${movie.show}"  class="playLink">
                    <button class="play">▶Play</button>
                </a>


                 <a href="${WORKER_URL}/embed?url=https://vidlink.pro/movie/${movie.id}" class="playLink">
                    <button class="play">Play</button>
                </a>


                <a href="#downloadPopup">
                  <button class="play">Download movie</button>
               </a>
                         <div id="downloadPopup" class="popup">
                                <div class="popup-content">
                           <a href="#" class="close">&times;</a>

                          <h3>Download Movie</h3>
   <p>You need Video DownloadHelper to download this movie. After installing the extension pin it and click play to navigate to the movie then move to Video DownloadHelper extension you will see the media file then click download, this does not work on ios.</p>

    <a href="https://chromewebstore.google.com/detail/video-downloadhelper/lmjnegcaeklhafolokijcfjliaokphfk"
      target="_blank"
      class="popup-btn">
      Install Extension
    </a>
  </div>
</div>
               <button class="play" data-movie-id="${movie.id}" data-movie='${movieData}' onclick="addToList(event, JSON.parse(this.dataset.movie))">
                    ${buttonText}
                </button>
            </div>
        </div>
    </div>
    
    <div class="dete">
        Notice:  It is advisable to download movies for offline viewing because there are misleading ads and if you have an ad blocker like adguard it is recommended to use it.  When using ios it is advisable to go full screen for better experience and the removal of ads.
    </div>`;
}


















function displayTvShowDetails(movie) {
    currentMovie = movie;
    const container = document.getElementById('moviedetails');
    const myList = JSON.parse(localStorage.getItem('myList')) || [];
    const isInList = myList.some(m => String(m.id) === String(movie.id));
    const buttonText = isInList ? '✔Added To List' : 'Add To List';
    const genresArray = movie.gener || movie.genres || [];
    const movieData = JSON.stringify(movie).replace(/'/g, '&#39;');

    container.innerHTML = `
   
   
    <div class="dets">
        
    <h1 id="detail">${movie.name || movie.original_title || movie.title || 'Untitled'}</h1>
        
    <img src="${movie.poster}" class="dets-video" onerror="this.src='${PLACEHOLDER_POSTER}'">
        
    <div class="movie-info">
            <div class="movie-meta">
                ${movie.year ? `<span class="year">${movie.year}</span>` : ''}
                ${movie.rating ? `<span class="rating">🌟${movie.rating}</span>` : ''}
                ${movie.runtime ? `<span class="duration">${movie.runtime} min</span>` : ''}
            </div>
            <div class="geners">
                ${Array.isArray(genresArray) ? genresArray.map(g => `<span class="gener-tag">${g}</span>`).join(', ') : ''}
            </div>
            ${movie.description ? `<p class="description">${movie.description}</p>` : ''}
            ${movie.cast && movie.cast.length ? `<div class="cast"><h3>Cast</h3><p>${movie.cast.join(' . ')}</p></div>` : ''}
            
            
            <div class="actions">
                <a href="${movie.show}" class="playLink">
                    <button class="play">Play</button>
                </a>

          
                 <a href="${WORKER_URL}/embed?url=https://vidlink.pro/tv/${movie.id}/1/1" class="playLink">
                    <button class="play">Play</button>
                </a>


                <a href="#downloadPopup">
                  <button class="play">Download movie</button>
               </a>
               <div id="downloadPopup" class="popup">
  <div class="popup-content">
    <a href="#" class="close">&times;</a>

    <h3>Download Movie</h3>
    <p>You need Video DownloadHelper to download this movie. After installing the extension pin it and click play then move to Video DownloadHelper extension you will see the media file then click download, this does not work on ios.</p>

    <a href="https://chromewebstore.google.com/detail/video-downloadhelper/lmjnegcaeklhafolokijcfjliaokphfk"
      target="_blank"
      class="popup-btn">
      Install Extension
    </a>
  </div>
</div>

                <button class="play" data-movie-id="${movie.id}" data-movie='${movieData}' onclick="addToList(event, JSON.parse(this.dataset.movie))">
                    ${buttonText}
                </button>
            
                </div>
        </div>
    </div>

    <div class="dete">
        Notice: Click play to watch, or select specific episode below. Some seasons may not be available. It is advisable to download episodes for offline viewing because there are misleading ads and if you have an ad blocker like adguard it is recommended to use it. When using ios it is advisable to go full screen for better experience and the removal of ads.
    </div>`;

    renderSeasonsAndEpisodes(movie);
}
















function renderSeasonsAndEpisodes(movie) {
    const container = document.getElementById('moviedetails');
    if (!container || !movie) return;

    const root = document.createElement('div');
    root.id = 'seasons-root';
    root.style.marginTop = '18px';

    const heading = document.createElement('h3');
    heading.textContent = 'Seasons & Episodes';
    heading.style.marginBottom = '8px';
    root.appendChild(heading);

    const controls = document.createElement('div');
    controls.id = 'season-controls';
    controls.style.display = 'flex';
    controls.style.flexWrap = 'wrap';
    controls.style.gap = '8px';
    root.appendChild(controls);

    const episodesContainer = document.createElement('div');
    episodesContainer.id = 'episodes-container';
    episodesContainer.style.marginTop = '12px';
    root.appendChild(episodesContainer);

    let seasonsList = [];
    if (Array.isArray(movie.seasons) && movie.seasons.length) {
        seasonsList = movie.seasons.map(s => ({
            season_number: s.season_number,
            name: s.name || (`Season ${s.season_number}`),
            episode_count: s.episode_count || 0,
            poster_path: s.poster_path || null
        }));
    } else if (movie.totalSeasons && Number(movie.totalSeasons) > 0) {
        for (let i = 1; i <= movie.totalSeasons; i++) {
            seasonsList.push({ season_number: i, name: `Season ${i}`, episode_count: null, poster_path: null });
        }
    }

    if (!seasonsList.length) {
        const msg = document.createElement('p');
        msg.textContent = 'No season information available.';
        root.appendChild(msg);
        container.appendChild(root);
        return;
    }

    // Sort seasons by number to ensure season 1 is first
    seasonsList.sort((a, b) => a.season_number - b.season_number);

    const seasonCache = {};

    seasonsList.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'season-btn';
        btn.textContent = `${s.name}${s.episode_count ? ` (${s.episode_count})` : ''}`;
        btn.dataset.season = s.season_number;
        btn.style.padding = '8px 10px';
        btn.style.borderRadius = '6px';
        btn.style.border = '1px solid #ccc';
        btn.style.background = 'grey'; // Default color
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', () => {
            document.querySelectorAll('#season-controls .season-btn').forEach(b => b.style.background = 'grey');
            btn.style.background = '#eee';
            loadAndRenderSeason(s.season_number, movie.id, episodesContainer);
        });
        controls.appendChild(btn);

        // AUTO-SELECT SEASON 1 when creating it
        if (s.season_number === 1) {
            setTimeout(() => {
                btn.style.background = '#eee';
                loadAndRenderSeason(1, movie.id, episodesContainer);
            }, 100);
        }
    });

    container.appendChild(root);

    // Fallback: if season 1 button exists but wasn't auto-clicked
    setTimeout(() => {
        const firstButton = controls.querySelector('.season-btn');
        if (firstButton && firstButton.style.background !== '#eee') {
            firstButton.click();
        }
    }, 200);

    function loadAndRenderSeason(seasonNumber, tvId, targetEl) {
        if (seasonCache[seasonNumber]) {
            renderEpisodes(seasonCache[seasonNumber], seasonNumber, targetEl);
            return;
        }

        const url = `${WORKER_URL}/?endpoint=tv/${tvId}/season/${seasonNumber}&language=en-US`;
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                const episodes = Array.isArray(data.episodes) ? data.episodes : [];
                seasonCache[seasonNumber] = episodes;
                renderEpisodes(episodes, seasonNumber, targetEl);
            })
            .catch(err => {
                console.error('Error loading season', seasonNumber, err);
                targetEl.innerHTML = `<p style="color:#c66;padding:12px">Failed to load episodes. Try again later.</p>`;
            });
    }

    function renderEpisodes(episodes, seasonNumber, targetEl) {
        // ... (your existing renderEpisodes function remains the same)
        targetEl.innerHTML = '';
        if (!episodes || episodes.length === 0) {
            targetEl.innerHTML = `<p style="padding:12px;color:#666">No episodes found for season ${seasonNumber}.</p>`;
            return;
        }

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(220px,1fr))';
        grid.style.gap = '12px';

        episodes.forEach(ep => {
            const card = document.createElement('div');
            card.className = 'episode-card';
            card.style.border = '1px solid #eee';
            card.style.borderRadius = '6px';
            card.style.overflow = 'hidden';
            card.style.background = '#eeeeeeaf';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';

            const thumb = document.createElement('img');
            thumb.style.width = '100%';
            thumb.style.height = '120px';
            thumb.style.objectFit = 'cover';
            thumb.alt = ep.name || `Episode ${ep.episode_number}`;
            thumb.src = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : PLACEHOLDER_POSTER;
            thumb.onerror = function() { this.src = PLACEHOLDER_POSTER; };

            const info = document.createElement('div');
            info.style.padding = '8px';
            info.style.flex = '1 0 auto';

            const title = document.createElement('h4');
            title.style.margin = '0 0 6px 0';
            title.style.fontSize = '0.95rem';
            title.textContent = `E${ep.episode_number}: ${ep.name || 'Untitled'}`;

            const overview = document.createElement('p');
            overview.style.margin = '0';
            overview.style.fontSize = '0.85rem';
            overview.style.color = '#444';
            overview.style.maxHeight = '3.6em';
            overview.style.overflow = 'hidden';
            overview.textContent = ep.overview || '';

            const meta = document.createElement('div');
            meta.style.display = 'flex';
            meta.style.justifyContent = 'space-between';
            meta.style.alignItems = 'center';
            meta.style.marginTop = '8px';

            const epInfo = document.createElement('small');
            epInfo.style.color = '#666';
            epInfo.textContent = ep.air_date ? `Air: ${ep.air_date}` : '';

            const playLink = document.createElement('a');
            playLink.href = `player.html?id=${movie.id}&type=tv&season=${seasonNumber}&episode=${ep.episode_number}&provider=auto`;
            playLink.style.textDecoration = 'none';

            const playBtn = document.createElement('button');
            playBtn.textContent = '▶ Play';
            playBtn.style.padding = '6px 8px';
            playBtn.style.border = 'none';
            playBtn.style.background = '#111';
            playBtn.style.color = '#fff';
            playBtn.style.borderRadius = '4px';
            playBtn.style.cursor = 'pointer';

            playLink.appendChild(playBtn);
            meta.appendChild(epInfo);
            meta.appendChild(playLink);
            info.appendChild(title);
            info.appendChild(overview);
            info.appendChild(meta);
            card.appendChild(thumb);
            card.appendChild(info);
            grid.appendChild(card);
        });

        targetEl.appendChild(grid);
    }
}








// --------------------------------------------------
// MY LIST
// --------------------------------------------------
function updateAllButtonsForMovie(id, inList) {
    document.querySelectorAll(`[data-movie-id="${id}"]`)
        .forEach(btn => {
            btn.textContent = inList ? '✔Added To List' : 'Add To List';
        });
}

function addToList(event, movie) {
    event.preventDefault();
    event.stopPropagation();
    let list = JSON.parse(localStorage.getItem('myList')) || [];
    const exists = list.some(m => m.id === movie.id);
    list = exists ? list.filter(m => m.id !== movie.id) : [...list, movie];
    localStorage.setItem('myList', JSON.stringify(list));
    updateAllButtonsForMovie(movie.id, !exists);
}

// --------------------------------------------------
// CONTINUE WATCHING
// --------------------------------------------------
document.addEventListener('click', e => {
    const play = e.target.closest('.playLink');
    if (!play || !currentMovie) return;
    let params = getUrlParams();
    const savedSource = params.source || currentMovie.source || 'profile';
    let list = JSON.parse(localStorage.getItem('continueWatching')) || [];
    list = list.filter(m => m.id !== currentMovie.id);
    list.unshift({
        id: currentMovie.id,
        title: currentMovie.title || currentMovie.name,
        poster: currentMovie.poster,
        source: savedSource
    });
    localStorage.setItem('continueWatching', JSON.stringify(list));
    window.location.href = play.href;
});





// --------------------------------------------------
// EXPLORE SECTION FOR MOVIE DETAILS PAGE
// --------------------------------------------------
function loadExploreForMovieDetails() {
    const exploreContainer = document.getElementById('explore');
    if (!exploreContainer) return;

    // Fetch popular movies for explore section
    fetch(`${WORKER_URL}/?endpoint=movie/popular&language=en-US&page=${Math.floor(Math.random() * 500) + 1}`)
        .then(r => r.json())
        .then(data => {
            if (data && data.results) {
                // Map TMDB movies to our format
                const exploreMovies = data.results.map(m => ({
                    id: m.id,
                    name: m.title || m.original_title || m.name,
                    title: m.name || m.original_title || m.title,
                    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : PLACEHOLDER_POSTER,
                    description: m.overview,
                    year: m.release_date ? m.release_date.substring(0, 4) : "",
                    rating: m.vote_average,
                    alt: m.title || m.name,
                    source: 'toppicks'
                }));

                // Clear container
                exploreContainer.innerHTML = '';

                // Take first 20 movies
                const moviesToShow = exploreMovies.slice(0, 20);

                // Add each movie
                moviesToShow.forEach(movie => {
                    const posterWrapper = document.createElement("div");
                    posterWrapper.className = "poster-wrapper";
                    posterWrapper.style.display = "flex";
                    posterWrapper.style.flexDirection = "column";

                    const link = document.createElement("a");
                    link.href = `moviedetails.html?id=${movie.id}&source=toppicks`;

                    const img = document.createElement("img");
                    img.src = movie.poster || PLACEHOLDER_POSTER;
                    img.alt = movie.name || "Movie";
                    img.style.width = "150px";
                    img.style.height = "225px";
                    img.style.objectFit = "cover";
                    img.style.borderRadius = "8px";

                    const title = document.createElement("p");
                    title.textContent = movie.name || movie.title || "Untitled";
                    title.className = "movie-title";
                    title.style.marginTop = "8px";
                    title.style.fontSize = "0.9rem";
                    title.style.textAlign = "center";
                    title.style.maxWidth = "150px";
                    title.style.overflow = "hidden";
                    title.style.textOverflow = "ellipsis";
                    title.style.whiteSpace = "nowrap";

                    link.appendChild(img);
                    posterWrapper.appendChild(link);
                    posterWrapper.appendChild(title);
                    exploreContainer.appendChild(posterWrapper);
                });
            }
        })
        .catch(error => {
            console.error("Error loading explore section:", error);
            exploreContainer.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">Could not load explore content</p>';
        });
}

// Call this when movie details page loads
document.addEventListener('DOMContentLoaded', () => {
    // Load movie details first
    loadMovieDetails();
    
    // Then load explore section
    setTimeout(() => {
        loadExploreForMovieDetails();
    }, 50); // Small delay to ensure main content loads first
});












