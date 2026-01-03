document.addEventListener('DOMContentLoaded', function() {
    const page = document.getElementById("newandrich");



    if (!page) {
        console.error('newandrich container not found');
        return;
    }


        
        
    
    fetch("https://api.themoviedb.org/3/movie/upcoming?api_key=e729d3999faacd83f8c79de0b5c7bc0e&language=en-US&page=2")
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const processedData = {
                ComingSoon: (data.results || []).map(movie => ({
                    id: movie.id,
                    title: movie.title,
                    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                    description: movie.overview,
                    year: movie.release_date?.split('-')[0],
                    rating: movie.vote_average,
                    source: 'newrich',
                })).filter(m => m.poster)
            };

            function createSection(movies) {
                if (!movies || movies.length === 0) return null;
                const sectionWrapper = document.createElement("div");
                const columnPosters = document.createElement("div");
                columnPosters.className = "column-posters";
                movies.forEach(movie => {
                    if (movie.poster) columnPosters.appendChild(createComingSoonWithButtons(movie));
                });
                sectionWrapper.appendChild(columnPosters);
                return sectionWrapper;
            }

            const comingSoonSection = createSection(processedData.ComingSoon);
            if (comingSoonSection) page.appendChild(comingSoonSection);
        })
        .catch(error => {
            console.error('Error loading new&rich data:', error);
            page.innerHTML = '<div>Error loading content. Please try again later.</div>';
        });














// Function to create a movie poster with buttons and info display
function createComingSoonWithButtons(movie) {
    // Create wrapper div for the entire poster card
    const posterCard = document.createElement("div");
    posterCard.className = "poster-card";
    
    // Create container for poster image and info overlay
    const posterContainer = document.createElement("div");
    posterContainer.className = "poster-container";
    
    // Create the clickable link for the poster
    const posterLink = document.createElement("a");
    posterLink.href = `moviedetails.html?id=${movie.id}&source=newrich`;
    
    
    // Create the poster image
    const img = document.createElement("img");
    img.src = movie.poster;
    img.alt = movie.alt || movie.title || 'Movie poster';
    img.className = "poster-image";
    
    // Create info overlay that appears on hover
    const infoOverlay = document.createElement("div");
    infoOverlay.className = "poster-info-overlay";
    
    // Add title to overlay
    if (movie.title) {
        const title = document.createElement("h3");
        title.className = "poster-title";
        title.textContent = movie.title;
        infoOverlay.appendChild(title);
    }
    
    // Add year, rating, duration if available
    if (movie.year || movie.rating || movie.duration) {
        const meta = document.createElement("div");
        meta.className = "poster-meta";
        if (movie.year) {
            const year = document.createElement("span");
            year.textContent = movie.year;
            meta.appendChild(year);
        }
        if (movie.rating) {
            const rating = document.createElement("span");
            rating.textContent = movie.rating;
            meta.appendChild(rating);
        }
        if (movie.duration) {
            const duration = document.createElement("span");
            duration.textContent = movie.duration;
            meta.appendChild(duration);
        }
        infoOverlay.appendChild(meta);
    }
    
    // Add description if available
    if (movie.description) {
        const description = document.createElement("p");
        description.className = "poster-description";
        description.textContent = movie.description;
        infoOverlay.appendChild(description);
    }


   
    
    // Add genres if available
    if (movie.gener && movie.gener.length > 0) {
        const genres = document.createElement("div");
        genres.className = "poster-genres";
        movie.gener.forEach(genre => {
            const genreTag = document.createElement("span");
            genreTag.className = "genre-tag";
            genreTag.textContent = genre;
            genres.appendChild(genreTag);
        });
        infoOverlay.appendChild(genres);
    }
    
    // Assemble poster container
    posterLink.appendChild(img);
    posterContainer.appendChild(posterLink);
    posterContainer.appendChild(infoOverlay);
    
    // Create button group
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "newrich-button-group";
    
    
    
    // Create Play button
    const playLink = document.createElement("a");
    playLink.href = `moviedetails.html?id=${movie.id}&source=newrich`;
    const playButton = document.createElement("button");
    playButton.className = "newrich-play-btn";
    playButton.textContent = "▶ Play";




    playLink.addEventListener('click', ()=>{


           const moviedata = {
  id: movie.id,
  title: movie.title || movie.name,
  poster: movie.poster,
  source: 'newrich'
};

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
           const existingIndex = continueWatchingList.findIndex(movi => movi.id === movie.id);
           
           if (existingIndex !== -1) {
               // Movie already exists - update its timestamp (move to front)
           continueWatchingList.splice(existingIndex, 1); // Remove old entry
           }
           
           // Add new movie to the beginning of the array
           continueWatchingList.unshift(moviedata);
           
           
           // Save the updated array to localStorage
           localStorage.setItem("continueWatching", JSON.stringify(continueWatchingList));

           window.location.href = `moviedetails.html?id=${movie.id}&source=newrich`;

       })





    playLink.appendChild(playButton);


   
    
    // Create Add To List button
    const addButton = document.createElement("button");
    addButton.className = "newrich-add-btn";
    // Check if movie is already in list and set initial button state
    let myList = JSON.parse(localStorage.getItem("myList")) || [];
    const isInList = myList.some(item => item.id === movie.id);
    addButton.textContent = isInList ? "✔︎ Added To List" : "Add To List";
    addButton.setAttribute("data-movie-id", movie.id);
    addButton.addEventListener("click", (event) => {
        addToList(event, movie);
    });


    
    
    // Assemble buttons
    buttonGroup.appendChild(playLink);
    buttonGroup.appendChild(addButton);

    
    // Assemble the complete card
    posterCard.appendChild(posterContainer);
    posterCard.appendChild(buttonGroup);


    
    
    return posterCard;
}











    });