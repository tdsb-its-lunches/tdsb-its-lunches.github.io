import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import re
import time

# Cache buster parameter (_t) forces Google to output fresh KML data
KML_URL = f'https://www.google.com/maps/d/kml?forcekml=1&mid=1O0RXbcC3VxTbI9mXsxr8RoI8eD-aaBM&_t={int(time.time())}'
OUTPUT_FILE = 'places.json'

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
            
            # 1. Remove HTML tags
            clean_description = re.sub(r'<[^>]+>', ' ', raw_description)
            
            # 2. Strip leading "description:" label
            clean_description = re.sub(r'^description:\s*', '', clean_description, flags=re.IGNORECASE)
            
            # 3. Strip trailing "fav:" tag and anything following it (e.g., "fav:", "fav: true", "fav: false")
            clean_description = re.sub(r'\bfav:\s*\w*$', '', clean_description, flags=re.IGNORECASE)
            
            # 4. Clean up leftover whitespace
            clean_description = ' '.join(clean_description.split())

            # --- Coordinates ---
            coord_el = placemark.find('.//kml:coordinates', ns)
            lat, lng = None, None
            if coord_el is not None and coord_el.text:
                coords = coord_el.text.strip().split(',')
                if len(coords) >= 2:
                    lng = float(coords[0])
                    lat = float(coords[1])

            # --- Favorite Flag ---
            is_fav = False
            
            # 1. Check ExtendedData tags (where My Maps exports table columns)
            for data_el in placemark.findall('.//kml:ExtendedData//kml:Data', ns) + placemark.findall('.//kml:ExtendedData//kml:SimpleData', ns):
                attr_name = data_el.attrib.get('name', '').lower()
                if attr_name == 'fav':
                    val_el = data_el.find('kml:value', ns)
                    val_text = val_el.text.strip() if val_el is not None and val_el.text else (data_el.text or '')
                    if val_text.lower() in ['true', '1', 'yes']:
                        is_fav = True
                        break

            # 2. Fallback: Parse description string if custom column was merged into description text
            if not is_fav and 'fav: true' in raw_description.lower():
                is_fav = True

            # --- Navigation & Search URLs ---
            google_maps_url = ""
            google_maps_dir_url = ""

            if lat and lng:
                query = f"{name}@{lat},{lng}"
                encoded_query = urllib.parse.quote(query)
                google_maps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"
                google_maps_dir_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"

            # --- Clean JSON Output ---
            places.append({
                'name': name,
                'layer': layer_name,
                'description': clean_description,
                'fav': is_fav,
                'latitude': lat,
                'longitude': lng,
                'google_maps_url': google_maps_url,
                'google_maps_directions_url': google_maps_dir_url
            })

    # --- Build top-level payload with ISO timestamp ---
    from datetime import datetime, timezone
    
    output_payload = {
        'last_updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'count': len(places),
        'places': places
    }

    # Save to JSON in root
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved {len(places)} locations to {OUTPUT_FILE}")

if __name__ == '__main__':
    fetch_and_convert()

