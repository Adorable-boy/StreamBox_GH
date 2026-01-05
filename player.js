const WORKER_URL = "https://streambox-api.bpvw7gw5zw.workers.dev";

const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');
const type = urlParams.get('type') || 'movie';
const season = urlParams.get('season');
const episode = urlParams.get('episode');
const initialProvider = urlParams.get('provider') || 'auto';

let currentIframe = null;
let playableCheckTimeout;

// Enhanced PROVIDERS configuration with fallbacks and multiple URL patterns
const PROVIDERS = {
  'vidsrc.to': {
    movie: 'https://vidsrc.to/embed/movie/',
    tv: 'https://vidsrc.to/embed/tv/',
    patterns: {
      movie: 'https://vidsrc.to/embed/movie/{id}',
      tv: 'https://vidsrc.to/embed/tv/{id}/{season}/{episode}'
    },
    fallbacks: [
      'https://vidsrc.me/embed/{type}/{id}',
      'https://vidsrc.pro/embed/{type}/{id}'
    ]
  },
  'vidsrc.icu': {
    movie: 'https://vidsrc.icu/embed/movie/',
    tv: 'https://vidsrc.icu/embed/tv/',
    patterns: {
      movie: 'https://vidsrc.icu/embed/movie/{id}',
      tv: 'https://vidsrc.icu/embed/tv/{id}/{season}/{episode}'
    }
  },
  'vidlink.pro': {
    movie: 'https://vidlink.pro/movie/',
    tv: 'https://vidlink.pro/tv/',
    patterns: {
      movie: 'https://vidlink.pro/movie/{id}',
      tv: 'https://vidlink.pro/tv/{id}'
    },
    // vidlink.pro uses different parameters
    urlBuilder: function(type, id, season, episode) {
      if (type === 'tv') {
        // vidlink.pro TV shows use query parameters
        const url = `https://vidlink.pro/tv/${id}`;
        const params = new URLSearchParams();
        if (season) params.set('s', season);
        if (episode) params.set('e', episode);
        return params.toString() ? `${url}?${params.toString()}` : url;
      }
      return `https://vidlink.pro/movie/${id}`;
    }
  },
  '2embed.org': {
    movie: 'https://2embed.org/embed/movie?tmdb=',
    tv: 'https://2embed.org/embed/tv?tmdb=',
    patterns: {
      movie: 'https://2embed.org/embed/movie?tmdb={id}',
      tv: 'https://2embed.org/embed/tv?tmdb={id}&season={season}&episode={episode}'
    }
  },
  'multiembed.mov': {
    movie: 'https://multiembed.mov/?video_id=',
    tv: 'https://multiembed.mov/?video_id=',
    patterns: {
      movie: 'https://multiembed.mov/?video_id={id}&s=tmdb',
      tv: 'https://multiembed.mov/?video_id={id}&s=tmdb&season={season}&episode={episode}'
    }
  }
};

// DOM Elements
const playerContainer = document.getElementById('player');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const movieInfo = document.getElementById('movieInfo');
const playbackControls = document.getElementById('playbackControls');

const playPauseBtn = document.getElementById('playPauseBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeBar = document.getElementById('volumeBar');
const progressBar = document.getElementById('progressBar');
const speedSelect = document.getElementById('speedSelect');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');

function goBack() {
  if (document.referrer && document.referrer.includes(window.location.hostname)) {
    history.back();
  } else {
    window.location.href = 'moviedetails.html?id=' + movieId;
  }
}

function buildEmbedUrl(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) return null;
  
  let embedUrl = '';
  
  // Use custom URL builder if available
  if (provider.urlBuilder) {
    embedUrl = provider.urlBuilder(type, movieId, season, episode);
  } else {
    // Standard URL building
    if (type === 'tv') {
      const s = season || '1';
      const e = episode || '1';
      
      if (providerName === '2embed.org') {
        embedUrl = `${provider.tv}${movieId}&season=${s}&episode=${e}`;
      } else if (providerName === 'multiembed.mov') {
        embedUrl = `${provider.tv}${movieId}&s=tmdb&season=${s}&episode=${e}`;
      } else {
        embedUrl = `${provider.tv}${movieId}/${s}/${e}`;
      }
    } else {
      if (providerName === '2embed.org') {
        embedUrl = `${provider.movie}${movieId}`;
      } else if (providerName === 'multiembed.mov') {
        embedUrl = `${provider.movie}${movieId}&s=tmdb`;
      } else {
        embedUrl = `${provider.movie}${movieId}`;
      }
    }
  }
  
  console.log(`Built URL for ${providerName}:`, embedUrl);
  return embedUrl;
}

