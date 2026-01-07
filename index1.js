





let allMovies = [];



// Inline placeholder (small gray poster SVG) — no extra files needed
const SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">
  <rect width="100%" height="100%" fill="#ddd"/>
  <text x="50%" y="50%" font-size="20" fill="#888" text-anchor="middle" dominant-baseline="middle">no image</text>
</svg>`;
const PLACEHOLDER_POSTER = 'data:image/svg+xml;utf8,' + encodeURIComponent(SVG_STRING);

// Simple localStorage cache for JSON responses
function fetchWithCache(url, key) {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      return Promise.resolve(JSON.parse(cached));
    }
  } catch (_) {}
  return fetch(url)
    .then(r => r.json())
    .then(data => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (_) {}
      return data;
    });
}


window.addEventListener("load", () => {
  const loginBox = document.querySelector(".login");
  if (!loginBox) return;
  loginBox.style.opacity = "0.01";
  loginBox.style.transform = "scale(0.5) rotateX(30deg)";

  setTimeout(() => {
    loginBox.style.transition = "all 0.9s cubic-bezier(0.25, 1, 0.5, 1)";
    loginBox.style.opacity = "1";
    loginBox.style.transform = "scale(1)";
  }, 300); 
});


 


// FIXED: Load TopPicks movies correctly

let topPicksContainers = document.querySelectorAll("#TopPicks, #TopPicks2, #TopPicks3, #TopPicks4, #TopPicks5, #TopPicks6, #TopPicks7, #TopPicks8, #TopPicks9, #TopPicks10, #TopPicks11, #TopPicks12, #TopPicks13, #TopPicks14, #TopPicks15, #TopPicks16, #TopPicks17, #TopPicks18, #TopPicks19, #TopPicks20, #TopPicks21, #TopPicks22, #TopPicks23, #TopPicks24, #TopPicks25, #TopPicks26, #TopPicks27, #TopPicks28, #TopPicks29, #TopPicks30, #TopPicks31, #TopPicks32, #TopPicks33");

async function loadTopPicks() {
    try {
        const fetchPromises = [];
        // Reduced from 500 to 33 to match the number of TopPicks containers (TopPicks to TopPicks33)
        // This significantly improves load time and reduces API spam.
        for (let i = 1; i <= 33; i++) {
            const url = `https://streamboxweb-api.bpvw7gw5zw.workers.dev/?endpoint=movie/popular&language=en-US&page=${i}`;
            fetchPromises.push(fetchWithCache(url, `popular_page_${i}`));
        }
        const responses = await Promise.all(fetchPromises);
        return responses;
    } catch (error) {
        console.error("Error loading TopPicks:", error);
        return [];
    }
}



    // Helper function to map TMDB movie/TV show to our format
    function mapTMDBMovie(tmdbMovie) {
        return {
            id: tmdbMovie.id,
            name: tmdbMovie.title || tmdbMovie.original_title || tmdbMovie.name || tmdbMovie.original_name,
            title: tmdbMovie.name || tmdbMovie.original_title || tmdbMovie.title || tmdbMovie.original_name,
            poster: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : '',
            description: tmdbMovie.overview,
            year: tmdbMovie.release_date ? tmdbMovie.release_date.substring(0, 4) : (tmdbMovie.first_air_date ? tmdbMovie.first_air_date.substring(0, 4) : ""),
            rating: tmdbMovie.vote_average,
            alt: tmdbMovie.title || tmdbMovie.name,
            source: 'toppicks'
        };
    }

    loadTopPicks().then(dataArray => {
        const topPickIds = ["TopPicks", "TopPicks2", "TopPicks3", "TopPicks4", "TopPicks5", "TopPicks6", "TopPicks7", "TopPicks8", "TopPicks9", "TopPicks10", "TopPicks11", "TopPicks12", "TopPicks13", "TopPicks14", "TopPicks15", "TopPicks16", "TopPicks17", "TopPicks18", "TopPicks19", "TopPicks20", "TopPicks21", "TopPicks22", "TopPicks23", "TopPicks24", "TopPicks25", "TopPicks26", "TopPicks27", "TopPicks28", "TopPicks29", "TopPicks30", "TopPicks31", "TopPicks32", "TopPicks33"];

        let allTopPicksMovies = [];

        dataArray.forEach((data, index) => {
            const movies = data.results || [];
            const mappedMovies = movies.map(m => ({ ...mapTMDBMovie(m), source: 'toppicks' }));
            allTopPicksMovies = [...allTopPicksMovies, ...mappedMovies];

            const containerId = topPickIds[index];
            const container = document.getElementById(containerId);

            if (container) {
                const shuffled = [...mappedMovies].sort(() => Math.random() - 0.5);
                shuffled.slice(0, 30).forEach(movie => {
                    if (movie.poster) addMovie(movie, container);
                    if (!movie.poster) addMovieAlt(movie, container);
                });
            }
        });



        // Add to allMovies for search
        if (allTopPicksMovies.length > 0) {
            if (allMovies.length === 0) {
                allMovies = allTopPicksMovies;
            } else {
                allMovies = [...allMovies, ...allTopPicksMovies];
            }
        }


        // Start background fetch for remaining movies (pages 34-500)
        loadRemainingMovies();
        loadRemainingTvShows();

    });







    async function loadRemainingMovies() {
        const totalPages = 500;
        const startPage = 1;
        const batchSize = 15; // Fetch 15 pages at a time to keep UI responsive

        for (let i = startPage; i <= totalPages; i += batchSize) {
            const fetchPromises = [];
            const endPage = Math.min(i + batchSize - 1, totalPages);
            
            for (let page = i; page <= endPage; page++) {
                fetchPromises.push(
                    fetch(`https://streamboxweb-api.bpvw7gw5zw.workers.dev/?endpoint=movie/popular&language=en-US&page=${page}`)
                    .then(r => r.json())
                    .catch(e => null)
                );
            }

            try {
                const results = await Promise.all(fetchPromises);
                const newMovies = [];
                results.forEach(data => {
                    if (data && data.results) {
                        data.results.forEach(m => {
                            newMovies.push({ ...mapTMDBMovie(m), source: 'toppicks' });
                        });
                    }
                    
                });

                if (newMovies.length > 0) {
                    allMovies = [...allMovies, ...newMovies];
                }
                
                // Small delay to yield to main thread
                await new Promise(resolve => setTimeout(resolve, 250));
            } catch (error) {
                console.error("Error loading background movies:", error);
            }
        }
    }





   













    async function loadRemainingTvShows() {
        const totalPages = 500;
        const startPage = 1;
        const batchSize = 15; // Fetch 15 pages at a time to keep UI responsive

        for (let i = startPage; i <= totalPages; i += batchSize) {
            const fetchPromises = [];
            const endPage = Math.min(i + batchSize - 1, totalPages);
            
            for (let page = i; page <= endPage; page++) {
                fetchPromises.push(
                    fetch(`https://streamboxweb-api.bpvw7gw5zw.workers.dev/?endpoint=tv/popular&language=en-US&page=${page}`)
                    .then(r => r.json())
                    .catch(e => null)
                );
            }

            try {
                const results = await Promise.all(fetchPromises);
                const newTvShows = [];
                results.forEach(data => {
                    if (data && data.results) {
                        data.results.forEach(m => {
                            newTvShows.push({ ...mapTMDBMovie(m), source: 'tvshows' });
                        });
                    }
                    
                });

                if (newTvShows.length > 0) {
                    allMovies = [...allMovies, ...newTvShows];
                }
                
                // Small delay to yield to main thread
                await new Promise(resolve => setTimeout(resolve, 250));
            } catch (error) {
                console.error("Error loading background movies:", error);
            }
        }
    }













