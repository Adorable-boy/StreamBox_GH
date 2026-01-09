// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded',function(){


    const IMAGE_URL = 'https://image.tmdb.org/t/p/w780';

       const listElement = document.getElementById("myList");

       if(!listElement){
        console.error("Container not found");
        return;
       }

       let myList = JSON.parse(localStorage.getItem("myList")) || [];

       if(myList.length === 0){
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent ="Your list is empty. Add movies to your list to see them here!";
        emptyMessage.style.textAlign = "center";
        emptyMessage.style.padding = "40px 20px";
        emptyMessage.style.color = "#888";
        emptyMessage.style.fontSize = "1.1rem";
        listElement.appendChild(emptyMessage);
        return;
       }

       myList.forEach(movie =>{
        if(movie.poster || 'https://image.tmdb.org/t/p/w500' + movie.poster_path || IMAGE_URL + movie.backdrop_path){
            displayMovieWithPoster(movie, listElement);
        } else {
            displayMovieWithoutPoster(movie, listElement);
        }
       });
});

function displayMovieWithPoster(movie, container){
const posterWrapper = document.createElement("div");
posterWrapper.className = "poster-wrapper";
posterWrapper.style.display = "grid";
posterWrapper.style.gridTemplateColumns = "repeat(auto-fit,minmax(140px,1fr))"

const link = document.createElement("a");
link.href = `moviedetails.html?id=${movie.id}&source=profile`;


const img = document.createElement("img");
img.src = movie.poster || 'https://image.tmdb.org/t/p/w500' + movie.poster_path || IMAGE_URL + movie.backdrop_path;
img.alt = movie.alt || movie.title || "Movie poster";

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
    removeFromList(movie.id, posterWrapper);
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
};








function displayMovieWithoutPoster(movie, container) {
    const movieItem = document.createElement("div");
    movieItem.style.cssText = `
        padding: 15px;
        margin: 10px;
        background-color: #333;
        border-radius: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    const title = document.createElement("span");
    title.textContent = movie.title || 'Untitled';
    title.style.color = "white";
    
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.style.cssText = `
        background-color: rgb(255, 0, 60);
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 5px;
        cursor: pointer;
    `;
    
    removeButton.addEventListener('click', () => {
        removeFromList(movie.id, movieItem);
    });
    
    const link = document.createElement("a");
    link.href = `moviedetails.html?id=${movie.id}&source=profile`;
    link.style.textDecoration = "none";
    link.style.color = "white";
    link.appendChild(title);
    
    movieItem.appendChild(link);
    movieItem.appendChild(removeButton);
    container.appendChild(movieItem);
};


function removeFromList(movieId, elementToRemove){
let myList = JSON.parse(localStorage.getItem("myList")) || [];
 
myList = myList.filter(item => item.id !== movieId);

localStorage.setItem("myList", JSON.stringify(myList));

elementToRemove.style.transition = "opacity 0.3s ease, transform 0.3s ease";
elementToRemove.style.opacity = "0";
elementToRemove.style.transform = "scale(0.8)";

setTimeout(() =>{
    elementToRemove.remove();

    const listElement = document.getElementById("myList");
    const remainingMovies = listElement.querySelectorAll(".poster-wrapper, div[style*='background-color: #333']");

    if(remainingMovies.length === 0){
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "Your list is empty. Add movies to your list to see them here!";
        emptyMessage.style.textAlign = "center";
        emptyMessage.style.padding = "40px 20px";
        emptyMessage.style.color = "#888";
        emptyMessage.style.fontSize = "1.1rem";
        listElement.appendChild(emptyMessage);
    }
}, 300);
};