// Try multiple URL patterns for a provider
async function tryProviderPatterns(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) return null;
  
  const patterns = [];
  
  // Add main pattern
  if (provider.patterns) {
    const pattern = provider.patterns[type];
    if (pattern) {
      let url = pattern
        .replace('{id}', movieId)
        .replace('{type}', type)
        .replace('{season}', season || '1')
        .replace('{episode}', episode || '1');
      patterns.push(url);
    }
  }
  
  // Add fallback patterns
  if (provider.fallbacks) {
    provider.fallbacks.forEach(fallback => {
      const url = fallback
        .replace('{id}', movieId)
        .replace('{type}', type)
        .replace('{season}', season || '1')
        .replace('{episode}', episode || '1');
      patterns.push(url);
    });
  }
  
  // Test each pattern
  for (const url of patterns) {
    const proxiedUrl = `${WORKER_URL}/?url=${encodeURIComponent(url)}`;
    const isPlayable = await checkPlayable(proxiedUrl);
    if (isPlayable) {
      console.log(`Found working pattern for ${providerName}:`, url);
      return url;
    }
  }
  
  return null;
}

// Helper to build a player page URL
function buildPageUrl(providerName) {
  const params = new URLSearchParams();
  if (movieId) params.set('id', movieId);
  if (type) params.set('type', type);
  if (season) params.set('season', season);
  if (episode) params.set('episode', episode);
  if (providerName) params.set('provider', providerName);
  return `${window.location.pathname}?${params.toString()}`;
}

async function checkPlayable(url) {
  try {
    const controller = new AbortController();
    playableCheckTimeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(url, { 
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://vidsrc.to/'
      }
    });
    
    clearTimeout(playableCheckTimeout);
    
    if (!res.ok) {
      console.log(`HTTP ${res.status} for URL`);
      return false;
    }
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('video/')) {
      console.log('Not HTML or video content:', contentType);
      return false;
    }
    
    const text = await res.text();
    
    // Check for error indicators
    const errorIndicators = [
      '404', 'Not Found', 'error', 'failed', 'unavailable',
      'not available', 'this video', 'removed', 'copyright'
    ];
    
    const hasError = errorIndicators.some(error => 
      text.toLowerCase().includes(error.toLowerCase())
    );
    
    // Check for video/success indicators
    const successIndicators = [
      '<video', '<iframe', 'player', 'streaming',
      'source', 'src=', 'mp4', 'm3u8', 'dash'
    ];
    
    const hasSuccess = successIndicators.some(success => 
      text.toLowerCase().includes(success.toLowerCase())
    );
    
    const isValid = text.length > 300 && 
                    !hasError && 
                    (hasSuccess || contentType.includes('video/'));
    
    console.log(`URL check: ${isValid ? 'VALID' : 'INVALID'}, length: ${text.length}, hasError: ${hasError}, hasSuccess: ${hasSuccess}`);
    return isValid;
    
  } catch (e) {
    console.warn('Check failed:', e.message);
    clearTimeout(playableCheckTimeout);
    return false;
  }
}

function setLoading(isLoading) {
  if (loadingElement) {
    loadingElement.style.display = isLoading ? 'flex' : 'none';
  }
}

function showError(msg) {
  if (errorElement && errorMessage) {
    errorMessage.textContent = msg || 'Player failed to load. Try another provider.';
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

function mountIframe(url) {
  if (!playerContainer) return;
  
  playerContainer.innerHTML = '';
  const iframe = document.createElement('iframe');
  
  // Route through proxy for ad blocking
  const proxiedUrl = `${WORKER_URL}/?url=${encodeURIComponent(url)}`;
  iframe.src = proxiedUrl;
  
  iframe.allowFullscreen = true;
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-top-navigation allow-pointer-lock allow-presentation');
  iframe.style.border = 'none';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.backgroundColor = '#000';
  
  playerContainer.appendChild(iframe);
  currentIframe = iframe;
  
  // Show playback controls if they exist
  if (playbackControls) {
    playbackControls.style.display = 'flex';
  }
  
  hideError();
  
  // Add event listeners for iframe load
  iframe.addEventListener('load', () => {
    console.log('Iframe loaded successfully from:', url);
  });
  
  iframe.addEventListener('error', () => {
    console.error('Iframe failed to load from:', url);
    showError('Video failed to load. Please try another provider.');
  });
}

// External controls with better iframe communication
function setupExternalControls() {
  // Play/Pause functionality
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (currentIframe && currentIframe.contentWindow) {
        try {
          const isPaused = !playPauseBtn.classList.contains('playing');
          
          // Send play/pause command to iframe
          currentIframe.contentWindow.postMessage({
            type: 'CONTROL',
            action: isPaused ? 'play' : 'pause'
          }, '*');
          
          // Toggle button state
          playPauseBtn.classList.toggle('playing');
          const icon = playPauseBtn.querySelector('.icon') || playPauseBtn;
          icon.textContent = isPaused ? '⏸' : '▶';
          
        } catch (e) {
          console.log('Could not control iframe:', e);
          // Fallback: try to play/pause via iframe click
          try {
            currentIframe.contentWindow.document.querySelector('video').play();
          } catch (e2) {
            console.log('Fallback also failed');
          }
        }
      }
    });
  }

  // Volume control
  if (volumeBar) {
    volumeBar.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      if (currentIframe && currentIframe.contentWindow) {
        try {
          currentIframe.contentWindow.postMessage({
            type: 'CONTROL',
            action: 'volume',
            value: volume
          }, '*');
        } catch (e) {
          console.log('Volume control not available');
        }
      }
    });
  }

  // Speed control
  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      const speed = parseFloat(e.target.value);
      if (currentIframe && currentIframe.contentWindow) {
        try {
          currentIframe.contentWindow.postMessage({
            type: 'CONTROL',
            action: 'speed',
            value: speed
          }, '*');
        } catch (e) {
          console.log('Speed control not available');
        }
      }
    });
  }

  // Fullscreen
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      const elem = playerContainer || document.documentElement;
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
          });
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });
  }
}

