// JavaScript logic for the TPA network map with side panel

(function () {
  // Compute map center using non‑zero coordinates
  let sumLat = 0,
    sumLon = 0,
    count = 0;
  providers.forEach((p) => {
    if (p.lat !== 0 || p.lon !== 0) {
      sumLat += p.lat;
      sumLon += p.lon;
      count += 1;
    }
  });
  const centerLat = count ? sumLat / count : 0;
  const centerLon = count ? sumLon / count : 0;

  // Initialize map
  const map = L.map('map', {
    center: [centerLat, centerLon],
    zoom: 2,
    scrollWheelZoom: true,
  });

  // Base layers with English labels and satellite imagery
  const posLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://carto.com/attributions">CARTO</a> contributors',
      maxZoom: 19,
    }
  );
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  });
  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    }
  );

  const baseLayers = {
    'CartoDB Positron': posLayer,
    'OpenStreetMap': osmLayer,
    Satellite: satelliteLayer,
  };
  // Add default layer
  posLayer.addTo(map);
  // Add layer control
  L.control.layers(baseLayers).addTo(map);

  // Determine marker color based on agreement status
  function getColor(status) {
    if (!status || typeof status !== 'string') return 'orange';
    const s = status.toLowerCase();
    if (s.includes('signed') && !s.includes('waiting') && !s.includes('await')) {
      return 'green';
    }
    return 'orange';
  }

  // Build popup HTML for a provider
  function buildPopup(provider) {
    return `
      <div class="popup-content">
        <strong>${provider.name}</strong><br/>
        <b>Type:</b> ${provider.type}<br/>
        <b>Main Country:</b> ${provider.main_country}<br/>
        <b>Additional Countries:</b> ${provider.additional_countries}<br/>
        <b>Ops Email:</b> ${provider.ops_email}<br/>
        <b>Ops 24/7 Phone:</b> ${provider.ops_phone}<br/>
        <b>Network Manager:</b> ${provider.network_manager}<br/>
        <b>Manager Phone:</b> ${provider.manager_phone}<br/>
        <b>Manager Email:</b> ${provider.manager_email}<br/>
        <b>Agreement Status:</b> ${provider.agreement}
      `;
  }

  // Create markers and attach to map
  const markers = [];
  providers.forEach((provider, idx) => {
    const color = getColor(provider.agreement);
    const marker = L.circleMarker([provider.lat, provider.lon], {
      radius: 6,
      color: color,
      fillColor: color,
      weight: 1,
      fillOpacity: 0.8,
    });
    marker.bindPopup(buildPopup(provider));
    marker.on('click', () => {
      highlightProvider(idx);
    });
    marker.addTo(map);
    markers.push(marker);
  });

  // Summary text update
  function updateSummary() {
    const text = `Total providers: ${summary.total} — Signed: ${summary.signed} — Pending: ${summary.pending}`;
    document.getElementById('summaryText').textContent = text;
  }

  updateSummary();

  // Filter state and search
  let currentFilter = 'all';

  document.getElementById('filterAll').addEventListener('click', () => {
    setFilter('all');
  });
  document.getElementById('filterSigned').addEventListener('click', () => {
    setFilter('signed');
  });
  document.getElementById('filterPending').addEventListener('click', () => {
    setFilter('pending');
  });

  function setFilter(filter) {
    currentFilter = filter;
    // Update button classes
    ['filterAll', 'filterSigned', 'filterPending'].forEach((id) => {
      document.getElementById(id).classList.remove('active');
    });
    if (filter === 'signed') document.getElementById('filterSigned').classList.add('active');
    else if (filter === 'pending') document.getElementById('filterPending').classList.add('active');
    else document.getElementById('filterAll').classList.add('active');
    updateList();
  }

  document.getElementById('searchInput').addEventListener('input', () => {
    updateList();
  });

  // Build provider list based on current filter and search query
  function updateList() {
    const listEl = document.getElementById('providerList');
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    listEl.innerHTML = '';
    providers.forEach((provider, idx) => {
      // filter by agreement
      const isSigned = getColor(provider.agreement) === 'green';
      if (
        (currentFilter === 'signed' && !isSigned) ||
        (currentFilter === 'pending' && isSigned)
      ) {
        return;
      }
      // filter by search
      if (
        searchQuery &&
        !provider.name.toLowerCase().includes(searchQuery) &&
        !provider.main_country.toLowerCase().includes(searchQuery)
      ) {
        return;
      }
      const li = document.createElement('li');
      li.textContent = provider.name;
      li.dataset.index = idx;
      li.addEventListener('click', () => {
        highlightProvider(idx);
        markers[idx].openPopup();
        map.setView([provider.lat, provider.lon], 4);
      });
      listEl.appendChild(li);
    });
  }

  // Highlight selected provider in the list
  function highlightProvider(index) {
    const items = document.querySelectorAll('#providerList li');
    items.forEach((item) => item.classList.remove('active'));
    const target = document.querySelector(`#providerList li[data-index="${index}"]`);
    if (target) {
      target.classList.add('active');
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  // Initial filter set to all and populate list
  setFilter('all');
})();
