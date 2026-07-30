// global array to store all parsed data
let allPlaces = [];

// force browser to start at the top on reload/refresh
if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}

window.addEventListener("beforeunload", () => {
    window.scrollTo(0, 0);
});

// on initial page load, fetch data from places.json, then process and render
document.addEventListener("DOMContentLoaded", () => {
    fetch("places.json")
        .then((response) => {
            if (!response.ok) {
                throw new Error("There was an issue finding places.json.");
            }
            return response.json();
        })
        .then((data) => {
            processPlacesData(data);
        })
        .catch((error) => {
            document.getElementById("output").textContent = `Error: ${error.message}`;
        });
});

// main logic to process then display JSON data
function processPlacesData(data) {
    // --- 1. Display Timestamp ---
    const lastUpdatedEl = document.getElementById("lastUpdated");
    if (lastUpdatedEl && data.last_updated) {
        // Formats to user's local date/time (e.g., "7/30/2026, 2:22:00 AM")
        const formattedDate = new Date(data.last_updated).toLocaleString();
        lastUpdatedEl.textContent = `${formattedDate}`;
    }

    // --- 2. Extract Places Array ---
    const rawPlaces = data.places || [];

    allPlaces = rawPlaces.map((item) => {
        const layerUpper = (item.layer || "").toUpperCase();
        const descUpper = (item.description || "").toUpperCase();
        const isFavourite = (item.fav || "");

        // Determine Region from Layer Name (or Description)
        let region = "UNKNOWN";
        if (layerUpper.includes("ETOBICOKE") || descUpper.includes("ETOBICOKE")) {
            region = "ETOBICOKE";
        } else if (layerUpper.includes("SCARBOROUGH") || descUpper.includes("SCARBOROUGH")) {
            region = "SCARBOROUGH";
        } else if (layerUpper.includes("NORTH YORK") || descUpper.includes("NORTH YORK")) {
            region = "NORTH YORK";
        }

        return {
            title: item.name || "Unnamed Location",
            note: item.description || "",
            url: item.google_maps_url || "",
            region: region,
            isFavourite: isFavourite,
        };
    });

    // Shuffle list
    for (let i = allPlaces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = allPlaces[i];
        allPlaces[i] = allPlaces[j];
        allPlaces[j] = temp;
    }

    // render global list, initially with ALL filter
    renderList("ALL");
}

function renderList(filterRegion, searchQuery = "") {
    let htmlContent = "";
    const cleanQuery = searchQuery.toLowerCase().trim();

    // Filter our records based on BOTH active region selection AND search term
    const filtered = allPlaces.filter((place) => {
        // 1. Match region button filter first
        const matchesRegion = filterRegion === "ALL" || place.region === filterRegion;

        // 2. Check if the user is typing search terms related to "favourites"
        const isSearchingFavourite =
            place.isFavourite &&
            ["favourites", "favorites", "favs", "kevin"].some((keyword) =>
                keyword.includes(cleanQuery),
            );

        // 3. Match text query (checks title, note, region name, or favorite keywords)
        const matchesSearch =
            !cleanQuery ||
            place.title.toLowerCase().includes(cleanQuery) ||
            place.note.toLowerCase().includes(cleanQuery) ||
            place.region.toLowerCase().includes(cleanQuery) ||
            isSearchingFavourite;

        return matchesRegion && matchesSearch;
    });

    if (filtered.length === 0) {
        htmlContent += `<p style="color: #777; text-align: center; margin-top: 20px;">No locations match your search criteria.</p>`;
    } else {
        filtered.forEach((place) => {
            const tagClass = `tag-${place.region.toLowerCase().replace(" ", "-")}`;

            // Build the favorite tag if the boolean is true
            const favoriteTagMarkup = place.isFavourite
                ? `<span class="tag tag-favourite">❤️ Kevin's Favourites</span>`
                : "";

            const linkMarkup = place.url
                ? `<a href="${place.url}" target="_blank" rel="noopener noreferrer" style="margin-left: 4px; display: inline-flex; align-items: center;" title="Google Maps">
        <img src="img/location.png" alt="Location icon" style="width: 20px; height: 20px; object-fit: contain;" />
       </a>`
                : "";

            // --- Clean Note Text ---
            // Strips "description:", any "fav:" instance (and trailing true/false/words), then cleans extra spaces
            let displayNote = (place.note || "")
                .replace(/description:\s*/gi, "")
                .replace(/fav:\s*\w*/gi, "")
                .replace(/\s+/g, " ")
                .trim();

            htmlContent += `
                <div class="place-card">
                    <div class="place-card-tags">
                        <span class="tag ${tagClass}">${place.region}</span>
                        ${favoriteTagMarkup}
                    </div>
                    <div style="font-weight: bold; font-size: 1.1em; display: flex; align-items: center;">
                        <span>${place.title}</span>
                        ${linkMarkup}
                    </div>
                    <div class="note-text" style="margin-top: 5px; display: flex; align-items: center; gap: 4px;">
                        <img src="img/note.png" alt="Note icon" style="width: 16px; height: 16px; object-fit: contain;" />
                        <span>${displayNote || "-"}</span>
                    </div>
                </div>
            `;
        });
    }

    document.getElementById("output").innerHTML = htmlContent;
}

// filter places via both region and search bar
function filterPlaces(region) {
    const buttons = document.querySelectorAll(".filter-buttons .btn");
    buttons.forEach((btn) => btn.classList.remove("active"));

    if (event && event.target) {
        event.target.classList.add("active");
    }

    const currentSearch = document.getElementById("searchInput").value;
    renderList(region, currentSearch);
}

// search bar functionality
function handleSearch() {
    const currentSearch = document.getElementById("searchInput").value;

    const activeBtn = document.querySelector(".filter-buttons .btn.active");

    let currentRegion = "ALL";
    if (activeBtn) {
        if (activeBtn.textContent.includes("Etobicoke")) currentRegion = "ETOBICOKE";
        else if (activeBtn.textContent.includes("Scarborough")) currentRegion = "SCARBOROUGH";
        else if (activeBtn.textContent.includes("North York")) currentRegion = "NORTH YORK";
    }

    renderList(currentRegion, currentSearch);
}

// display button when user scrolls down 200px from top
window.onscroll = function () {
    const btn = document.getElementById("backToTopBtn");
    if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
        btn.classList.add("show");
    } else {
        btn.classList.remove("show");
    }
};

// scroll back to top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
}
