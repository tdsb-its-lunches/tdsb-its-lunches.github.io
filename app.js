// 1. Map Initialization
const DEFAULT_CENTER = [43.6923, -79.43071]; // Toronto default center
const DEFAULT_ZOOM = 12;

const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

const MAPBOX_STYLE = 'mapbox://styles/kevinmao1999/cmvv2pgms008n01s2a9jgctrx';

// Check if a Mapbox token is present; fallback to free OpenStreetMap tiles if empty
if (MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN.trim() !== '') {
  L.tileLayer(
    `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_ACCESS_TOKEN}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ).addTo(map);
} else {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

// Google Sheets Published CSV Link
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmdqwmsBGqKFd6BcAalcgXSxlwoJhFv8j-D9sPoqyBsKRSbwMTD5JXQBYYqmk1Qj2irHycVrzQC3ID/pub?gid=0&single=true&output=csv';

let allRestaurants = [];
const markersGroup = L.layerGroup().addTo(map);

// 2. Fetch and Parse CSV Data
function fetchSheetData() {
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    transformHeader: function(header) {
      // Clean hidden spaces or extra quotes around header names
      return header.trim().replace(/^["']|["']$/g, '');
    },
    complete: function(results) {
      allRestaurants = results.data;
      console.log('Loaded CSV rows:', allRestaurants);
      renderApp(allRestaurants);
    },
    error: function(err) {
      console.error('Error fetching CSV:', err);
      document.getElementById('restaurantList').innerHTML = 
        '<p class="placeholder-text">Unable to load restaurant data.</p>';
    }
  });
}

// Define custom 32x32 pin icons (no shadows)
const pinBlue = L.icon({
  iconUrl: 'img/pin_blue.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

const pinRed = L.icon({
  iconUrl: 'img/pin_red.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

const pinGreen = L.icon({
  iconUrl: 'img/pin_green.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

const pinHeart = L.icon({
  iconUrl: 'img/pin_heart.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

// Helper function to safely read column values regardless of minor spacing or case differences
function getProp(obj, keyName) {
  if (!obj) return undefined;
  const target = keyName.toLowerCase().trim();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === target);
  return foundKey ? obj[foundKey] : undefined;
}

// 3. Render Markers and Sidebar
function renderApp(locations) {
  markersGroup.clearLayers();
  const listContainer = document.getElementById('restaurantList');
  listContainer.innerHTML = '';

  let loadedCount = 0;

  locations.forEach((place) => {
    const name = getProp(place, 'Name');
    const latLngStr = getProp(place, 'Lat, Lng') || getProp(place, 'Lat/Lng') || getProp(place, 'LatLng');
    
    if (!latLngStr || typeof latLngStr !== 'string') return;

    const coords = latLngStr.split(',').map(c => parseFloat(c.trim()));
    const lat = coords[0];
    const lng = coords[1];

    if (isNaN(lat) || isNaN(lng)) return;

    // Increment counter so the placeholder logic knows rows were loaded
    loadedCount++;

    const region = getProp(place, 'Region');
    const type = getProp(place, 'Type');
    const cuisine = getProp(place, 'Cuisine');
    const favourite = getProp(place, 'Favourite?');

    // Select pin based on Type (for ITS) or Region
    let selectedIcon = pinBlue; // Default fallback pin

    const cleanType = type ? type.toString().trim().toUpperCase() : '';
    const cleanRegion = region ? region.toString().trim().toUpperCase() : '';

    if (cleanType === 'ITS' || cleanRegion === 'ITS') {
      selectedIcon = pinHeart;
    } else if (cleanRegion === 'ETOBICOKE') {
      selectedIcon = pinRed;
    } else if (cleanRegion === 'SCARBOROUGH') {
      selectedIcon = pinGreen;
    } else if (cleanRegion === 'NORTH YORK') {
      selectedIcon = pinBlue;
    }

    // Create Map Pin with selected custom icon
    const marker = L.marker([lat, lng], { icon: selectedIcon }).addTo(markersGroup);

    const isFav = favourite && favourite.toLowerCase().trim() === 'yes';
    const favBadge = isFav ? ' ⭐' : '';

    marker.on('click', () => {
      openDetailModal(place);
    });

    // Create Sidebar Item Card
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.innerHTML = `
      <h3>${name || 'Unnamed Spot'}${favBadge}</h3>
      <p><strong>${cuisine || 'Food'}</strong> ${region ? '• ' + region : ''}</p>
      <p style="color: #888; font-size: 0.8rem; margin-top: 2px;">${getProp(place, 'Address') || ''}</p>
    `;

    card.addEventListener('click', () => {
      map.flyTo([lat, lng], 16);
      openDetailModal(place);
    });

    listContainer.appendChild(card);
  });

  if (loadedCount === 0) {
    listContainer.innerHTML = '<p class="placeholder-text">No valid locations found in CSV.</p>';
  }
}

// 4. Detailed Modal View
function openDetailModal(place) {
  const modal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');

  const name = getProp(place, 'Name');
  const cuisine = getProp(place, 'Cuisine');
  const type = getProp(place, 'Type');
  const region = getProp(place, 'Region');
  const description = getProp(place, 'Description');
  const address = getProp(place, 'Address');
  const menuHighlights = getProp(place, 'Menu Highlights');
  const favourite = getProp(place, 'Favourite?');

  const isFav = favourite && favourite.toLowerCase().trim() === 'yes';

  // Helper to format clean outgoing social & web links
  const createLink = (url, label) => {
    if (!url || url.trim() === '') return '';
    const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    return `<a href="${formattedUrl}" target="_blank" rel="noopener noreferrer" style="margin-right: 10px; text-decoration: none; color: #2c3e50; font-weight: bold;">${label} ↗</a>`;
  };

  modalBody.innerHTML = `
    <h2 style="margin-bottom: 4px;">${name || ''} ${isFav ? '⭐' : ''}</h2>
    <p style="color: #666; margin-bottom: 12px;">
      <strong>${cuisine || ''}</strong> 
      ${type ? '• ' + type : ''} 
      ${region ? '• ' + region : ''}
    </p>
    
    ${description ? `<p style="margin-bottom: 12px;">${description}</p>` : ''}
    ${address ? `<p style="margin-bottom: 12px;"><strong>📍 Address:</strong> ${address}</p>` : ''}
    ${menuHighlights ? `<p style="margin-bottom: 12px;"><strong>🍽️ Menu Highlights:</strong> ${menuHighlights}</p>` : ''}
    
    <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
    
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${createLink(getProp(place, 'Google Maps'), 'Google Maps')}
      ${createLink(getProp(place, 'Website'), 'Website')}
      ${createLink(getProp(place, 'Instagram'), 'Instagram')}
      ${createLink(getProp(place, 'Facebook'), 'Facebook')}
      ${createLink(getProp(place, 'TikTok'), 'TikTok')}
      ${createLink(getProp(place, 'YouTube'), 'YouTube')}
      ${createLink(getProp(place, 'Twitter'), 'Twitter')}
    </div>
  `;

  modal.classList.remove('hidden');
}

// Close Modal Event Handlers
document.getElementById('closeModalBtn').addEventListener('click', () => {
  document.getElementById('detailModal').classList.add('hidden');
});

document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') {
    document.getElementById('detailModal').classList.add('hidden');
  }
});

// Run fetch on load
fetchSheetData();