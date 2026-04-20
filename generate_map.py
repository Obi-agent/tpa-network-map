"""
This script processes an Excel spreadsheet of global assistance partners and
generates an interactive map with color‑coded markers. Each marker
represents a third‑party administrator (TPA) company and displays key
contact information in a popup. The marker color reflects whether the
mutual agreement has been fully signed (green) or not yet completed
(orange).

Usage:
    python generate_map.py --input <path_to_excel> --output <path_to_html>

The default input file is ``XX_Global Assistance Partners IN PROGRESS.xlsx``
in the current working directory and the default output map is
``tpa_network_map.html``.
"""

import argparse
import pandas as pd
import folium
from countryinfo import CountryInfo


def build_manual_coords():
    """Return a dictionary mapping special region names to approximate
    latitude and longitude values. These coordinates are used when the
    ``countryinfo`` library cannot resolve a name or when the name
    represents a region rather than a specific country.
    """
    return {
        'WORLDWIDE MARITIME': (0, 0),
        'WORLDWIDE': (0, 0),
        'Worldwide': (0, 0),
        'AFRICA & GLOBAL': (0, 20),
        'Africa & Global': (0, 20),
        'West Africa': (6, -5),
        'East Africa': (0, 38),
        'Maroc': (31.7917, -7.0926),
        'Asia': (30, 90),
        'All Asia': (30, 90),
        '(Indonesia) Singapore': (1.3521, 103.8198),
        'Vietnam, Laos, Cambodge': (15, 105),
        'Irak, Kurdistan': (35, 44),
        'Korea': (37, 127),
        'UAE': (23.4241, 53.8478),
        'Dubai': (25.2048, 55.2708),
        'Azerbaidjan': (40.1431, 47.5769),
        'Balkans': (42, 22),
        'Europe': (50, 10),
        'Napla / India': (27, 85),
        'Naple / India': (27, 85),
        'Napla': (27, 85),
        'Napla ': (27, 85),
        'LATAM': (-15, -60),
        'Caribean': (18, -77),
        'LATAM / USA': (15, -75),
        'USA/Canada': (45, -100),
        'USA / CANADA': (45, -100),
        'London': (51.5074, -0.1278),
    }


def get_coords(name: str, manual: dict) -> tuple:
    """Return a best‑effort (lat, lon) tuple for a country or region name.

    The function first checks a manual override dictionary for an exact
    match. If not found, it uses the ``countryinfo`` package to look up
    coordinates for the name or the first component of a slash-, comma-,
    or ampersand‑separated string. When all attempts fail, the function
    falls back to (0, 0).

    Args:
        name: A country or region name from the spreadsheet.
        manual: A dictionary of manual coordinate overrides.

    Returns:
        A tuple ``(latitude, longitude)``.
    """
    if not isinstance(name, str):
        return (0.0, 0.0)
    name = name.strip()
    if not name:
        return (0.0, 0.0)
    # direct manual match
    if name in manual:
        return manual[name]
    # attempt lookup via countryinfo
    try:
        latlon = CountryInfo(name).latlng()
        return (latlon[0], latlon[1])
    except Exception:
        # if the name contains separators, try each component
        for sep in ['/', ',', '&']:
            if sep in name:
                parts = [p.strip() for p in name.split(sep)]
                for part in parts:
                    if part in manual:
                        return manual[part]
                    try:
                        latlon = CountryInfo(part).latlng()
                        return (latlon[0], latlon[1])
                    except Exception:
                        continue
        # default fallback to equator/prime meridian
        return (0.0, 0.0)


def assign_color(status: str) -> str:
    """Assign a marker color based on the agreement status.

    Args:
        status: The text from the ``agreement`` column.

    Returns:
        ``"green"`` when the text contains the word ``"signed"`` (case
        insensitive) without also containing ``"waiting"`` or ``"await"``;
        otherwise, ``"orange"``.
    """
    if not isinstance(status, str):
        return 'orange'
    s = status.lower()
    if 'signed' in s and 'waiting' not in s and 'await' not in s:
        return 'green'
    return 'orange'


def build_popup_html(row: pd.Series) -> str:
    """Construct an HTML string for a marker popup from a spreadsheet row."""
    company = row.get('Global Assistance Company', '')
    main_country = row.get('Main Country', '')
    add_countries = row.get('Add. Countries', '')
    ops_email = row.get('Email Operations Department', '')
    ops_247 = row.get('Operations Department  24/7', '')
    network_mgr = row.get('Network Manager', '')
    phone_mgr = row.get('Phone Network Manager', '')
    email_mgr = row.get('E-Mail', '')
    agreement_status = row.get('agreement', '')
    popup = f"""
    <b>{company}</b><br/>
    <b>Main Country:</b> {main_country}<br/>
    <b>Additional Countries:</b> {add_countries}<br/>
    <b>Ops Email:</b> {ops_email}<br/>
    <b>Ops 24/7 Phone:</b> {ops_247}<br/>
    <b>Network Manager:</b> {network_mgr}<br/>
    <b>Phone (Network Manager):</b> {phone_mgr}<br/>
    <b>Email (Network Manager):</b> {email_mgr}<br/>
    <b>Agreement Status:</b> {agreement_status}
    """
    return popup


def generate_map(input_path: str, output_path: str) -> None:
    """Read the spreadsheet, compute coordinates, and build the folium map.

    Args:
        input_path: Path to the Excel file.
        output_path: Path to save the generated HTML map.
    """
    # Load the first sheet containing partner data. The first three header
    # rows contain metadata; the real header starts at row index 3.
    df = pd.read_excel(input_path,
                       sheet_name='List of Global Assistance Partn',
                       header=3)
    # Drop rows without a company name
    df = df[df['Global Assistance Company'].notna()].copy()

    manual = build_manual_coords()
    # Compute coordinates
    coords = df['Main Country'].apply(lambda x: get_coords(x, manual))
    df['lat'] = coords.apply(lambda x: x[0])
    df['lon'] = coords.apply(lambda x: x[1])

    # Determine map center using non‑zero coordinates
    valid = df[(df['lat'] != 0) | (df['lon'] != 0)]
    center_lat = valid['lat'].mean() if not valid.empty else 0.0
    center_lon = valid['lon'].mean() if not valid.empty else 0.0

    # Initialize map
    tpa_map = folium.Map(location=[center_lat, center_lon], zoom_start=2)

    # Add markers
    for _, row in df.iterrows():
        lat, lon = row['lat'], row['lon']
        if pd.isna(lat) or pd.isna(lon):
            continue
        color = assign_color(row.get('agreement', ''))
        popup_html = build_popup_html(row)
        folium.CircleMarker(
            location=[lat, lon],
            radius=6,
            fill=True,
            color=color,
            fill_color=color,
            fill_opacity=0.8,
            popup=folium.Popup(popup_html, max_width=300)
        ).add_to(tpa_map)

    tpa_map.save(output_path)
    print(f"Saved map to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate TPA network map")
    parser.add_argument('--input', '-i', default='XX_Global Assistance Partners IN PROGRESS.xlsx',
                        help='Path to the Excel file with partner data')
    parser.add_argument('--output', '-o', default='tpa_network_map.html',
                        help='Path for the output HTML map')
    args = parser.parse_args()
    generate_map(args.input, args.output)


if __name__ == '__main__':
    main()