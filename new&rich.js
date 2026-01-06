const WORKER_URL = "https://streamboxweb-api.bpvw7gw5zw.workers.dev";

const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');
const type = urlParams.get('type') || 'movie';
const season = urlParams.get('season') || '1';
const episode = urlParams.get('episode') || '1';
const initialProvider = urlParams.get('provider') || 'auto';

let hls = null;
let currentProvider = initialProvider;
let playableCheckTimeout;

// PROVIDERS configuration for extraction sources
const PROVIDERS = {
  'auto': {
    name: 'Auto (Best)',
    icon: '🔄',
    extractor: 'consumet'
  },
  'consumet': {
    name: 'Consumet',
    icon: '🎬',
    extractor: 'consumet'
  },
  'vidlink': {
    name: 'VidLink',
    icon: '🔗',
    extractor: 'vidlink'
  }
};

// DOM Elements
const playerContainer = document.getElementById('player');
const videoElement = document.getElementById('main-video');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const movieInfo = document.getElementById('movieInfo');
const playbackControls = document.getElementById('playbackControls');
const providerButtonsContainer = document.querySelector('.provider-buttons');

// --------------------------------------------------
// 1. EXTRACTOR FUNCTIONS (No Iframe)
// --------------------------------------------------
async function extractWithConsumet(tmdbId, mediaType, s = '1', e = '1') {
  const endpoint = mediaType === 'tv' 
    ? `https://api.consumet.org/meta/tmdb/watch/${tmdbId}?episode=${e}&season=${s}`
    : `https://api.consumet.org/meta/tmdb/watch/${tmdbId}`;
  
  const proxyUrl = `${WORKER_URL}/?endpoint=${encodeURIComponent(endpoint)}`;

  try {
    const response = await fetch(proxyUrl);
    const data = await response.json();
    
    if (data.sources && data.sources.length > 0) {
      // Priority: Look for 'auto' quality (HLS), otherwise take the first one
      const primarySource = data.sources.find(src => src.quality === 'auto') || data.sources[0];
      console.log('Consumet extracted source:', primarySource.url);
      return primarySource.url;
    }
    throw new Error("No video sources found.");
  } catch (err) {
    console.error("Consumet extraction failed:", err);
    return null;
  }
}

async function extractWithVidlink(tmdbId, mediaType, s = '1', e = '1') {
  const endpoint = mediaType === 'tv'
    ? `https://vidlink.pro/tv/${tmdbId}?s=${s}&e=${e}`
    : `https://vidlink.pro/movie/${tmdbId}`;
  
  const proxyUrl = `${WORKER_URL}/?endpoint=${encodeURIComponent(endpoint)}`;

  try {
    const response = await fetch(proxyUrl);
    const data = await response.text();
    
    // Simple regex to find m3u8 or mp4 URLs (you might need more sophisticated parsing)
    const urlMatch = data.match(/https?:\/\/[^\s"'<>]+\.(m3u8|mp4)[^\s"'<>]*/i);
    if (urlMatch) {
      console.log('Vidlink extracted source:', urlMatch[0]);
      return urlMatch[0];
    }
    throw new Error("No direct video URL found.");
  } catch (err) {
    console.error("Vidlink extraction failed:", err);
    return null;
  }
}

async function extractMediaSource(providerName) {
  console.log(`Extracting with ${providerName}...`);
  
  switch(providerName) {
    case 'consumet':
      return await extractWithConsumet(movieId, type, season, episode);
    case 'vidlink':
      return await extractWithVidlink(movieId, type, season, episode);
    default:
      return await extractWithConsumet(movieId, type, season, episode);
  }
}

// --------------------------------------------------
// 2. NATIVE PLAYER (HLS.js)
// --------------------------------------------------
function loadVideo(url, providerName) {
  if (!url) {
    showError(`Could not extract video link from ${PROVIDERS[providerName]?.name || providerName}.`);
    return false;
  }

  // Clear previous player
  if (hls) {
    hls.destroy();
    hls = null;
  }

  // Set video source
  videoElement.src = url;
  
  // Handle HLS streams
  if (url.includes('.m3u8')) {
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hls.loadSource(url);
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`✅ ${providerName} HLS stream loaded`);
        setLoading(false);
        videoElement.play().catch(e => console.log('Autoplay prevented:', e));
        playbackControls.style.display = 'flex';
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              showError(`Network error with ${providerName}. Trying next source...`);
              tryNextProvider(providerName);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              showError(`Playback error with ${providerName}.`);
              break;
          }
        }
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS native HLS support
      videoElement.addEventListener('loadedmetadata', () => {
        console.log(`✅ ${providerName} stream loaded (Safari)`);
        setLoading(false);
        videoElement.play().catch(e => console.log('Autoplay prevented:', e));
        playbackControls.style.display = 'flex';
      });
      videoElement.addEventListener('error', () => {
        showError(`Playback error with ${providerName}.`);
      });
    }
  } else {
    // Direct MP4 or other formats
    videoElement.addEventListener('loadeddata', () => {
      console.log(`✅ ${providerName} direct stream loaded`);
      setLoading(false);
      videoElement.play().catch(e => console.log('Autoplay prevented:', e));
      playbackControls.style.display = 'flex';
    });
    videoElement.addEventListener('error', () => {
      showError(`Failed to load video from ${providerName}.`);
    });
  }

  currentProvider = providerName;
  updateActiveProviderButton(providerName);
  return true;
}