// Robust addMovie: shows tile even if id or poster missing
function addMovie(movie, container) {
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";


    const link = document.createElement("a");
    // Ensure movie.id exists before creating link
    
    link.href = `moviedetails.html?id=${movie.id}`;
    
    const img = document.createElement("img");
    img.src = movie.poster || PLACEHOLDER_POSTER;
    img.alt = PLACEHOLDER_POSTER;
    img.loading = "lazy";
    img.decoding = "async";

    let title = document.createElement("p");
    title.innerText = movie.name || movie.title;
    title.className = "movie-title";
    posterWrapper.style.display = "flex"
    posterWrapper.style.flexDirection = "column"
    if(!movie.title && !movie.name) {
        posterWrapper.style.marginBottom = "30px";
    };

    link.appendChild(img); 
    posterWrapper.appendChild(link);
    posterWrapper.appendChild(title)
    container.appendChild(posterWrapper);
   
};









function addMovieAlt(movie, container) {
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";


    const link = document.createElement("a");
    // Ensure movie.id exists before creating link
    
    link.href = `moviedetails.html?id=${movie.id}`;
    
    const img = document.createElement("img");
    img.src = PLACEHOLDER_POSTER;
    img.alt = movie.name || movie.title || "Untitled";
    img.loading = "lazy";
    img.decoding = "async";
    

    let title = document.createElement("p");
    title.innerText = movie.name || movie.title || "Untitled";
    title.className = "movie-title";
    posterWrapper.style.display = "flex"
    posterWrapper.style.flexDirection = "column"
    if(!movie.title && !movie.name) {
        posterWrapper.style.marginBottom = "30px";
    }; 

    link.appendChild(img);
    posterWrapper.appendChild(link);
    posterWrapper.appendChild(title);
    container.appendChild(posterWrapper);
}




















