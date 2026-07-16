// global array to store all parsed data
let allPlaces = [];

// on initial page load, fetch data from csv file, then run processCSV() on the data
document.addEventListener('DOMContentLoaded', () => {
    fetch('TDSB ITS Lunch Spots.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('There was an issue finding TDSB ITS Lunch Spots.csv.');
            }
            return response.text();
        })
        .then(text => {
            processCSV(text);
        })
        .catch(error => {
            document.getElementById('output').textContent = `Error: ${error.message}`;
        });
});

// main logic to process then display data
function processCSV(csvText) {
    const rows = csvText.split('\n');
    allPlaces = []; // reset global array if needed

    // loop through non-empty rows beginning from row 6
    for (let i = 6; i < rows.length; i++) {
        const row = rows[i].trim();
        if (row === '') continue; 

        // split rows, comma delimited; placeName is in index 0
        const columns = row.split(',');
        const placeName = columns[0] ? columns[0].trim() : '';
        console.log(columns)

        // find column index that contains `https://` (placeDescription runs from 1 to there, and tags are immediately afterwards)
        let urlColumnIndex = columns.findIndex(col => col.trim().includes('https://'));
        console.log("column url: " + urlColumnIndex)

        let placeDescription = '';
        let isFavourite = false;

        if (urlColumnIndex !== -1) {
            placeDescription = columns.slice(1, urlColumnIndex).join(',').trim(); // description from 1 until url col
            const tag = columns[urlColumnIndex + 1] ? columns[urlColumnIndex + 1].trim() : ''; // tags immediately after url col
            console.log(tag)
            isFavourite = tag !== '';
            console.log(isFavourite)
        }
        else {
            placeDescription = columns.slice(1).join(',').trim();
        }

        // clean up description
        while (placeDescription.startsWith('"') || placeDescription.startsWith(',')) {
            placeDescription = placeDescription.substring(1).trim();
        }
        while (placeDescription.endsWith('"') || placeDescription.endsWith(',')) {
            placeDescription = placeDescription.substring(0, placeDescription.length - 1).trim();
        }

        // determine region by checking end of placeDescription, and remove region from description
        if (placeName || placeDescription) {
            let region = 'UNKNOWN';
            let upperNote = placeDescription.toUpperCase();

            if (upperNote.endsWith('(ETOBICOKE)')) {
                region = 'ETOBICOKE';
                placeDescription = placeDescription.substring(0, placeDescription.length - 11).trim();
            } else if (upperNote.endsWith('(SCARBOROUGH)')) {
                region = 'SCARBOROUGH';
                placeDescription = placeDescription.substring(0, placeDescription.length - 13).trim();
            } else if (upperNote.endsWith('(NORTH YORK)')) {
                region = 'NORTH YORK';
                placeDescription = placeDescription.substring(0, placeDescription.length - 12).trim();
            }

            // clean up description again
            while (placeDescription.endsWith('"') || placeDescription.endsWith(',')) {
                placeDescription = placeDescription.substring(0, placeDescription.length - 1).trim();
            }

            // add restaurant object into global list
            allPlaces.push({
                title: placeName,
                note: placeDescription,
                region: region,
                isFavourite: isFavourite
            });
        }
    }

    // render global list, intially with ALL filter
    renderList('ALL');
}

function renderList(filterRegion, searchQuery = '') {
    let htmlContent = '';
    const cleanQuery = searchQuery.toLowerCase().trim();

    // Filter our records based on BOTH active region selection AND search term
    const filtered = allPlaces.filter(place => {
        // 1. Match region button filter first
        const matchesRegion = (filterRegion === 'ALL' || place.region === filterRegion);
        
        // 2. Check if the user is typing search terms related to "favourites"
        const isSearchingFavourite = place.isFavourite && 
            ["favourites", "favorites", "favs", "kevin"].some(keyword => keyword.includes(cleanQuery));

        // 3. Match text query (checks title, note, region name, or favorite keywords)
        const matchesSearch = !cleanQuery || 
            place.title.toLowerCase().includes(cleanQuery) || 
            place.note.toLowerCase().includes(cleanQuery) ||
            place.region.toLowerCase().includes(cleanQuery) ||
            isSearchingFavourite; 

        return matchesRegion && matchesSearch;
    });

    if (filtered.length === 0) {
        htmlContent += `<p style="color: #777; text-align: center; margin-top: 20px;">No locations match your search criteria.</p>`;
    } else {
        filtered.forEach(place => {
            const tagClass = `tag-${place.region.toLowerCase().replace(' ', '-')}`;
            
            // Build the favorite tag if the boolean is true
            const favoriteTagMarkup = place.isFavourite 
                ? `<span class="tag tag-favourite">❤️ Kevin's Favourites</span>` 
                : '';
            
            htmlContent += `
                <div class="place-card">
                    <div class="place-card-tags">
                        <span class="tag ${tagClass}">${place.region}</span>
                        ${favoriteTagMarkup}
                    </div>
                    <div style="font-weight: bold; font-size: 1.1em; display: flex; align-items: center;">
                        <span>${place.title}</span>
                    </div>
                    <div class="note-text" style="margin-top: 5px;">📑 ${place.note || '-'}</div>
                </div>
            `;
        });
    }

    document.getElementById('output').innerHTML = htmlContent;
}

// filter places via both region and search bar
function filterPlaces(region) {
    const buttons = document.querySelectorAll('.filter-buttons .btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
    }

    const currentSearch = document.getElementById('searchInput').value;
    renderList(region, currentSearch);
}

// search bar functionality
function handleSearch() {
    const currentSearch = document.getElementById('searchInput').value;
    
    const activeBtn = document.querySelector('.filter-buttons .btn.active');
    
    let currentRegion = 'ALL';
    if (activeBtn) {
        if (activeBtn.textContent.includes('Etobicoke')) currentRegion = 'ETOBICOKE';
        else if (activeBtn.textContent.includes('Scarborough')) currentRegion = 'SCARBOROUGH';
        else if (activeBtn.textContent.includes('North York')) currentRegion = 'NORTH YORK';
    }

    renderList(currentRegion, currentSearch);
}