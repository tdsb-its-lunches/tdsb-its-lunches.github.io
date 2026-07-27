import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
import re
import time

KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1O0RXbcC3VxTbI9mXsxr8RoI8eD-aaBM'
OUTPUT_FILE = 'places.json'

def get_major_intersection_osm(lat, lng):
    """
    Queries OpenStreetMap Overpass API to find the closest major roads 
    using the 'highway' key (primary, secondary, tertiary, trunk) and 
    formats them into a major intersection or cross-street.
    """
    if not lat or not lng:
        return ""

    # Overpass QL: Find major roads within 150 meters with a valid name
    overpass_ql = f"""
    [out:json][timeout:10];
    way(around:150,{lat},{lng})["highway"~"primary|secondary|tertiary|trunk"]["name"];
    out tags;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({'data': overpass_ql}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'MyMapExporterScript/1.0'})

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            elements = result.get('elements', [])
            
            # Extract unique road names
            major_roads = []
            for el in elements:
                road_name = el.get('tags', {}).get('name')
                if road_name and road_name not in major_roads:
                    major_roads.append(road_name)

            # Format intersection based on detected major roads
            if len(major_roads) >= 2:
                return f"{major_roads[0]} & {major_roads[1]}"
            elif len(major_roads) == 1:
                return f"Near {major_roads[0]}"

    except Exception as e:
        print(f"Overpass API lookup failed for {lat},{lng}: {e}")

    return ""

def fetch_and_convert():
    print("Fetching KML dataset from Google My Maps...")
    req = urllib.request.Request(KML_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        kml_data = response.read()

    root = ET.fromstring(kml_data)
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    places = []

    # Iterate through Folders (Layers in Google My Maps)
    folders = root.findall('.//kml:Folder', ns)
    search_containers = folders if folders else [root]

    for container in search_containers:
        layer_name_el = container.find('kml:name', ns)
        layer_name = layer_name_el.text.strip() if layer_name_el is not None and layer_name_el.text else 'Default Layer'

        for placemark in container.findall('.//kml:Placemark', ns):
            placemark_id = placemark.get('id') or ''
            
            # --- Name ---
            name_el = placemark.find('kml:name', ns)
            name = name_el.text.strip() if name_el is not None and name_el.text else 'Unnamed Location'

            # --- Description ---
            desc_el = placemark.find('kml:description', ns)
            raw_description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''
            
            # Clean HTML tags and collapse whitespace
            clean_description = re.sub(r'<[^>]+>', ' ', raw_description)
            clean_description = ' '.join(clean_description.split())

            # --- Coordinates ---
            coord_el = placemark.find('.//kml:coordinates', ns)
            lat, lng = None, None
            if coord_el is not None and coord_el.text:
                coords = coord_el.text.strip().split(',')
                if len(coords) >= 2:
                    lng = float(coords[0])
                    lat = float(coords[1])

            # --- Address / Major Intersection ---
            address = ''
            
            # 1. Try to get explicit Google Maps address if present
            for data in placemark.findall('.//kml:Data', ns):
                if data.get('name') in ['address', 'Address', 'location']:
                    val_el = data.find('kml:value', ns)
                    if val_el is not None and val_el.text:
                        address = val_el.text.strip()

            for simple_data in placemark.findall('.//kml:SimpleData', ns):
                if simple_data.get('name') in ['address', 'Address', 'location'] and simple_data.text:
                    address = simple_data.text.strip()

            # 2. If no address was exported, look up closest major road intersection
            if not address and lat and lng:
                address = get_major_intersection_osm(lat, lng)
                # Polite rate-limiting for Overpass API
                time.sleep(1)

            # --- Navigation & Search URLs ---
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

            # --- Output Object Structure ---
            places.append({
                'id': placemark_id,
                'name': name,
                'layer': layer_name,
                'description': clean_description,
                'address': address,
                'latitude': lat,
                'longitude': lng,
                'google_maps_url': google_maps_url,
                'google_maps_directions_url': google_maps_dir_url
            })

    # Save output to places.json at root directory
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(places, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved {len(places)} locations to {OUTPUT_FILE}")

if __name__ == '__main__':
    fetch_and_convert()