//MajorPoster
if (document.getElementById("majorposter")) {
    fetch(`https://streamboxweb-api.bpvw7gw5zw.workers.dev/?endpoint=tv/popular&language=en-US&page=4`)
    .then(response => response.json())
    .then(data => {

        const movies = data.results || [];
        
        // Helper function to map YTS API movie to our format
        function mapTMDBMovie(tmdbMovie) {
            return {
                id: tmdbMovie.id,
                name: tmdbMovie.title || tmdbMovie.nametmdb || tmdbMovie.original_title,
                title: tmdbMovie.original_title || tmdbMovie.title || tmdbMovie.name,
                poster: tmdbMovie.poster_path?`https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : '',
                description: tmdbMovie.overview,
                year: tmdbMovie.release_date?tmdbMovie.release_date.substring(0,4) : "",
                rating: tmdbMovie.vote_average,
                runtime: null,
                gener: tmdbMovie.genre_ids || [],
                genres: [],
                alt:tmdbMovie.title,
                show:`https://vidsrc.icu/embed/movie/${tmdbMovie.id}`,
                source: 'majorposter'
            
            };
        };
      
        const mappedMovies = movies.map(mapTMDBMovie);
        
        const container = document.getElementById("majorposter");
        
        // Add robin-index class to the container
        container.classList.add("robin-index");
        
        // Randomly shuffle posters
            const shuffled = [...mappedMovies].sort(() => Math.random() - 0.5);
        
        // Adjust number of posters based on screen width
        let numberOfPosters = 3; // Default for large screens
        
        // Function to determine number of posters based on screen width
        function getNumberOfPosters() {
            const screenWidth = window.innerWidth;
            if (screenWidth <= 320) {
                return 0; // Small screens: show 0 poster
            } else if (screenWidth <= 760) {
                return 1; // Medium screens: show 1 posters
            } else if (screenWidth <= 1024) {
                return 2; // Large screens: show 2 posters
            } else if (screenWidth >= 2560) {
                return 5; // Extra large screens: show 5 posters
            } else {
                return 3; // Default: show 3 posters
            }
        }
        
        // Get initial number based on current screen size
        numberOfPosters = getNumberOfPosters();
        
        // Select posters based on screen size
        const selectedPosters = shuffled.slice(0, numberOfPosters);
        
        // Display selected posters initially
        selectedPosters.forEach(movie => {
            if (movie.poster) addMajor(movie, container);
            if (!movie.poster) addMajorAlt(movie, container);
        });
        
        // Handle window resize to adjust posters dynamically
        window.addEventListener('resize', function() {
                const newNumberOfPosters = getNumberOfPosters();
                // Only re-render if the number changed
                if (newNumberOfPosters !== numberOfPosters) {
                    // Clear existing posters but preserve container class
                    container.innerHTML = '';
                    container.classList.add("robin-index");
                    // Reselect and display posters
                    const newSelectedPosters = shuffled.slice(0, newNumberOfPosters);
                    newSelectedPosters.forEach(movie => {
                        if (movie.poster) addMajor(movie, container);
                        if (!movie.poster) addMajorAlt(movie, container);
                    });
                    numberOfPosters = newNumberOfPosters;
                }
           });


        
        // Add TMDB API movies to allMovies for search
        if (mappedMovies && Array.isArray(mappedMovies) && mappedMovies.length > 0) {
            // Initialize or append to allMovies (don't overwrite if local movies were already added)
            if (allMovies.length === 0) {
                allMovies = mappedMovies;
            } else {
                allMovies = [...allMovies, ...mappedMovies];
            }
        }

        
    })
        .catch(error => {
            console.error('Error loading majorposter:', error);
        });
    }
    
    

    
    // Simple add major poster function
    function addMajor(major, container) {
        // Create a wrapper div for each poster and its buttons

        const posterWrapper = document.createElement("div");
        posterWrapper.style.display = "flex";
        posterWrapper.style.flexDirection = "column";
        
        const link = document.createElement("a");
        link.href = `moviedetails.html?id=${major.id}&source=majorposter`;
        

        const img = document.createElement("img");
        img.src = major.poster;


       
        link.appendChild(img);
        posterWrapper.appendChild(link);
        





        
        // Create button group for this poster
        const buttonGroup = document.createElement("div");
        buttonGroup.className = "button-group";
        
        const buttonDiv = document.createElement("div");
        // Make buttonDiv a flex container and add gap between buttons
        buttonDiv.style.display = "flex";
        buttonDiv.style.gap = "10px";
        
        const playLink = document.createElement("a");
        playLink.href = major.show;
        const playButton = document.createElement("button");
        playButton.textContent = "▶ Play";
        playLink.appendChild(playButton);
        
        const addButton = document.createElement("button");
        // Check if movie is already in list and set initial button state
        let myList = JSON.parse(localStorage.getItem("myList")) || [];

        const isInList = myList.some(item => item.id === major.id);

        addButton.textContent = isInList ? "✔︎ Added To List" : "Add To List";

        addButton.setAttribute("data-movie-id", major.id);

        addButton.onclick = function(event) {
            addToList(event, major);
        };


        playLink.addEventListener('click', (event)=>{
         

            const moviedata = {
                id: major.id,
                title: major.title || major.name,
                poster: major.poster,
                source: 'majorposter'
            }
            
            // Get existing continue watching array (or create empty array)
            let continueWatchingList = JSON.parse(localStorage.getItem("continueWatching")) || [];
            
            // Handle old format: if it's a single object, convert to array
            if (continueWatchingList && !Array.isArray(continueWatchingList)) {
                continueWatchingList = [continueWatchingList];
            }
            
            // Ensure it's an array
            if (!Array.isArray(continueWatchingList)) {
                continueWatchingList = [];
            }
            
            // Check if this movie is already in the list
            const existingIndex = continueWatchingList.findIndex(movie => movie.id === major.id);
            
            if (existingIndex !== -1) {
                // Movie already exists - update its timestamp (move to front)
            continueWatchingList.splice(existingIndex, 1); // Remove old entry
            }
            
            // Add new movie to the beginning of the array
            continueWatchingList.unshift(moviedata);
            
            
            // Save the updated array to localStorage
            localStorage.setItem("continueWatching", JSON.stringify(continueWatchingList));

            window.location.href = `moviedetails.html?id=${major.id}&source=majorposter`;

        })

        buttonDiv.appendChild(playLink);
        buttonDiv.appendChild(addButton);
        buttonGroup.appendChild(buttonDiv);
        
        posterWrapper.appendChild(buttonGroup);
        container.appendChild(posterWrapper);
    };
    


    