async function autoPickAndPlay() {
  setLoading(true);
  hideError();
  
  // Try providers in this order
  const order = ['vidsrc.to', 'vidsrc.icu', '2embed.org', 'vidlink.pro', 'multiembed.mov'];
  
  for (const providerName of order) {
    console.log(`\n=== Trying provider: ${providerName} ===`);
    
    // Try multiple patterns for this provider
    const workingUrl = await tryProviderPatterns(providerName);
    
    if (workingUrl) {
      console.log(`✓ ${providerName} is working with URL:`, workingUrl);
      mountIframe(workingUrl);
      setupExternalControls();
      
      // Update active button
      document.querySelectorAll('.provider-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.provider === providerName) {
          b.classList.add('active');
        }
      });
      
      setLoading(false);
      return;
    } else {
      console.log(`✗ ${providerName} not working`);
    }
  }
  
  setLoading(false);
  showError('No working provider found. Please try refreshing or check back later.');
}

async function playWithProvider(providerName) {
  setLoading(true);
  hideError();
  
  console.log(`\n=== Manually trying provider: ${providerName} ===`);
  
  // Try multiple patterns for this provider
  const workingUrl = await tryProviderPatterns(providerName);
  
  if (!workingUrl) {
    setLoading(false);
    showError(`${providerName} is currently unavailable. Try another provider.`);
    return;
  }
  
  mountIframe(workingUrl);
  setupExternalControls();
  setLoading(false);
}

function wireProviderButtons() {
  document.querySelectorAll('.provider-btn').forEach(btn => {
    const providerName = btn.dataset.provider;
    
    // Set href for sharing
    try {
      btn.href = buildPageUrl(providerName);
    } catch (e) {
      btn.setAttribute('href', '#');
    }

    // Handle clicks
    btn.addEventListener('click', async (event) => {
      const isPrimary = event.button === 0;
      const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

      if (!isPrimary || hasModifier) {
        // Let browser handle navigation (open in new tab/window)
        return;
      }

      event.preventDefault();

      // Update active class
      document.querySelectorAll('.provider-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('loading');
      });
      
      btn.classList.add('active');
      btn.classList.add('loading');

      if (providerName === 'auto') {
        autoPickAndPlay();
      } else {
        playWithProvider(providerName);
      }
      
      // Remove loading class after a delay
      setTimeout(() => {
        btn.classList.remove('loading');
      }, 2000);
    });
  });
}

async function loadBasicInfo() {
  if (!movieInfo) return;
  
  try {
    const endpoint = type === 'tv' ? `tv/${movieId}` : `movie/${movieId}`;
    const url = `${WORKER_URL}/?endpoint=${endpoint}&language=en-US`;
    const res = await fetch(url);
    
    if (!res.ok) throw new Error('Failed to fetch movie info');
    
    const data = await res.json();
    const title = data.title || data.name || 'Untitled';
    const overview = data.overview || 'No description available.';
    
    // Add season/episode info for TV shows
    let extraInfo = '';
    if (type === 'tv') {
      if (season) extraInfo += ` | Season ${season}`;
      if (episode) extraInfo += ` Episode ${episode}`;
    }
    
    movieInfo.innerHTML = `
      <h2>${title}${extraInfo}</h2>
      <p>${overview}</p>
      ${data.vote_average ? `<p class="rating">⭐ ${data.vote_average.toFixed(1)}/10</p>` : ''}
      ${data.release_date ? `<p class="year">📅 ${data.release_date.substring(0,4)}</p>` : ''}
    `;
  } catch (e) {
    console.error('Info load failed:', e);
    movieInfo.innerHTML = `
      <h2>${type === 'tv' ? 'TV Show' : 'Movie'}</h2>
      <p>Playing content...</p>
    `;
  }
}

