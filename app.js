// initialize
// initialize
const DEFAULT_CENTER = [43.6923, -79.43071];
const DEFAULT_ZOOM = 12;

const map = L.map('map', {
  zoomSnap: 0.25,           // Enables fractional zoom levels (quarter steps)
  zoomDelta: 0.25,          // Smaller zoom jump per button click
  wheelPxPerZoomLevel: 75, // Higher number = slower, more gradual mouse wheel scroll
  markerZoomAnimation: true
}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

const MAPBOX_STYLE = 'kevinmao1999/cmvv2pgms008n01s2a9jgctrx';
const accessToken = MAPBOX_ACCESS_TOKEN;

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmdqwmsBGqKFd6BcAalcgXSxlwoJhFv8j-D9sPoqyBsKRSbwMTD5JXQBYYqmk1Qj2irHycVrzQC3ID/pub?gid=0&single=true&output=csv';

// load Mapbox tiles onto Leaflet map
if (accessToken && accessToken.trim() !== '') {
  L.tileLayer(
    `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/512/{z}/{x}/{y}@2x?access_token=${accessToken}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ).addTo(map);
}

let allRestaurants = [];
const markersGroup = L.layerGroup().addTo(map);

// fetch and parse CSV data
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
      
      // 1. Render all map pins once
      renderMarkers(allRestaurants);
      
      // 2. Initial sidebar populate based on starting map view
      updateVisibleSidebar();

      // 3. Listen for map pans/zooms to dynamically update the sidebar
      map.off('moveend', updateVisibleSidebar); // Prevent duplicate listeners on refetch
      map.on('moveend', updateVisibleSidebar);
    },
    error: function(err) {
      console.error('Error fetching CSV:', err);
      document.getElementById('restaurantList').innerHTML = 
        '<p class="placeholder-text">Unable to load restaurant data.</p>';
    }
  });
}

function renderMarkers(locations) {
  markersGroup.clearLayers();

  locations.forEach((place, index) => {
    const latLngStr = getProp(place, 'Lat, Lng') || getProp(place, 'Lat/Lng') || getProp(place, 'LatLng');
    if (!latLngStr || typeof latLngStr !== 'string') return;

    const coords = latLngStr.split(',').map(c => parseFloat(c.trim()));
    const lat = coords[0];
    const lng = coords[1];

    if (isNaN(lat) || isNaN(lng)) return;

    const name = getProp(place, 'Name') || 'Unnamed Spot';
    const region = getProp(place, 'Region');
    const type = getProp(place, 'Type');

    const cleanType = type ? type.toString().trim().toUpperCase() : '';
    const cleanRegion = region ? region.toString().trim().toUpperCase() : '';

    let selectedIcon = pinBlue;
    let selectedHoverIcon = pinHoverBlue;

    if (cleanType === 'ITS' || cleanRegion === 'ITS') {
      selectedIcon = pinHeart;
      selectedHoverIcon = pinHoverHeart;
    } else if (cleanRegion === 'ETOBICOKE') {
      selectedIcon = pinRed;
      selectedHoverIcon = pinHoverRed;
    } else if (cleanRegion === 'SCARBOROUGH') {
      selectedIcon = pinGreen;
      selectedHoverIcon = pinHoverGreen;
    } else if (cleanRegion === 'NORTH YORK') {
      selectedIcon = pinBlue;
      selectedHoverIcon = pinHoverBlue;
    }

    const marker = L.marker([lat, lng], { icon: selectedIcon }).addTo(markersGroup);

    // 1. Attach name tooltip near cursor
    marker.bindTooltip(name, {
      direction: 'top',
      offset: [0, -12],
      className: 'custom-tooltip'
    });

    // Determine matching sidebar card ID
    const cardId = `card-${name.replace(/\s+/g, '-').toLowerCase()}`;

    // 2. Mouseover event: Swap icon & highlight sidebar card
    marker.on('mouseover', () => {
      marker.setIcon(selectedHoverIcon);

      const targetCard = document.querySelector(`[data-card-id="${cardId}"]`);
      if (targetCard) {
        targetCard.classList.add('highlighted');
        targetCard.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      }
    });

    // 3. Mouseout event: Restore icon & remove sidebar highlight
    marker.on('mouseout', () => {
      marker.setIcon(selectedIcon);

      const targetCard = document.querySelector(`[data-card-id="${cardId}"]`);
      if (targetCard) {
        targetCard.classList.remove('highlighted');
      }
    });

    // Click handler
    marker.on('click', () => {
      openDetailModal(place);
    });
  });
}

function renderSidebar(visibleLocations) {
  const listContainer = document.getElementById('restaurantList');
  listContainer.innerHTML = '';

  if (visibleLocations.length === 0) {
    listContainer.innerHTML = '<p class="placeholder-text">No restaurants in this map view.</p>';
    return;
  }

  visibleLocations.forEach((place, index) => {
    const name = getProp(place, 'Name');
    const region = getProp(place, 'Region');
    const cuisine = getProp(place, 'Cuisine');
    const favourite = getProp(place, 'Favourite?');

    const latLngStr = getProp(place, 'Lat, Lng') || getProp(place, 'Lat/Lng') || getProp(place, 'LatLng');
    const coords = latLngStr ? latLngStr.split(',').map(c => parseFloat(c.trim())) : [0, 0];

    const isFav = favourite && favourite.toLowerCase().trim() === 'yes';
    const favBadge = isFav ? ' ⭐' : '';

    // Generate a unique ID string per spot based on name or array position
    const cardId = `card-${name ? name.replace(/\s+/g, '-').toLowerCase() : index}`;

    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.setAttribute('data-card-id', cardId); // Set matching ID attribute
    card.innerHTML = `
      <h3>${name || 'Unnamed Spot'}${favBadge}</h3>
      <p><strong>${cuisine || 'Food'}</strong> ${region ? '• ' + region : ''}</p>
      <p style="color: #888; font-size: 0.8rem; margin-top: 2px;">${getProp(place, 'Address') || ''}</p>
    `;

    card.addEventListener('click', () => {
      map.flyTo([coords[0], coords[1]], 16);
      openDetailModal(place);
    });

    listContainer.appendChild(card);
  });
}

// Update Sidebar based on current Map Viewport (excluding "ITS" types)
function updateVisibleSidebar() {
  const bounds = map.getBounds();
  
  const visibleRestaurants = allRestaurants.filter(place => {
    // 1. Exclude if Type is "ITS"
    const type = getProp(place, 'Type');
    if (type && type.toString().trim().toUpperCase() === 'ITS') {
      return false;
    }

    // 2. Check if within current map viewport
    return isRestaurantVisible(place, bounds);
  });

  renderSidebar(visibleRestaurants);
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

// helper function to read column values safely
function getProp(obj, keyName) {
  if (!obj) return undefined;
  const target = keyName.toLowerCase().trim();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === target);
  return foundKey ? obj[foundKey] : undefined;
}

// Check if restaurant coordinates fall within visible map bounds
function isRestaurantVisible(place, bounds) {
  const latLngStr = getProp(place, 'Lat, Lng') || getProp(place, 'Lat/Lng') || getProp(place, 'LatLng');
  if (!latLngStr || typeof latLngStr !== 'string') return false;

  const coords = latLngStr.split(',').map(c => parseFloat(c.trim()));
  const lat = coords[0];
  const lng = coords[1];

  if (isNaN(lat) || isNaN(lng)) return false;

  // Leaflet bounds check
  return bounds.contains([lat, lng]);
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

// pins
const pinBlue = L.icon({
  iconUrl: 'img/pin_blue.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});
const pinHoverBlue = L.icon({
  iconUrl: 'img/pinhover_blue.png',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});
const pinRed = L.icon({
  iconUrl: 'img/pin_red.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});
const pinHoverRed = L.icon({
  iconUrl: 'img/pinhover_red.png',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});
const pinGreen = L.icon({
  iconUrl: 'img/pin_green.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});
const pinHoverGreen = L.icon({
  iconUrl: 'img/pinhover_green.png',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});
const pinHeart = L.icon({
  iconUrl: 'img/pin_heart.png',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});
const pinHoverHeart = L.icon({
  iconUrl: 'img/pinhover_heart.png',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});