function addMajorAlt(major, container) {
        // Create a wrapper div for each poster and its buttons
        const posterWrapper = document.createElement("div");
        posterWrapper.style.display = "flex";
        
        const link = document.createElement("a");
        // Ensure movie.id exists before creating link
        const sourceParam = major.source || 'profile';
        link.href = `moviedetails.html?id=${major.id}&source=${sourceParam}`;
        
    const img = document.createElement("img");
    img.src = PLACEHOLDER_POSTER;
    img.alt = PLACEHOLDER_POSTER;
    img.loading = "lazy";
    img.decoding = "async";

        img.style.display ="flex"
        
        link.appendChild(img);
    
        posterWrapper.appendChild(link);
        
        // Create button group for this poster
        const buttonGroup = document.createElement("div");
        buttonGroup.className = "button-group";
        
        const buttonDiv = document.createElement("div");
        
        buttonDiv.style.gap = "10px";
        buttonDiv.style.display = "flex";

        const playLink = document.createElement("a");
        playLink.href = major.show;
        const playButton = document.createElement("button");
        playButton.textContent = "▶ Play";
        playLink.appendChild(playButton);
        
        const addButton = document.createElement("button");
        // Check if movie is already in list and set initial button state
        let myList = JSON.parse(localStorage.getItem("myList")) || [];
        const isInList = myList.some(item => item.id === major.id);
        addButton.textContent = isInList ? "✔︎ Added To List" : "Add To List";
        addButton.setAttribute("data-movie-id", major.id);
        addButton.onclick = function(event) {
            addToList(event, major);
        };
        
        buttonDiv.appendChild(playLink);
        buttonDiv.appendChild(addButton);
        buttonGroup.appendChild(buttonDiv);
        
        posterWrapper.appendChild(buttonGroup);
        container.appendChild(posterWrapper);
    };





