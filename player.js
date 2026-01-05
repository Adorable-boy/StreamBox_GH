const WORKER_URL = "https://streambox-api.bpvw7gw5zw.workers.dev";

const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');
const type = urlParams.get('type') || 'movie';
const season = urlParams.get('season') || '1';
const episode = urlParams.get('episode') || '1';
const initialProvider = urlParams.get('provider') || 'auto';

let currentIframe = null;
let playableCheckTimeout;
let currentProvider = initialProvider;

// Updated PROVIDERS with working URLs (2024)
const PROVIDERS = {
  'auto': {
    name: 'Auto (Best)',
    icon: '🔄',
    testUrl: null
  },
  'vidsrc.to': {
    name: 'VidSrc.to',
    icon: '🎬',
    patterns: {
      movie: 'https://vidsrc.to/embed/movie/{id}',
      tv: 'https://vidsrc.to/embed/tv/{id}/{season}/{episode}'
    }
  },
  'vidsrc.icu': {
    name: 'VidSrc.icu',
    icon: '🏥',
    patterns: {
      movie: 'https://vidsrc.icu/embed/movie/{id}',
      tv: 'https://vidsrc.icu/embed/tv/{id}/{season}/{episode}'
    }
  },
  '2embed.org': {
    name: '2Embed',
    icon: '📺',
    patterns: {
      movie: 'https://2embed.org/embed/movie/{id}',
      tv: 'https://2embed.org/embed/tv/{id}/{season}/{episode}'
    }
  },
  'vidsrc.pro': {
    name: 'VidSrc.pro',
    icon: '🎥',
    patterns: {
      movie: 'https://vidsrc.pro/embed/movie/{id}',
      tv: 'https://vidsrc.pro/embed/tv/{id}/{season}/{episode}'
    }
  },
  'vidsrc.cc': {
    name: 'VidSrc.cc',
    icon: '🔗',
    patterns: {
      movie: 'https://vidsrc.cc/embed/movie/{id}',
      tv: 'https://vidsrc.cc/embed/tv/{id}/{season}/{episode}'
    }
  },
  'vidlink.pro': {
    name: 'VidLink',
    icon: '🔗',
    patterns: {
      movie: 'https://vidlink.pro/movie/{id}',
      tv: 'https://vidlink.pro/tv/{id}'
    },
    urlBuilder: function(type, id, season, episode) {
      if (type === 'tv') {
        return `https://vidlink.pro/tv/${id}?s=${season}&e=${episode}`;
      }
      return `https://vidlink.pro/movie/${id}`;
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
const providerButtonsContainer = document.querySelector('.provider-buttons');

function goBack() {
  if (document.referrer) {
    history.back();
  } else {
    window.location.href = 'moviedetails.html?id=' + movieId;
  }
}

// Simple URL builder - no complex pattern matching
function buildEmbedUrl(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider || providerName === 'auto') return null;
  
  let embedUrl = '';
  
  // Use custom URL builder if available
  if (provider.urlBuilder) {
    embedUrl = provider.urlBuilder(type, movieId, season, episode);
  } else {
    // Standard URL building
    if (type === 'tv') {
      embedUrl = `https://vidsrc.to/embed/tv/${movieId}/${season}/${episode}`;
    } else {
      embedUrl = `https://vidsrc.to/embed/movie/${movieId}`;
    }
  }
  
  console.log(`Built URL for ${providerName}:`, embedUrl);
  return embedUrl;
}

// Simple test if URL is accessible
async function testUrl(url) {
  try {
    const controller = new AbortController();
    playableCheckTimeout = setTimeout(() => controller.abort(), 5000);
    
    // Test with HEAD request first (faster)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(playableCheckTimeout);
    
    if (response.ok) {
      return true;
    }
    
    // If HEAD fails, try GET with limited data
    const getResponse = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return getResponse.ok;
    
  } catch (error) {
    console.warn('URL test failed:', error.message);
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

// Direct iframe mounting without worker for better compatibility
function mountIframe(directUrl, providerName) {
  if (!playerContainer) return;
  
  playerContainer.innerHTML = '';
  
  const iframe = document.createElement('iframe');
  iframe.src = directUrl;
  iframe.allowFullscreen = true;
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope');
  iframe.style.border = 'none';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.backgroundColor = '#000';
  iframe.referrerPolicy = 'no-referrer';
  
  playerContainer.appendChild(iframe);
  currentIframe = iframe;
  currentProvider = providerName;
  
  // Hide loading and error
  setLoading(false);
  hideError();
  
  // Show controls after a delay
  setTimeout(() => {
    if (playbackControls) {
      playbackControls.style.display = 'flex';
    }
  }, 1000);
  
  // Event listeners
  iframe.addEventListener('load', () => {
    console.log(`✅ ${providerName} iframe loaded successfully`);
  });
  
  iframe.addEventListener('error', (e) => {
    console.error(`❌ ${providerName} iframe failed:`, e);
    showError(`Failed to load from ${providerName}. Trying next source...`);
    autoPickAndPlay();
  });
}

// Try multiple providers in sequence
async function autoPickAndPlay() {
  setLoading(true);
  hideError();
  
  console.log('Starting auto provider selection...');
  
  // List of providers to try (in order of reliability)
  const providersToTry = [
    'vidsrc.to',
    'vidsrc.icu', 
    '2embed.org',
    'vidsrc.pro',
    'vidsrc.cc',
    'vidlink.pro'
  ];
  
  for (const providerName of providersToTry) {
    console.log(`Trying ${providerName}...`);
    
    let directUrl;
    
    if (type === 'tv') {
      if (providerName === 'vidlink.pro') {
        directUrl = `https://vidlink.pro/tv/${movieId}?s=${season}&e=${episode}`;
      } else if (providerName === '2embed.org') {
        directUrl = `https://2embed.org/embed/tv?id=${movieId}&s=${season}&e=${episode}`;
      } else {
        directUrl = `https://${providerName.replace('vidsrc.', 'vidsrc.')}/embed/tv/${movieId}/${season}/${episode}`;
      }
    } else {
      if (providerName === 'vidlink.pro') {
        directUrl = `https://vidlink.pro/movie/${movieId}`;
      } else if (providerName === '2embed.org') {
        directUrl = `https://2embed.org/embed/movie?id=${movieId}`;
      } else {
        directUrl = `https://${providerName.replace('vidsrc.', 'vidsrc.')}/embed/movie/${movieId}`;
      }
    }
    
    console.log(`Testing URL: ${directUrl}`);
    
    try {
      // Skip testing for now and just try to load
      // Testing causes CORS issues sometimes
      mountIframe(directUrl, providerName);
      
      // Update active button
      updateActiveProviderButton(providerName);
      
      // Break out of loop - we found a working provider
      return;
      
    } catch (error) {
      console.warn(`${providerName} failed:`, error.message);
      continue;
    }
  }
  
  // If all providers failed
  setLoading(false);
  showError('All sources failed. Please check the movie ID or try again later.');
  console.error('All providers failed');
}

// Update the active provider button
function updateActiveProviderButton(providerName) {
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.provider === providerName) {
      btn.classList.add('active');
    }
  });
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
      const title = data.title || data.name || 'Unknown Title';
      const overview = data.overview || 'No description available.';
      const year = data.release_date ? data.release_date.substring(0,4) : '';
      const rating = data.vote_average ? data.vote_average.toFixed(1) : '';
      
      movieInfo.innerHTML = `
        <h2>${title} ${year ? `(${year})` : ''}</h2>
        ${rating ? `<p class="rating">⭐ ${rating}/10</p>` : ''}
        <p>${overview}</p>
        ${type === 'tv' ? `<p class="episode-info">Season ${season}, Episode ${episode}</p>` : ''}
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

// Create provider buttons
function createProviderButtons() {
  if (!providerButtonsContainer) return;
  
  providerButtonsContainer.innerHTML = '';
  
  // Create auto button
  const autoBtn = document.createElement('button');
  autoBtn.className = 'provider-btn';
  if (currentProvider === 'auto') autoBtn.classList.add('active');
  autoBtn.dataset.provider = 'auto';
  autoBtn.innerHTML = '🔄 Auto (Best)';
  autoBtn.addEventListener('click', () => {
    currentProvider = 'auto';
    updateActiveProviderButton('auto');
    autoPickAndPlay();
  });
  providerButtonsContainer.appendChild(autoBtn);
  
  // Create provider buttons
  Object.keys(PROVIDERS).forEach(providerKey => {
    if (providerKey === 'auto') return;
    
    const provider = PROVIDERS[providerKey];
    const btn = document.createElement('button');
    btn.className = 'provider-btn';
    if (currentProvider === providerKey) btn.classList.add('active');
    btn.dataset.provider = providerKey;
    btn.innerHTML = `${provider.icon || '🎬'} ${provider.name}`;
    
    btn.addEventListener('click', async () => {
      currentProvider = providerKey;
      updateActiveProviderButton(providerKey);
      
      setLoading(true);
      hideError();
      
      let directUrl;
      
      if (type === 'tv') {
        if (providerKey === 'vidlink.pro') {
          directUrl = `https://vidlink.pro/tv/${movieId}?s=${season}&e=${episode}`;
        } else if (providerKey === '2embed.org') {
          directUrl = `https://2embed.org/embed/tv?id=${movieId}&s=${season}&e=${episode}`;
        } else {
          directUrl = `https://${providerKey.replace('vidsrc.', 'vidsrc.')}/embed/tv/${movieId}/${season}/${episode}`;
        }
      } else {
        if (providerKey === 'vidlink.pro') {
          directUrl = `https://vidlink.pro/movie/${movieId}`;
        } else if (providerKey === '2embed.org') {
          directUrl = `https://2embed.org/embed/movie?id=${movieId}`;
        } else {
          directUrl = `https://${providerKey.replace('vidsrc.', 'vidsrc.')}/embed/movie/${movieId}`;
        }
      }
      
      mountIframe(directUrl, providerKey);
    });
    
    providerButtonsContainer.appendChild(btn);
  });
}

function retry() {
  hideError();
  if (currentProvider === 'auto') {
    autoPickAndPlay();
  } else {
    // Retry current provider
    document.querySelector(`.provider-btn[data-provider="${currentProvider}"]`).click();
  }
}

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Player initializing...');
  
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
  
  // Start playing
  if (initialProvider === 'auto') {
    autoPickAndPlay();
  } else {
    // Manually trigger click on the selected provider button
    const providerBtn = document.querySelector(`.provider-btn[data-provider="${initialProvider}"]`);
    if (providerBtn) {
      providerBtn.click();
    } else {
      autoPickAndPlay();
    }
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
      case 'escape':
        if (errorElement.style.display === 'flex') {
          hideError();
        }
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
    }
  });
});

// Cleanup
window.addEventListener('beforeunload', () => {
  if (playableCheckTimeout) {
    clearTimeout(playableCheckTimeout);
  }
});