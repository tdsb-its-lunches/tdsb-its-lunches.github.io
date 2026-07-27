import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
import re
import time

KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1O0RXbcC3VxTbI9mXsxr8RoI8eD-aaBM'
OUTPUT_FILE = 'places.json'

def get_nearest_intersection(lat, lng):
    """Fetches nearest streets/intersection using OpenStreetMap (Nominatim)."""
    if not lat or not lng:
        return ""
    
    try:
        # Nominatim reverse geocode endpoint
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=17&addressdetails=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'MyMapExporterScript/1.0'})
        
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            address_data = data.get('address', {})
            
            road = address_data.get('road') or address_data.get('pedestrian') or address_data.get('street')
            suburb = address_data.get('neighbourhood') or address_data.get('suburb') or address_data.get('city_district')
            
            if road and suburb:
                return f"Near {road} ({suburb})"
            elif road:
                return f"Near {road}"
            elif suburb:
                return suburb
    except Exception as e:
        print(f"Failed to fetch intersection for {lat},{lng}: {e}")
        
    return ""

def fetch_and_convert():
    print("Fetching KML dataset from Google My Maps...")
    req = urllib.request.Request(KML_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        kml_data = response.read()

    root = ET.fromstring(kml_data)
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    places = []

    # Iterate through Folders (Layers in My Maps)
    folders = root.findall('.//kml:Folder', ns)
    search_containers = folders if folders else [root]

    for container in search_containers:
        layer_name_el = container.find('kml:name', ns)
        layer_name = layer_name_el.text.strip() if layer_name_el is not None and layer_name_el.text else 'Default Layer'

        for placemark in container.findall('.//kml:Placemark', ns):            
            # --- Name ---
            name_el = placemark.find('kml:name', ns)
            name = name_el.text.strip() if name_el is not None and name_el.text else 'Unnamed Location'

            # --- Description ---
            desc_el = placemark.find('kml:description', ns)
            raw_description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''
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

            # --- Address / Intersection ---
            address = ''
            
            # 1. Try to get standard Google Maps address if present
            for data in placemark.findall('.//kml:Data', ns):
                if data.get('name') in ['address', 'Address', 'location']:
                    val_el = data.find('kml:value', ns)
                    if val_el is not None and val_el.text:
                        address = val_el.text.strip()

            for simple_data in placemark.findall('.//kml:SimpleData', ns):
                if simple_data.get('name') in ['address', 'Address', 'location'] and simple_data.text:
                    address = simple_data.text.strip()

            # 2. If Google didn't give a full address, lookup nearest street/intersection from coordinates
            if not address and lat and lng:
                address = get_nearest_intersection(lat, lng)
                # Respect OpenStreetMap rate limit (1 request per second)
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

            # --- Lean JSON Output ---
            places.append({
                'name': name,
                'layer': layer_name,
                'description': clean_description,
                'address': address,
                'latitude': lat,
                'longitude': lng,
                'google_maps_url': google_maps_url,
                'google_maps_directions_url': google_maps_dir_url
            })

    # Save to JSON in root
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(places, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved {len(places)} locations to {OUTPUT_FILE}")

if __name__ == '__main__':
    fetch_and_convert()