// Global function to update all buttons for a specific movie ID
function updateAllButtonsForMovie(movieId, isInList) {
    // Find all buttons with this movie ID across the entire page
    const allButtons = document.querySelectorAll(`[data-movie-id="${movieId}"]`);
    allButtons.forEach(button => {
        button.textContent = isInList ? "✔︎Added To List" : "Add To List";
    });
}





function addToList(event, movie){
    // Prevent default behavior and stop event propagation
    event.preventDefault();
    event.stopPropagation();
    
    // Validate that movie object exists
    if (!movie || !movie.id) {
        console.error("Movie  is missing id");
        return;
    }
    
    // Get the button element (handle case where event.target might be a child element)
    const button = event.target.tagName === 'BUTTON' ? event.target : event.target.closest('button');
    
    if (!button) {
        console.error("Button  not found");
        return;
    }
    
    // Get or initialize the list from localStorage
    let myList = JSON.parse(localStorage.getItem("myList")) || [];
    
    // Check if movie is already in the list
    const isInList = myList.some(item => item.id === movie.id);
    
    if (!isInList) {
        // Add movie to list
        myList.push(movie);
        localStorage.setItem("myList", JSON.stringify(myList));
        // Update all buttons for this movie across the entire page
        updateAllButtonsForMovie(movie.id, true);
    } else {
        // Remove movie from list
        myList = myList.filter(item => item.id !== movie.id);
        localStorage.setItem("myList", JSON.stringify(myList));
        // Update all buttons for this movie across the entire page
        updateAllButtonsForMovie(movie.id, false);
    }
}




