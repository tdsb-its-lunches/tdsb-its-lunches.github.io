import urllib.request
import xml.etree.ElementTree as ET
import json
import os

# 1. Replace YOUR_MAP_ID with your actual map ID from Step 1
KML_URL = 'https://www.google.com/maps/d/kml?mid=1O0RXbcC3VxTbI9mXsxr8RoI8eD-aaBM&forcekml=1'

# 2. Adjust output path to wherever your static site reads data from
OUTPUT_FILE = 'src/places.json'

def fetch_and_convert():
    print("Fetching KML data from Google My Maps...")
    req = urllib.request.Request(KML_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        kml_data = response.read()

    root = ET.fromstring(kml_data)
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    places = []

    # Parse each location in the KML file
    for placemark in root.findall('.//kml:Placemark', ns):
        name_el = placemark.find('kml:name', ns)
        desc_el = placemark.find('kml:description', ns)
        coord_el = placemark.find('.//kml:coordinates', ns)

        name = name_el.text.strip() if name_el is not None and name_el.text else 'Unnamed Location'
        description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''
        
        lat, lng = None, None
        if coord_el is not None and coord_el.text:
            coords = coord_el.text.strip().split(',')
            if len(coords) >= 2:
                lng = float(coords[0])
                lat = float(coords[1])

        places.append({
            'name': name,
            'description': description,
            'lat': lat,
            'lng': lng
        })

    # Save to JSON file
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(places, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved {len(places)} locations to {OUTPUT_FILE}")

if __name__ == '__main__':
    fetch_and_convert()