// --------------------------------------------------
// GLOBAL STATE
// --------------------------------------------------
let currentMovie = null;


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
        container.innerHTML = 'No movie ID provided';
        return;
    }

    loadFromTMDB(id, source, container);
}


// --------------------------------------------------
// TMDB API
// --------------------------------------------------
function loadFromTMDB(id, source, container) {
    const apiKey = "https://streambox-api.bpvw7gw5zw.workers.dev";
    if(source === "tvshows"){
        const urlTv = `${apiKey}/?endpoint=tv/${id}&language=en-US&append_to_response=credits,videos`;
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
    const url = `${apiKey}/?endpoint=movie/${id}&language=en-US&append_to_response=credits,videos`;
    fetch(url)
        .then(r => r.json())
        .then(m => {
            if (m && m.id) {
                displayMovieDetails(mapTMDBDetails(m));
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
                poster: m.poster_path?`https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
                description: m.overview,
                year: m.release_date?m.release_date.substring(0,4) : "",
                rating: m.vote_average,
                runtime: null,
                gener: m.genre_ids || [],
                genres: [],
                alt: "",
                show:`https://vidsrc.icu/embed/tv/${m.id}`,
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
                poster: m.poster_path?`https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
                description: m.overview,
                year: m.release_date?m.release_date.substring(0,4) : "",
                rating: m.vote_average,
                runtime: null,
                gener: m.genre_ids || [],
                genres: [],
                alt: "",
                show:`https://vidsrc.icu/embed/movie/${m.id}`,
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
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
        description: m.overview,
        year: m.release_date ? m.release_date.substring(0, 4) : "",
        rating: m.vote_average,
        runtime: m.runtime || null,
        gener: [],
        alt: "",
        show: `https://vidsrc.icu/embed/movie/${m.id}`,
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
    }else{
        loadFromTvShowsJson(id, container);
    }
}










function loadFromNewRich(id, container) {
    fetch("https://streambox-api.bpvw7gw5zw.workers.dev/?endpoint=movie/upcoming&language=en-US&page=2")

        .then(res => res.json())
        .then(data => {
            const movies = [
                ...(data.ComingSoon || [])
            ];

            const movie = movies.find(m => compareIds(m.id, id));

            movie
                ? displayMovieDetails(movie)
                : loadFromMoviesJson(id, container);
        })
        .catch(() => loadFromMoviesJson(id, container));
}








 async function loadFromMoviesJson(id, container) {
        try {
            const fetchPromises =  [];
                for (let i = 0; i <= 500; i++) {
                   fetchPromises.push(
                    fetch(`https://streambox-api.bpvw7gw5zw.workers.dev/?endpoint=movie/popular&language=en-US&page=${i}`)
                    .then(r => r.json())
                   );
                }
            

            const responses = await Promise.all(fetchPromises);
            const movies = responses.flatMap(r => r.results || []);
            
            
            const movie = movies.find(m => compareIds(m.id, id));
            movie ? displayMovieDetails(movie) : container.innerHTML = 'Movie not found';
        } catch (error) {
            console.error("Error loading TopPicks:", error);
            container.innerHTML = 'Error loading movie';
        }
    
}












 async function loadFromTvShowsJson(id, container) {
        try {
            const fetchPromises =  [];
                for (let i = 0; i <= 500; i++) {
                   fetchPromises.push(
                    fetch(`https://streambox-api.bpvw7gw5zw.workers.dev/?endpoint=tv/popular&language=en-US&page=${i}`)
                    .then(r => r.json())
                   );
                }
            

            const responses = await Promise.all(fetchPromises);
            const movies = responses.flatMap(r => r.results || []);
            
            
            const movie = movies.find(m => compareIds(m.id, id));
            movie ? displayTvShowDetails(movie) : container.innerHTML = 'Movie not found';
        } catch (error) {
            console.error("Error loading TopPicks:", error);
            container.innerHTML = 'Error loading movie';
        }
    
}















// --------------------------------------------------
// DISPLAY MOVIE
// --------------------------------------------------
function displayMovieDetails(movie) {
    currentMovie = movie;

    const container = document.getElementById('moviedetails');

    // Load My List
    const myList = JSON.parse(localStorage.getItem('myList')) || [];
    
    const isInList = myList.some(m => String(m.id) === String(movie.id));

    const buttonText = isInList ? '✔ Added To List' : 'Add To List';

    // Safely support BOTH "gener" and "genres"
    const genresArray = movie.gener || movie.genres || [];

    // Store movie safely for inline button
    const movieData = JSON.stringify(movie).replace(/'/g, '&#39;');

    container.innerHTML = `
    <div class="dets">

        <h1 id="detail">${movie.name || movie.original_title || movie.title || 'Untitled'}</h1>

        <video src="" autoplay muted playsinline poster="${movie.poster}"></video>

        <div class="movie-info">

            <div class="movie-meta">
                ${movie.year ? `<span class="year">${movie.year}</span>` : ''}
                ${movie.rating ? `<span class="rating">🌟${movie.rating}rating</span>` : ''}
                ${movie.runtime ? `<span class="duration">${movie.runtime}min</span>` : ''}
            </div>

            <div class="geners">
                ${Array.isArray(genresArray) ? genresArray.map(g => `<span class="gener-tag">${g}</span>`).join(', ') : ''
                }
            </div>

            ${movie.description ? `<p class="description">${movie.description}</p>` : '...'}

${movie.cast && movie.cast.length ? `<div class="cast"> <h3>Cast</h3> <p>${movie.cast.join(' . ')}</p> </div> ` : ''}

            <div class="actions">
                <a href="${movie.show}" id="playLink">
                    <button class="play">▶ Play</button>
                </a>


                 <a href="https://vidlink.pro/movie/${movie.id}" id="playLink">
                    <button class="play">▶ Play2</button>
                </a>

                <button class="play"
                    data-movie-id="${movie.id}"
                    data-movie='${movieData}'
                    onclick="addToList(event, JSON.parse(this.dataset.movie))">
                    ${buttonText}
                </button>


            </div>

        </div>

    </div>




     <div class="dete">
    <h4>Notice : Kindly take note that our explore section might take a few seconds to load</h4>
   </div>
 



    `;
}




















function displayTvShowDetails(movie) {
    currentMovie = movie;

    const container = document.getElementById('moviedetails');

    // Load My List
    const myList = JSON.parse(localStorage.getItem('myList')) || [];
    
    const isInList = myList.some(m => String(m.id) === String(movie.id));

    const buttonText = isInList ? '✔ Added To List' : 'Add To List';

    // Safely support BOTH "gener" and "genres"
    const genresArray = movie.gener || movie.genres || [];

    // Store movie safely for inline button
    const movieData = JSON.stringify(movie).replace(/'/g, '&#39;');

    container.innerHTML = `
    <div class="dets">

        <h1 id="detail">${movie.name || movie.original_title || movie.title || 'Untitled'}</h1>

        <video src="" autoplay muted playsinline poster="${movie.poster || ''}">
        </video>

        <div class="movie-info">

            <div class="movie-meta">
                ${movie.year ? `<span class="year">${movie.year}</span>` : ''}
                ${movie.rating ? `<span class="rating">🌟${movie.rating}</span>` : ''}
                ${movie.runtime ? `<span class="duration">${movie.runtime}min</span>` : ''}
            </div>

            <div class="geners">
                ${Array.isArray(genresArray) ? genresArray.map(g => `<span class="gener-tag">${g}</span>`).join(', ') : ''
                }
            </div>

            ${movie.description ? `<p class="description">${movie.description}</p>` : ''}

${movie.cast && movie.cast.length ? `<div class="cast"> <h3>Cast</h3> <p>${movie.cast.join(' . ')}</p> </div> ` : ''}

            <div class="actions">
                <a href="${movie.show}" id="playLink">
                    <button class="play">▶ Play</button>
                </a>


                 <a href="https://vidlink.pro/tv/${movie.id}/1/1" id="playLink">
                    <button class="play">▶ Play 2</button>
                </a>

                <button class="play"
                    data-movie-id="${movie.id}"
                    data-movie='${movieData}'
                    onclick="addToList(event, JSON.parse(this.dataset.movie))">
                    ${buttonText}
                </button>

            </div>
        </div>
    </div>

        <div class="dete"> Notice:Kindly take note that to be able to navigate to your desired episode in the player please click on play else choose your preferred episode from the list below.Also all the seasons my not be here so it is advisable to try both, Thank You.</div>

    `;

    renderSeasonsAndEpisodes(movie);
     
}








function renderSeasonsAndEpisodes(movie) {
  const apiBase = "https://streambox-api.bpvw7gw5zw.workers.dev"; // same proxy used elsewhere
  const container = document.getElementById('moviedetails');
  if (!container || !movie) return;

  // Remove existing seasons area if present
  const existing = document.getElementById('seasons-root');
  

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

  // Build seasons list: prefer movie.seasons array; otherwise use totalSeasons
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

  // Season buttons
  seasonsList.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'season-btn';
    btn.textContent = `${s.name}${s.episode_count ? ` (${s.episode_count})` : ''}`;
    btn.dataset.season = s.season_number;
    btn.style.padding = '8px 10px';
    btn.style.borderRadius = '6px';
    btn.style.border = '1px solid #ccc';
    btn.style.background = '#f41414ff';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', () => {
      // visual active state
      document.querySelectorAll('#season-controls .season-btn').forEach(b => b.style.background = '#e4babaff');
      btn.style.background = '#eee';
      loadAndRenderSeason(s.season_number, movie.id, episodesContainer);
    });

    controls.appendChild(btn);
  });

  // Automatically click first season to show episodes
  container.appendChild(root);
  const firstButton = controls.querySelector('.season-btn');
  if (firstButton) firstButton.click();

  // cache for fetched season data
  const seasonCache = {};

  function loadAndRenderSeason(seasonNumber, tvId, targetEl) {
    if (seasonCache[seasonNumber]) {
      renderEpisodes(seasonCache[seasonNumber], seasonNumber, targetEl);
      return;
    }

    const url = `${apiBase}/?endpoint=tv/${tvId}/season/${seasonNumber}&language=en-US`;
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
    targetEl.innerHTML = ''; // clear
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
      card.style.background = '#e6c2c2ff';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      

      const thumb = document.createElement('img');
      thumb.style.width = '100%';
      thumb.style.height = '120px';
      thumb.style.objectFit = 'cover';
      thumb.alt = ep.name || `Episode ${ep.episode_number}`;
      thumb.src = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : PLACEHOLDER_POSTER;

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
      // Construct playable embed URL (same pattern used elsewhere)
      playLink.href = `https://vidsrc.icu/embed/tv/${movie.id}/${seasonNumber}/${ep.episode_number}`;
      playLink.target = '_blank';
      playLink.rel = 'noopener noreferrer';
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
            btn.textContent = inList
                ? '✔ Added To List'
                : 'Add To List';
        });
}

function addToList(event, movie) {
    event.preventDefault();
    event.stopPropagation();

    let list = JSON.parse(localStorage.getItem('myList')) || [];
    const exists = list.some(m => m.id === movie.id);

    list = exists
        ? list.filter(m => m.id !== movie.id)
        : [...list, movie];

    localStorage.setItem('myList', JSON.stringify(list));
    updateAllButtonsForMovie(movie.id, !exists);
}




// --------------------------------------------------
// CONTINUE WATCHING
// --------------------------------------------------
document.addEventListener('click', e => {
    const play = e.target.closest('#playLink');
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





