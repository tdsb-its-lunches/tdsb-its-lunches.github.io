import urllib.request
import xml.etree.ElementTree as ET
import json
import os
import re

KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1O0RXbcC3VxTbI9mXsxr8RoI8eD-aaBM'
OUTPUT_FILE = 'src/data/places.json'

def fetch_and_convert_all():
    print("Fetching complete KML dataset from Google My Maps...")
    req = urllib.request.Request(KML_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        kml_data = response.read()

    root = ET.fromstring(kml_data)
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}

    # 1. Map all Style IDs to their actual Icon Image URLs and Colors
    styles_map = {}
    for style in root.findall('.//kml:Style', ns):
        style_id = style.get('id')
        if not style_id:
            continue
        
        icon_href = None
        icon_color = None
        
        icon_style = style.find('kml:IconStyle', ns)
        if icon_style is not None:
            color_el = icon_style.find('kml:color', ns)
            if color_el is not None and color_el.text:
                icon_color = color_el.text.strip()
            
            icon_el = icon_style.find('kml:Icon/kml:href', ns)
            if icon_el is not None and icon_el.text:
                icon_href = icon_el.text.strip()
                
        styles_map[f"#{style_id}"] = {
            'icon_url': icon_href,
            'color_kml_hex': icon_color
        }

    places = []

    # 2. Iterate through Folders (Layers in My Maps)
    folders = root.findall('.//kml:Folder', ns)
    # Fallback to scanning whole document if no folders exist
    search_containers = folders if folders else [root]

    for container in search_containers:
        layer_name_el = container.find('kml:name', ns)
        layer_name = layer_name_el.text.strip() if layer_name_el is not None and layer_name_el.text else 'Default Layer'

        for placemark in container.findall('.//kml:Placemark', ns):
            placemark_id = placemark.get('id') or ''
            
            # --- Name ---
            name_el = placemark.find('kml:name', ns)
            name = name_el.text.strip() if name_el is not None and name_el.text else 'Unnamed Location'

            # --- Description (Raw & Clean) ---
            desc_el = placemark.find('kml:description', ns)
            raw_description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''
            
            # Extract image URLs embedded in HTML description
            images = re.findall(r'src=["\'](https?://[^"\']+)["\']', raw_description)
            
            # Clean HTML to get plain text description
            clean_description = re.sub(r'<[^>]+>', ' ', raw_description)
            clean_description = ' '.join(clean_description.split())

            # --- Coordinates & Geometry ---
            coord_el = placemark.find('.//kml:coordinates', ns)
            lat, lng, elevation = None, None, None
            if coord_el is not None and coord_el.text:
                coords = coord_el.text.strip().split(',')
                if len(coords) >= 2:
                    lng = float(coords[0])
                    lat = float(coords[1])
                if len(coords) >= 3:
                    elevation = float(coords[2])

            # --- Extended / Custom Table Data ---
            custom_data = {}
            for data in placemark.findall('.//kml:Data', ns):
                d_name = data.get('name')
                val_el = data.find('kml:value', ns)
                if d_name and val_el is not None and val_el.text:
                    custom_data[d_name] = val_el.text.strip()

            for simple_data in placemark.findall('.//kml:SimpleData', ns):
                sd_name = simple_data.get('name')
                if sd_name and simple_data.text:
                    custom_data[sd_name] = simple_data.text.strip()

            # --- Extract Known Attributes from Custom Data ---
            address = custom_data.get('address') or custom_data.get('Address') or custom_data.get('location') or ''
            phone = custom_data.get('phone') or custom_data.get('Phone Number') or custom_data.get('tel') or ''
            website = custom_data.get('website') or custom_data.get('Website') or custom_data.get('url') or ''

            # --- 5. Generate Navigation & Search URLs ---
            google_maps_url = ""
            google_maps_dir_url = ""

            # Prefer searching by Name + Address for exact business matching
            if address:
                query = f"{name} {address}"
                encoded_query = urllib.parse.quote(query)
                google_maps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"
                google_maps_dir_url = f"https://www.google.com/maps/dir/?api=1&destination={encoded_query}"
            elif lat and lng:
                # Fallback to Name + Coordinates
                query = f"{name}@{lat},{lng}"
                encoded_query = urllib.parse.quote(query)
                google_maps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"
                google_maps_dir_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"

            # --- Style & Icon Info ---
            style_url_el = placemark.find('kml:styleUrl', ns)
            style_url = style_url_el.text.strip() if style_url_el is not None and style_url_el.text else ''
            style_info = styles_map.get(style_url, {'icon_url': None, 'color_kml_hex': None})

            # --- Assemble Everything into JSON Object ---
            places.append({
                'id': placemark_id,
                'name': name,
                'layer': layer_name,
                'description': {
                    'raw_html': raw_description,
                    'clean_text': clean_description
                },
                'location': {
                    'address': address,
                    'latitude': lat,
                    'longitude': lng,
                    'elevation': elevation
                },
                'contact': {
                    'phone': phone,
                    'website': website
                },
                'links': {
                    'google_maps_search': google_maps_url,
                    'google_maps_directions': google_maps_dir_url
                },
                'media': {
                    'images': images
                },
                'style': {
                    'style_id': style_url,
                    'icon_url': style_info['icon_url'],
                    'color_kml_hex': style_info['color_kml_hex']
                },
                'custom_table_columns': custom_data
            })

    # Save to JSON
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(places, f, indent=2, ensure_ascii=False)

    print(f"Successfully extracted {len(places)} places with ALL metadata to {OUTPUT_FILE}")

if __name__ == '__main__':
    fetch_and_convert_all()