// --------------------------------------------------
// 3. PROVIDER MANAGEMENT
// --------------------------------------------------
async function autoPickAndPlay() {
  setLoading(true);
  hideError();
  
  console.log('Starting auto provider selection...');
  
  // Try providers in order of reliability
  const providersToTry = ['consumet', 'vidlink'];
  
  for (const providerName of providersToTry) {
    console.log(`Trying ${providerName}...`);
    
    const streamUrl = await extractMediaSource(providerName);
    
    if (streamUrl && loadVideo(streamUrl, providerName)) {
      return; // Success
    }
    
    console.warn(`${providerName} failed, trying next...`);
  }
  
  // All providers failed
  setLoading(false);
  showError('All sources failed. Please check the movie ID or try again later.');
}

async function loadWithProvider(providerName) {
  setLoading(true);
  hideError();
  
  const streamUrl = await extractMediaSource(providerName);
  
  if (!streamUrl || !loadVideo(streamUrl, providerName)) {
    // Fallback to auto if selected provider fails
    if (providerName !== 'auto') {
      showError(`${PROVIDERS[providerName].name} failed. Trying auto mode...`);
      setTimeout(() => autoPickAndPlay(), 1500);
    } else {
      showError('Failed to load video. Please try another source.');
    }
  }
}

async function tryNextProvider(failedProvider) {
  const providers = ['consumet', 'vidlink'];
  const currentIndex = providers.indexOf(failedProvider);
  const nextProvider = providers[currentIndex + 1] || providers[0];
  
  if (nextProvider) {
    console.log(`Trying next provider: ${nextProvider}`);
    await loadWithProvider(nextProvider);
  }
}

// --------------------------------------------------
// 4. UI CONTROLS & HELPERS
// --------------------------------------------------
function goBack() {
  if (document.referrer) {
    history.back();
  } else {
    window.location.href = 'moviedetails.html?id=' + movieId;
  }
}

function setLoading(isLoading) {
  if (loadingElement) {
    loadingElement.style.display = isLoading ? 'flex' : 'none';
  }
  if (videoElement) {
    videoElement.style.opacity = isLoading ? '0' : '1';
  }
}

function showError(msg) {
  if (errorElement && errorMessage) {
    errorMessage.textContent = msg || 'Failed to load video. Try another source.';
    errorElement.style.display = 'flex';
  }
  if (playbackControls) {
    playbackControls.style.display = 'none';
  }
}

function hideError() {
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}

function updateActiveProviderButton(providerName) {
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.provider === providerName) {
      btn.classList.add('active');
    }
  });
}

function createProviderButtons() {
  if (!providerButtonsContainer) return;
  
  providerButtonsContainer.innerHTML = '';
  
  Object.keys(PROVIDERS).forEach(providerKey => {
    const provider = PROVIDERS[providerKey];
    const btn = document.createElement('button');
    btn.className = 'provider-btn';
    if (currentProvider === providerKey) btn.classList.add('active');
    btn.dataset.provider = providerKey;
    btn.innerHTML = `${provider.icon || '🎬'} ${provider.name}`;
    
    btn.addEventListener('click', async () => {
      await loadWithProvider(providerKey);
    });
    
    providerButtonsContainer.appendChild(btn);
  });
}