function retry() {
  const active = document.querySelector('.provider-btn.active');
  const providerName = active?.dataset.provider || 'auto';
  if (providerName === 'auto') {
    autoPickAndPlay();
  } else {
    playWithProvider(providerName);
  }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Check for required elements
  if (!playerContainer) {
    console.error('Player container not found');
    return;
  }
  
  if (!movieId) {
    showError('Missing movie ID. Please go back and select a movie.');
    return;
  }
  
  // Setup error close button
  const errorCloseBtn = errorElement?.querySelector('.error-close');
  if (errorCloseBtn) {
    errorCloseBtn.addEventListener('click', hideError);
  }
  
  // Setup retry button
  const retryBtn = errorElement?.querySelector('.retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', retry);
  }
  
  // Load movie info
  await loadBasicInfo();
  
  // Wire up provider buttons
  wireProviderButtons();
  
  // Start with initial provider
  if (initialProvider === 'auto') {
    autoPickAndPlay();
  } else if (PROVIDERS[initialProvider]) {
    // Activate the correct provider button
    const currentBtn = document.querySelector(`.provider-btn[data-provider="${initialProvider}"]`);
    if (currentBtn) {
      document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('active'));
      currentBtn.classList.add('active');
      playWithProvider(initialProvider);
    } else {
      autoPickAndPlay();
    }
  } else {
    autoPickAndPlay();
  }
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
      case ' ': // Space to play/pause
      case 'k':
        e.preventDefault();
        if (playPauseBtn) playPauseBtn.click();
        break;
      case 'f':
        e.preventDefault();
        if (fullscreenBtn) fullscreenBtn.click();
        break;
      case 'm':
        e.preventDefault();
        if (volumeBtn) {
          volumeBtn.click();
          if (volumeBar) {
            const currentVolume = parseInt(volumeBar.value);
            volumeBar.value = currentVolume === 0 ? 100 : 0;
            volumeBar.dispatchEvent(new Event('input'));
          }
        }
        break;
      case 'escape':
        if (errorElement.style.display === 'flex') {
          hideError();
        }
        break;
      case 'arrowright':
        e.preventDefault();
        // Seek forward 10 seconds
        if (currentIframe && currentIframe.contentWindow) {
          try {
            currentIframe.contentWindow.postMessage({
              type: 'CONTROL',
              action: 'seek',
              value: 10
            }, '*');
          } catch (e) {
            console.log('Seek forward not available');
          }
        }
        break;
      case 'arrowleft':
        e.preventDefault();
        // Seek backward 10 seconds
        if (currentIframe && currentIframe.contentWindow) {
          try {
            currentIframe.contentWindow.postMessage({
              type: 'CONTROL',
              action: 'seek',
              value: -10
            }, '*');
          } catch (e) {
            console.log('Seek backward not available');
          }
        }
        break;
    }
  });
  
  // Handle fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    if (fullscreenBtn) {
      const icon = fullscreenBtn.querySelector('.icon') || fullscreenBtn;
      if (document.fullscreenElement) {
        icon.textContent = '⛶'; // Exit fullscreen icon
        fullscreenBtn.title = 'Exit fullscreen';
      } else {
        icon.textContent = '⛶'; // Enter fullscreen icon
        fullscreenBtn.title = 'Enter fullscreen';
      }
    }
  });
});

// Cleanup timeouts when leaving page
window.addEventListener('beforeunload', () => {
  if (playableCheckTimeout) {
    clearTimeout(playableCheckTimeout);
  }
});

// Listen for messages from iframe (for playback status updates)
window.addEventListener('message', (event) => {
  // Always verify the origin if possible
  // For now, we'll accept all for simplicity
  
  const data = event.data;
  if (data && data.type === 'PLAYBACK_STATUS') {
    // Update UI based on iframe playback status
    if (playPauseBtn && data.isPlaying !== undefined) {
      playPauseBtn.classList.toggle('playing', data.isPlaying);
      const icon = playPauseBtn.querySelector('.icon') || playPauseBtn;
      icon.textContent = data.isPlaying ? '⏸' : '▶';
    }
    
    if (currentTimeEl && data.currentTime) {
      currentTimeEl.textContent = formatTime(data.currentTime);
    }
    
    if (totalTimeEl && data.duration) {
      totalTimeEl.textContent = formatTime(data.duration);
    }
    
    if (progressBar && data.currentTime && data.duration) {
      const progress = (data.currentTime / data.duration) * 100;
      progressBar.value = progress;
    }
  }
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}