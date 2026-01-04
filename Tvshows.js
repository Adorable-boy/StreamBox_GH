window.addEventListener('DOMContentLoaded', () => {


let  tvshowsContainer = document.querySelectorAll("#tvshowsContainer, #TopPicksTv2, #TopPicksTv3, #TopPicksTv4, #TopPicksTv5, #TopPicksTv6, #TopPicksTv7, #TopPicksTv8, #TopPicksTv9, #TopPicksTv10, #TopPicksTv11, #TopPicksTv12, #TopPicksTv13, #TopPicksTv14, #TopPicksTv15, #TopPicksTv16, #TopPicksTv17, #TopPicksTv18, #TopPicksTv19, #TopPicksTv20, #TopPicksTv21, #TopPicksTv22, #TopPicksTv23, #TopPicksTv24, #TopPicksTv25, #TopPicksTv26, #TopPicksTv27, #TopPicksTv28, #TopPicksTv29, #TopPicksTv30, #TopPicksTv31, #TopPicksTv32")
async function fetchTvShows() {
   try {
    let tvshows = [];
    // Reduced from 500 to 32 to match the number of TV containers
    for(let i = 1; i <= 32; i++) {
    tvshows.push(
        fetch(`https://streambox-api.bpvw7gw5zw.workers.dev/?endpoint=discover/tv&language=en-US&page=${i}`)
       .then(r => r.json())
      );
    }
    const tvshowsData = await Promise.all(tvshows);
    return tvshowsData;
}catch(error){
        console.error("Error fetching TV shows:", error);
        return [];
    };
}




fetchTvShows().then(tvshowsData => {
    
  function mapTMDBTvShows(tvshow) {
    return {
            id: tvshow.id,
            name: tvshow.name,
            title: tvshow.original_name || tvshow.name,
            poster: tvshow.poster_path ? `https://image.tmdb.org/t/p/w500${tvshow.poster_path}` : '',
            description: tvshow.overview,
            year: tvshow.first_air_date ? tvshow.first_air_date.substring(0, 4) : "",
            rating: tvshow.vote_average,
            alt: tvshow.name
    }
    
   }

   const tvshowsIds = ["tvshowsContainer", "TopPicksTv2", "TopPicksTv3", "TopPicksTv4", "TopPicksTv5", "TopPicksTv6", "TopPicksTv7", "TopPicksTv8", "TopPicksTv9", "TopPicksTv10", "TopPicksTv11", "TopPicksTv12", "TopPicksTv13", "TopPicksTv14", "TopPicksTv15", "TopPicksTv16", "TopPicksTv17", "TopPicksTv18", "TopPicksTv19", "TopPicksTv20", "TopPicksTv21", "TopPicksTv22", "TopPicksTv23", "TopPicksTv24", "TopPicksTv25", "TopPicksTv26", "TopPicksTv27", "TopPicksTv28", "TopPicksTv29", "TopPicksTv30", "TopPicksTv31", "TopPicksTv32"];

   let allTvShows = [];


   tvshowsData.forEach((data , index) => {
         const tvshows = data.results || [];
         const mappedTvShows = tvshows.map(mapTMDBTvShows);
         allTvShows = [...allTvShows, ...mappedTvShows];

         const containerId = tvshowsIds[index];
         const container = document.getElementById(containerId);


         if (container) {
            const shuffledTvShows = [...mappedTvShows].sort(() => 0.5 - Math.random());
            shuffledTvShows.slice(0, 30).forEach(tvshow => {
                if (tvshow.poster) addTvShow(tvshow, container);
                if(!tvshow.poster) addTvShowAlt(tvshow, container);
            });
         }

});

 if (Array.isArray(allTvShows) && allTvShows.length > 0) {
    if (Array.isArray(allMovies) && allMovies.length > 0) {
        allMovies = [...allMovies, ...allTvShows];
    } else {
        allMovies = allTvShows;
    }
 }


});








function addTvShow(movie, container) {
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";


    const link = document.createElement("a");
    // Ensure movie.id exists before creating link

    link.href = `moviedetails.html?id=${movie.id}&source=tvshows`;

    const img = document.createElement("img");
    img.src = movie.poster || "";
    img.alt = movie.name || movie.title;

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











function addTvShowAlt(movie, container) {
    const posterWrapper = document.createElement("div");
    posterWrapper.className = "poster-wrapper";


    const link = document.createElement("a");
    // Ensure movie.id exists before creating link
    
    link.href = `moviedetails.html?id=${movie.id}&source=tvshows`;
    
    const img = document.createElement("img");
    img.alt = movie.name || movie.title;

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


});