// Search functionality
function performSearch(searchQuery) {
    // Get the search input and containers
    const searchResultsSection = document.getElementById("searchResults");
    const searchResultsContainer = document.getElementById("searchResultsContainer");
    const mainSections = document.querySelectorAll("main > section:not(#searchResults), main > div#majorposter");
    
    
    
    // Safety check: ensure required elements exist
    if (!searchResultsSection || !searchResultsContainer) {
        console.error("Search results elements not found");
        return;
    }
    
    // Safety check: ensure allMovies is populated
    if (!allMovies || allMovies.length === 0) {
        console.warn("allMovies array is empty. Movies may still be loading.");
        return;
    }
    
    // Trim whitespace and convert to lowercase for comparison
    const query = searchQuery.trim().toLowerCase();
    
    // If search is empty, show all sections and hide search results
    if (query === "") {
        searchResultsSection.style.display = "none";
        mainSections.forEach(section => {
            if (section) {
                section.style.display = "";
            }
        });
        // Show genre title if it exists
        const genreTitle = document.querySelector(".genre-title");
        if (genreTitle) {
            genreTitle.style.display = "";
        }
        return;
    }
    
    // Filter movies that match the search query
    const matchingMovies = allMovies.filter(movie => {

        const movieTitle = movie.name || movie.original_title  || movie.title;

        // Exact/Partial match
        const titleMatch = typeof movieTitle === "string" && movieTitle.toLowerCase().includes(query);

        // Fuzzy match for title (allows up to 2 typos/differences)
        let fuzzyTitleMatch = false;
        if (!titleMatch && typeof movieTitle === "string" && query.length > 3) {
            const distance = levenshteinDistance(query, movieTitle.toLowerCase());
            const maxErrors = query.length > 6 ? 4 : 3;
            fuzzyTitleMatch = distance <= maxErrors;
        }

        const descMatch = typeof movie.description === "string" && movie.description.toLowerCase().includes(query);

        const genresPool = Array.isArray(movie.genres)
            ? movie.genres
            : Array.isArray(movie.gener)
                ? movie.gener.map(g => (typeof g === "string" ? g : ""))
                : [];
        const genreMatch = Array.isArray(genresPool) && genresPool.some(genre => 
            typeof genre === "string" && genre.toLowerCase().includes(query)
        );
        
        const castMatch = movie.cast && Array.isArray(movie.cast) && movie.cast.some(actor => 
            typeof actor === "string" && actor.toLowerCase().includes(query)
        );
        
        // Search in year
        const yearMatch = movie.year && String(movie.year).includes(query);
        
        // Return true if ANY field matches
        return titleMatch || fuzzyTitleMatch || descMatch || genreMatch || castMatch || yearMatch;

    });
    
    // Hide all regular sections
    mainSections.forEach(section => {
        if (section) {
            section.style.display = "none";
        }
    });
    
    // Hide genre title if it exists
    const genreTitle = document.querySelector(".genre-title");
    if (genreTitle) {
        genreTitle.style.display = "none";
    }
    
    // Clear previous search results
    searchResultsContainer.innerHTML = "";
    
    // Show search results section
    searchResultsSection.style.display = "";
    
    // Sort matching movies to prioritize title matches
    matchingMovies.sort((a, b) => {
        const titleA = (a.name || a.original_title || a.title || "").toLowerCase();
        const titleB = (b.name || b.original_title || b.title || "").toLowerCase();
        
        // Check for exact title match
        const exactMatchA = titleA === query;
        const exactMatchB = titleB === query;
        
        if (exactMatchA && !exactMatchB) return -1;
        if (!exactMatchA && exactMatchB) return 1;
        
        // Check for starts-with match
        const startsWithA = titleA.startsWith(query);
        const startsWithB = titleB.startsWith(query);
        
        if (startsWithA && !startsWithB) return -1;
        if (!startsWithA && startsWithB) return 1;
        
        // Check for substring title match
        const hasTitleA = titleA.includes(query);
        const hasTitleB = titleB.includes(query);
        
        if (hasTitleA && !hasTitleB) return -1;
        if (!hasTitleA && hasTitleB) return 1;
        
        return 0;
    });

    // Display all matching movies
    if (matchingMovies.length === 0) {
        // No results found
        const noResults = document.createElement("p");
        noResults.textContent = `No movies found for "${searchQuery}"`;
        noResults.style.textAlign = "center";
        noResults.style.padding = "40px";
        noResults.style.color = "#888";
        searchResultsContainer.appendChild(noResults);
    } else {
        // Display all matching movies
        matchingMovies.forEach(movie => {
            if (movie.poster) {
                addSearchMovie(movie, searchResultsContainer);
            } else {
                addSearchMovieAlt(movie, searchResultsContainer);
            }
        });
    }
}

