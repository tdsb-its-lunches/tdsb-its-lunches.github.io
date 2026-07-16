// global array to store all parsed data
let allPlaces = [];

// on initial page load, fetch data from csv file
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

// main logic to process data
function processCSV(csvText) {
    const rows = csvText.split('\n');
    allPlaces = []; // reset array if needed

    // loop through places beginning from row 5
    for (let i = 5; i < rows.length; i++) {
        const row = rows[i].trim();
        if (row === '') continue; 

        // split row, comma delimited; placeName is in index 0
        const columns = row.split(',');
        const placeName = columns[0] ? columns[0].trim() : '';

        // placeDescription starts in index 1 and continues until we encounter an index beginning with `https://`
        let placeDescription = columns.slice(1).join(',').trim();
        const httpIndex = placeDescription.indexOf('https://');
        if (httpIndex !== -1) {
            placeDescription = placeDescription.substring(0, httpIndex).trim();
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
                region: region
            });
        }
    }

    // render global list, intially with ALL filter
    renderList('ALL');
}

// Keep the DOMContentLoaded and processCSV functions exactly the same as before!

// 1. Modified renderList to accept both region and search term
function renderList(filterRegion, searchQuery = '') {
    let htmlContent = '';
    const cleanQuery = searchQuery.toLowerCase().trim();

    // Filter our records based on BOTH active region selection AND search term
    const filtered = allPlaces.filter(place => {
        // Match region first
        const matchesRegion = (filterRegion === 'ALL' || place.region === filterRegion);
        
        // Match text query second (checks title or note)
        const matchesSearch = !cleanQuery || 
            place.title.toLowerCase().includes(cleanQuery) || 
            place.note.toLowerCase().includes(cleanQuery);

        return matchesRegion && matchesSearch;
    });

    if (filtered.length === 0) {
        htmlContent += `<p style="color: #777; text-align: center; margin-top: 20px;">No locations match your search criteria.</p>`;
    } else {
        filtered.forEach(place => {
            const tagClass = `tag-${place.region.toLowerCase().replace(' ', '-')}`;
            
            htmlContent += `
                <div class="place-card">
                    <span class="tag ${tagClass}">${place.region}</span>
                    <div style="font-weight: bold; font-size: 1.1em;">📍 ${place.title}</div>
                    <div class="note-text">📝 ${place.note || 'No notes left.'}</div>
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