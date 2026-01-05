async function kidsfunc() {
try {
    
let kids=[]


for (let i = 1; i <= 32; i++) {
    
  kids.push( fetch(`https://streambox-api.bpvw7gw5zw.workers.dev/?endpoint=discover/movie&with_genres=16&language=en-US&page=${i}`)
    .then(r => r.json())
  );

}

const res = await Promise.all(kids)
return res.filter(Boolean)
} catch (error) {
    console.error("Error loading kids section :", error)
    return []
}

}











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









    kidsfunc().then(dataArray => {
        const topPickIds = ["kids1", "kids2", "kids3", "kids4", "kids5", "kids6", "kids7", "kids8", "kids9", "kids10", "kids11","kids12", "kids13", "kids14", "kids15", "kids16", "kids17", "kids18", "kids19", "kids20", "kids21", "kids22", "kids23", "kids24", "kids25", "kids26", "kids27", "kids28"];

        let allKidsMovies = [];

        dataArray.forEach((data, index) => {
            const movies = data.results || [];
            const mappedMovies = movies.map(m => ({ ...mapTMDBMovie(m), source: 'toppicks' }));
            allKidsMovies = [...allKidsMovies, ...mappedMovies];

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

     // Explore section
        const exploreContainer = document.getElementById("explore");
        if (exploreContainer && allKidsMovies.length > 0) {
            const shuffledForExplore = [...allKidsMovies].sort(() => Math.random() - 0.5);
            shuffledForExplore.slice(0, 20).forEach(movie => {
                if (movie.poster) addMovie(movie, exploreContainer);
                if (!movie.poster) addMovieAlt(movie, exploreContainer);
            });
        }



        // Add to allMovies for search
        if (allKidsMovies.length > 0 && typeof allMovies !== "undefined") {
            allMovies = Array.isArray(allMovies) ? [...allMovies, ...allKidsMovies] : allKidsMovies;
        }

  

    });














    async function loadRemainingMovies() {
        const totalPages = 500;
        const batchSize = 10;

        for (let i = 1; i <= totalPages; i += batchSize) {
            const fetchPromises = [];
            const endPage = Math.min(i + batchSize - 1, totalPages);
            
            for (let page = i; page <= endPage; page++) {
                fetchPromises.push(
                    fetch(`https://streambox-api.bpvw7gw5zw.workers.dev/?endpoint=discover/movie&with_genres=16&language=en-US&page=${page}`)
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
                    if (typeof allMovies !== "undefined") {
                        allMovies = [...allMovies, ...newMovies];
                    }
                }
                
                // Small delay to yield to main thread
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error("Error loading background movies:", error);
            }
        }
    }