// Initialize search functionality when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    const searchInput = document.getElementById("search");
    const searchResultsSection = document.getElementById("searchResults");
    
    // Ensure search results are hidden on page load
    if (searchResultsSection) {
        searchResultsSection.style.display = "none";
    }
    
    // Add event listener to search input
    if (searchInput) {
        // Listen for input events (typing)
        searchInput.addEventListener("input", debounce(function(event) {
            const searchQuery = event.target.value;
            performSearch(searchQuery);
        }, 300)); // 300ms debounce
        
    } else {
        console.warn("Search input element not found");
    }
});

// Helper function for fuzzy matching (Levenshtein Distance)
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Debounce function to limit search frequency
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}





//continue watching function

function continueWatching() {
    const continueWatchingSection = document.getElementById("continue-watching")
    
    // Check if the section exists (might not be on all pages)
    if (!continueWatchingSection) {
        return; // Exit if section doesn't exist
    }

    // Get the array of continue watching movies
    let continueWatchingList = JSON.parse(localStorage.getItem("continueWatching")) || [];
    
    // Handle old format: if it's a single object, convert to array
    if (continueWatchingList && !Array.isArray(continueWatchingList)) {
        continueWatchingList = [continueWatchingList];
        // Save it back in the new format
        localStorage.setItem("continueWatching", JSON.stringify(continueWatchingList));
    }
    
    // Ensure it's an array
    if (!Array.isArray(continueWatchingList)) {
        continueWatchingList = [];
    }

    // Clear the section
    continueWatchingSection.innerHTML = "";

    // Check if there are any movies
    if(continueWatchingList && continueWatchingList.length > 0){
        
        // Loop through each movie in the array
        continueWatchingList.forEach(movie => {
            // Use the existing addMovie function to display each movie
            if (movie || movie.poster) {
                displayMovieWithPoster(movie, continueWatchingSection);
            } 
        });
    } else {
        // Show empty message when there are no movies
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "Start streaming to display recent movies here";
        emptyMessage.style.textAlign = "center";
        emptyMessage.style.padding = "40px 20px";
        emptyMessage.style.fontSize = "1.1rem";
        emptyMessage.style.color = "#888";
        continueWatchingSection.appendChild(emptyMessage);
    }
}




function displayMovieWithPoster(movie, container){
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";
    posterWrapper.style.display = "flex";
    posterWrapper.style.flexDirection = "column";
    posterWrapper.style.position = "relative";
    
    const link = document.createElement("a");
    // Ensure movie.id exists before creating link
    const sourceParam = movie.source || 'profile';
    link.href = `moviedetails.html?id=${movie.id}&source=${sourceParam}`;
    
    
    const img = document.createElement("img");
    img.src = movie.poster;
    img.alt = PLACEHOLDER_POSTER;
    
    const removeButton = document.createElement("button");
    removeButton.textContent = "✕";
    removeButton.className = "remove-from-list";
    removeButton.style.cssText = `
   position: absolute;
   top: 10px;
   right: 10px;
   background-color: rgba(255, 0, 60, 0.9);
   color: white;
   border: none;
   border-radius: 50%;
   width: 30px;
   height: 30px;
   cursor: pointer;
   font-size: 18px;
   font-weight: bold;
   display: flex;
   align-items: center;
   justify-content: center;
   z-index: 1;
   transition: all 0.3s ease;
   opacity: 1;
`;

removeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeFromContinueWatching(movie.id, posterWrapper);
});