function retry() {
  hideError();
  loadWithProvider(currentProvider);
}

// Load movie information
async function loadMovieInfo() {
  if (!movieInfo) return;
  
  try {
    const endpoint = type === 'tv' ? `tv/${movieId}` : `movie/${movieId}`;
    const url = `${WORKER_URL}/?endpoint=${endpoint}&language=en-US`;
    const res = await fetch(url);
    
    if (res.ok) {
      const data = await res.json();
      // Populate movie info (customize as needed)
      movieInfo.innerHTML = `
        <h2>${data.title || data.name}</h2>
        <p>${data.overview || ''}</p>
      `;
    }
  } catch (error) {
    console.error('Movie info load failed:', error);
    movieInfo.innerHTML = `
      <h2>${type === 'tv' ? 'TV Show' : 'Movie'}</h2>
      <p>Loading content...</p>
    `;
  }
}

// Setup video controls
function setupControls() {
  const playPauseBtn = document.querySelector('.play-pause');
  const volumeSlider = document.querySelector('.volume-slider');
  const progressSlider = document.querySelector('.progress-slider');
  const timeDisplay = document.querySelector('.time-display');
  
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (videoElement.paused) {
        videoElement.play();
        playPauseBtn.textContent = '⏸';
      } else {
        videoElement.pause();
        playPauseBtn.textContent = '▶';
      }
    });
  }
  
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      videoElement.volume = volumeSlider.value / 100;
    });
  }
  
  if (progressSlider) {
    videoElement.addEventListener('timeupdate', () => {
      if (!progressSlider.dragging) {
        const percent = (videoElement.currentTime / videoElement.duration) * 100;
        progressSlider.value = percent || 0;
      }
      
      if (timeDisplay) {
        const formatTime = (seconds) => {
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        };
        timeDisplay.textContent = `${formatTime(videoElement.currentTime)} / ${formatTime(videoElement.duration)}`;
      }
    });
    
    progressSlider.addEventListener('input', () => {
      progressSlider.dragging = true;
    });
    
    progressSlider.addEventListener('change', () => {
      const time = (progressSlider.value / 100) * videoElement.duration;
      videoElement.currentTime = time;
      progressSlider.dragging = false;
    });
  }
}

// --------------------------------------------------
// 5. INITIALIZATION
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  console.log('HLS Player initializing...');
  
  if (!movieId) {
    showError('No movie ID provided. Please go back and select a movie.');
    return;
  }
  
  console.log(`Movie ID: ${movieId}, Type: ${type}, Season: ${season}, Episode: ${episode}`);
  
  // Setup error close button
  const errorCloseBtn = errorElement?.querySelector('.error-close');
  if (errorCloseBtn) {
    errorCloseBtn.addEventListener('click', hideError);
  }
  
  // Setup retry button in error message
  const errorRetryBtn = errorElement?.querySelector('button[onclick="retry()"]');
  if (errorRetryBtn) {
    errorRetryBtn.addEventListener('click', retry);
  }
  
  // Load movie info
  await loadMovieInfo();
  
  // Create provider buttons
  createProviderButtons();
  
  // Setup video controls
  setupControls();
  
  // Start playing
  if (initialProvider === 'auto') {
    autoPickAndPlay();
  } else {
    await loadWithProvider(initialProvider);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
      case 'escape':
        hideError();
        break;
      case 'f':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          const elem = playerContainer || document.documentElement;
          if (elem.requestFullscreen) {
            elem.requestFullscreen();
          }
        }
        break;
      case ' ':
        e.preventDefault();
        if (videoElement.paused) {
          videoElement.play();
          document.querySelector('.play-pause').textContent = '⏸';
        } else {
          videoElement.pause();
          document.querySelector('.play-pause').textContent = '▶';
        }
        break;
    }
  });
});

// Cleanup
window.addEventListener('beforeunload', () => {
  if (hls) {
    hls.destroy();
  }
  if (playableCheckTimeout) {
    clearTimeout(playableCheckTimeout);
  }
});