import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
import re
import time

# Cache buster parameter (_t) forces Google to output fresh KML data
KML_URL = f'https://www.google.com/maps/d/kml?forcekml=1&mid=1O0RXbcC3VxTbI9mXsxr8RoI8eD-aaBM&_t={int(time.time())}'
OUTPUT_FILE = 'places.json'

def fetch_intersections_in_batch(places_needing_address):
    """
    Queries OpenStreetMap Overpass API for ALL coordinates in a single request.
    Returns a dictionary mapping (lat, lng) -> "Road A & Road B".
    """
    if not places_needing_address:
        return {}

    # Build multi-location Overpass QL query
    around_queries = []
    for p in places_needing_address:
        around_queries.append(f'way(around:500,{p["latitude"]},{p["longitude"]})["highway"~"primary|secondary|trunk"]["name"];')
    
    combined_around = "\n".join(around_queries)
    overpass_ql = f"""
    [out:json][timeout:20];
    (
      {combined_around}
    );
    out tags center;
    """

    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({'data': overpass_ql}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'FastMapExporterScript/1.0'})

    intersections = {}

    try:
        print("Batch looking up intersections on OpenStreetMap...")
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8'))
            elements = result.get('elements', [])

            # Match returned ways back to each location by distance
            for p in places_needing_address:
                plat, plng = p['latitude'], p['longitude']
                nearby_roads = []

                for el in elements:
                    road_name = el.get('tags', {}).get('name')
                    center = el.get('center', {})
                    clat, clng = center.get('lat'), center.get('lon')

                    if road_name and clat and clng:
                        # Simple Euclidean distance check (~150m boundary)
                        dist = ((plat - clat)**2 + (plng - clng)**2) ** 0.5
                        if dist < 0.002 and road_name not in nearby_roads:
                            nearby_roads.append(road_name)

                if len(nearby_roads) >= 2:
                    intersections[(plat, plng)] = f"{nearby_roads[0]} & {nearby_roads[1]}"
                elif len(nearby_roads) == 1:
                    intersections[(plat, plng)] = f"Near {nearby_roads[0]}"

    except Exception as e:
        print(f"Batch Overpass lookup failed: {e}")

    return intersections

def fetch_and_convert():
    print("Fetching KML dataset from Google My Maps...")
    req = urllib.request.Request(KML_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        kml_data = response.read()

    root = ET.fromstring(kml_data)
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    raw_places = []

    # Iterate through Folders (Layers)
    folders = root.findall('.//kml:Folder', ns)
    search_containers = folders if folders else [root]

    for container in search_containers:
        layer_name_el = container.find('kml:name', ns)
        layer_name = layer_name_el.text.strip() if layer_name_el is not None and layer_name_el.text else 'Default Layer'

        for placemark in container.findall('.//kml:Placemark', ns):
            placemark_id = placemark.get('id') or ''
            
            # Name
            name_el = placemark.find('kml:name', ns)
            name = name_el.text.strip() if name_el is not None and name_el.text else 'Unnamed Location'

            # Description
            desc_el = placemark.find('kml:description', ns)
            raw_description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''
            clean_description = ' '.join(re.sub(r'<[^>]+>', ' ', raw_description).split())

            # Coordinates
            coord_el = placemark.find('.//kml:coordinates', ns)
            lat, lng = None, None
            if coord_el is not None and coord_el.text:
                coords = coord_el.text.strip().split(',')
                if len(coords) >= 2:
                    lng = float(coords[0])
                    lat = float(coords[1])

            # Explicit Address from Google
            address = ''
            for data in placemark.findall('.//kml:Data', ns):
                if data.get('name') in ['address', 'Address', 'location']:
                    val_el = data.find('kml:value', ns)
                    if val_el is not None and val_el.text:
                        address = val_el.text.strip()

            for simple_data in placemark.findall('.//kml:SimpleData', ns):
                if simple_data.get('name') in ['address', 'Address', 'location'] and simple_data.text:
                    address = simple_data.text.strip()

            raw_places.append({
                'id': placemark_id,
                'name': name,
                'layer': layer_name,
                'description': clean_description,
                'address': address,
                'latitude': lat,
                'longitude': lng
            })

    # Collect items that need address lookup
    needing_lookup = [p for p in raw_places if not p['address'] and p['latitude'] and p['longitude']]
    
    # Run 1 single batch lookup for all locations
    intersections = fetch_intersections_in_batch(needing_lookup)

    places = []
    for p in raw_places:
        address = p['address']
        lat, lng = p['latitude'], p['longitude']
        name = p['name']

        # Fill missing address from batch result
        if not address and (lat, lng) in intersections:
            address = intersections[(lat, lng)]

        # Navigation & Search URLs
        google_maps_url = ""
        google_maps_dir_url = ""

        if address:
            query = f"{name} {address}"
            encoded_query = urllib.parse.quote(query)
            google_maps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"
            google_maps_dir_url = f"https://www.google.com/maps/dir/?api=1&destination={encoded_query}"
        elif lat and lng:
            query = f"{name}@{lat},{lng}"
            encoded_query = urllib.parse.quote(query)
            google_maps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"
            google_maps_dir_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"

        places.append({
            'id': p['id'],
            'name': name,
            'layer': p['layer'],
            'description': p['description'],
            'address': address,
            'latitude': lat,
            'longitude': lng,
            'google_maps_url': google_maps_url,
            'google_maps_directions_url': google_maps_dir_url
        })

    # Save output to places.json
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(places, f, indent=2, ensure_ascii=False)

    print(f"Done! Successfully saved {len(places)} locations to {OUTPUT_FILE}")

if __name__ == '__main__':
    fetch_and_convert()