const title = document.createElement("p");
title.textContent = movie.title || "Untitled";
title.className = "movie-title";
title.style.cssText = `
font-size: 0.9rem;
max-width: 136px;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
margin-top: 10px;
text-align: center;
`

link.appendChild(img);
posterWrapper.appendChild(link);
posterWrapper.appendChild(removeButton);
posterWrapper.appendChild(title);
container.appendChild(posterWrapper);
}



function removeFromContinueWatching(movieId, elementToRemove) {
    // Get the continue watching array from localStorage
    // Use the same key as everywhere else: "continueWatching" (not "continue-watching")
    let continueWatchingList = JSON.parse(localStorage.getItem("continueWatching")) || [];
    
    // Make sure it's an array
    if (!Array.isArray(continueWatchingList)) {
        continueWatchingList = [];
    }
    
    // Filter out the movie with the matching ID
    continueWatchingList = continueWatchingList.filter(watching => watching.id !== movieId);
    
    // Save the updated array back to localStorage
    localStorage.setItem("continueWatching", JSON.stringify(continueWatchingList));
    
    // Remove the element from the page
    if (elementToRemove) {
        elementToRemove.remove();
    }
    
    
   

    // Empty message is already handled in continueWatching() function
    // No need to duplicate the logic here

    // Refresh the continue watching section to update the display
    // This will automatically show the empty message if the list is now empty
    continueWatching();
}


// Call continueWatching when page loads
window.addEventListener("load", () => {
    continueWatching();
});














function addSearchMovie(movie, container) {
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";


    const link = document.createElement("a");
    // Ensure movie.id exists before creating link
    const sourceParam = movie.source || 'tvshows';
    link.href = `moviedetails.html?id=${movie.id}&source=${encodeURIComponent(sourceParam)}`;

    const img = document.createElement("img");
    img.src = movie.poster ;
    img.alt = PLACEHOLDER_POSTER;
    img.loading = "lazy";
    img.decoding = "async";

    let title = document.createElement("p");
    title.innerText = movie.name || movie.title;
    title.className = "movie-title";
    posterWrapper.style.display = "flex"
    posterWrapper.style.flexDirection = "column"
    if(!movie.title && !movie.name) {
        posterWrapper.style.marginBottom = "30px";
    };

    link.appendChild(img); 
    posterWrapper.appendChild(link);
    posterWrapper.appendChild(title)
    container.appendChild(posterWrapper);
   
};








function addSearchMovieAlt(movie, container) {
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";

    let source = movie.source;
    if (!source) {
        // Try to infer source from movie properties
        if (movie.source === 'newrich'){
             source = 'newrich';
        } else if (movie.show && movie.show.includes('/tv/')){ 
            source = 'tvshows';
        }else{
             source = 'toppicks'; // Default
           }
    }

    const link = document.createElement("a");
    link.href = `moviedetails.html?id=${movie.id}&source=${encodeURIComponent(source)}`;

    const img = document.createElement("img");
    img.src = PLACEHOLDER_POSTER;
    img.alt = movie.name || movie.title || "Untitled" || PLACEHOLDER_POSTER;
    img.loading = "lazy";
    img.decoding = "async";

    let title = document.createElement("p");
    title.innerText = movie.name || movie.title || "Untitled";
    title.className = "movie-title";
    posterWrapper.style.display = "flex"
    posterWrapper.style.flexDirection = "column"
    if(!movie.title && !movie.name) {
        posterWrapper.style.marginBottom = "30px";
    }; 

    link.appendChild(img);
    posterWrapper.appendChild(link);
    posterWrapper.appendChild(title);
    container.appendChild(posterWrapper);
}




















