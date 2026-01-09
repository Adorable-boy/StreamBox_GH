// Configuration
const IMAGE_URL = 'https://image.tmdb.org/t/p/w780'; // Landscape images

// Main container
const mainContainer = document.getElementById('newandrich');

// Load movies when page opens
window.onload = function() {
    loadComingSoonMovies();
};

// 1. Fetch movies from TMDB
async function loadComingSoonMovies() {
    // Show loading
    mainContainer.innerHTML = '<div class="loading">Loading movies...</div>';
    
    try {
        // Fetch data from TMDB
        const response = await fetch(`https://streamboxweb-api.bpvw7gw5zw.workers.dev/?endpoint=movie/upcoming&language=en-US&page=${Math.floor(Math.random() * 5) + 1}`);
        const data = await response.json();
        
        // Clear loading
        mainContainer.innerHTML = '';
        
        // Add section title
        const title = document.createElement('h2');
        title.className = 'section-title';
        title.textContent = 'COMING SOON & TRENDING ';
        mainContainer.appendChild(title);
        
        // Create grid container
        const grid = document.createElement('div');
        grid.className = 'movie-grid';
        mainContainer.appendChild(grid);
        
        // Get first 9 movies (3 rows of 3)
        const movies = data.results.slice(0, 9);
        
        // Create a movie card for each
        movies.forEach(movie => {
            const card = createMovieCard(movie);
            grid.appendChild(card);
        });
        
    } catch (error) {
        console.log('Error loading movies:', error);
        showError();
    }
}

// 2. Create one movie card
function createMovieCard(movie) {
    // Create card container
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    // Create image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'movie-image-container';
    
    // Create image
    const img = document.createElement('img');
    img.className = 'movie-image';
    img.alt = movie.title;
    
    // Use backdrop image if available (landscape), otherwise poster
    if (movie.backdrop_path) {
        img.src = IMAGE_URL + movie.backdrop_path;
    } else if (movie.poster_path) {
        img.src = 'https://image.tmdb.org/t/p/w500' + movie.poster_path;
    } else {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23222"/><text x="150" y="100" text-anchor="middle" fill="%23fff" font-family="Arial">No Image</text></svg>';
    }
    
    imageContainer.appendChild(img);
    
    // Create overlay (ALWAYS VISIBLE)
    const overlay = document.createElement('div');
    overlay.className = 'movie-overlay';
    
    // Movie title
    const title = document.createElement('h3');
    title.className = 'movie-name';
    title.textContent = movie.title || 'Unknown Movie';
    
    // Meta info container
    const meta = document.createElement('div');
    meta.className = 'movie-meta';
    
    // Year
    const year = document.createElement('span');
    year.className = 'movie-year';
    year.textContent = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
    
    // Rating
    const rating = document.createElement('span');
    rating.className = 'movie-rating';
    rating.innerHTML = `⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}`;
    
    meta.appendChild(year);
    meta.appendChild(rating);
    
    // Description
    const description = document.createElement('p');
    description.className = 'movie-description';
    description.textContent = movie.overview 
        ? (movie.overview.length > 120 ? movie.overview.substring(0, 120) + '...' : movie.overview)
        : '';
    
    // Add to List button
    const addButton = document.createElement('button');
    addButton.className = 'add-to-list-btn';
    addButton.dataset.movieId = movie.id;
    
    // Check if already in list
    const myList = getMyList();
    const isInList = myList.some(item => item.id === movie.id);
    
    if (isInList) {
        addButton.textContent = '✓ In Your List';
        addButton.classList.add('added');
    } else {
        addButton.textContent = '+ Add To List';
    }
    
    // Add click event
    addButton.onclick = function() {
        toggleMovieInList(movie, addButton);
    };
    
    // Add everything to overlay
    overlay.appendChild(title);
    overlay.appendChild(meta);
    overlay.appendChild(description);
    overlay.appendChild(addButton);
    
    // Add everything to card
    card.appendChild(imageContainer);
    card.appendChild(overlay);
    
    return card;
}

// 3. Get my list from localStorage
function getMyList() {
    const list = localStorage.getItem('myList');
    return list ? JSON.parse(list) : [];
}

// 4. Save my list to localStorage
function saveMyList(list) {
    localStorage.setItem('myList', JSON.stringify(list));
}

// 5. Add or remove movie from list
function toggleMovieInList(movie, button) {
    let myList = getMyList();
    const movieIndex = myList.findIndex(item => item.id === movie.id);
    
    if (movieIndex === -1) {
        // Add to list
        const movieToAdd = {
            id: movie.id,
            title: movie.title,
            poster: movie.poster_path,
            backdrop: movie.backdrop_path,
            year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A',
            addedDate: new Date().toISOString()
        };
        
        myList.push(movieToAdd);
        button.textContent = '✓ In Your List';
        button.classList.add('added');
        
        // Show notification
        showNotification(`Added "${movie.title}" to your list`);
    } else {
        // Remove from list
        myList.splice(movieIndex, 1);
        button.textContent = '+ Add To List';
        button.classList.remove('added');
        
        // Show notification
        showNotification(`Removed "${movie.title}" from your list`);
    }
    
    // Save updated list
    saveMyList(myList);
    
    // Update all buttons for this movie
    updateAllButtonsForMovie(movie.id, movieIndex === -1);
}

// 6. Update all buttons for a specific movie
function updateAllButtonsForMovie(movieId, isAdded) {
    const buttons = document.querySelectorAll(`[data-movie-id="${movieId}"]`);
    
    buttons.forEach(button => {
        if (isAdded) {
            button.textContent = '✓ In Your List';
            button.classList.add('added');
        } else {
            button.textContent = '+ Add To List';
            button.classList.remove('added');
        }
    });
}

// 7. Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(236, 27, 76, 1);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 8. Show error message
function showError() {
    mainContainer.innerHTML = `
        <div class="error-message">
            <p>Failed to load movies. Please check your internet connection.</p>
            <button onclick="loadComingSoonMovies()" style="
                margin-top: 20px;
                padding: 10px 20px;
                background: rgb(255, 0, 60);
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: bold;
                cursor: pointer;
            ">
                Try Again
            </button>
        </div>
    `;
}

// Add animation styles
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(animationStyles);