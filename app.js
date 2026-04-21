// JavaScript logic for the provider network map with category and status filters.

(async function () {
  const tpaProviders = typeof providers !== 'undefined' ? providers : [];
  const groundProviders = await getGroundProviders();
  const airProviders = await getAirProviders();
  const medicalEscortProviders = await getMedicalEscortProviders();

  const allProviders = [...tpaProviders, ...groundProviders, ...airProviders, ...medicalEscortProviders]
    .filter((provider) => Number.isFinite(Number(provider.lat)) && Number.isFinite(Number(provider.lon)))
    .map((provider, index) => ({
      ...provider,
      lat: Number(provider.lat),
      lon: Number(provider.lon),
      type: provider.type || 'TPA',
      _index: index,
    }));

  const fieldDefinitions = {
    TPA: [
      ['Type', 'type'],
      ['Main Country', 'main_country'],
      ['Additional Countries', 'additional_countries'],
      ['Ops Email', 'ops_email'],
      ['Ops 24/7 Phone', 'ops_phone'],
      ['Network Manager', 'network_manager'],
      ['Manager Phone', 'manager_phone'],
      ['Manager Email', 'manager_email'],
      ['Agreement Status', 'agreement'],
    ],
    'Ground Ambulance': [
      ['Type', 'type'],
      ['Location', 'main_country'],
      ['Region', 'region'],
      ['Covered Zones', 'covered_zones'],
      ['Contact', 'network_manager'],
      ['Website', 'website'],
      ['Phone', 'ops_phone'],
      ['Coordination Email', 'ops_email'],
      ['Logistics Email', 'manager_email'],
      ['Address', 'address'],
      ['City', 'city'],
      ['24/7', 'service_24_7'],
      ['Tarmac Access', 'tarmac_access'],
      ['BLS / ALS', 'bls_als'],
      ['Own Medical Crew', 'own_medical_crew'],
      ['Equipment List', 'equipment_list'],
      ['Time of Response', 'time_of_response'],
      ['Certifications', 'certifications'],
      ['Insurance', 'insurance'],
      ['Notes', 'comments'],
      ['Agreement Status', 'agreement'],
    ],
    'Air Ambulance': [
      ['Type', 'type'],
      ['Location', 'main_country'],
      ['Country', 'country'],
      ['City', 'city'],
      ['Region', 'region'],
      ['Certification', 'certification'],
      ['Contact', 'network_manager'],
      ['Website', 'website'],
      ['Phone', 'ops_phone'],
      ['Coordination Email', 'ops_email'],
      ['Logistics Email', 'manager_email'],
      ['Address', 'address'],
      ['Notes', 'comments'],
      ['Agreement Status', 'agreement'],
    ],
    'Medical Escort': [
      ['Type', 'type'],
      ['Location', 'main_country'],
      ['Country', 'country'],
      ['City', 'city'],
      ['Region', 'region'],
      ['Covered Zones', 'covered_zones'],
      ['Contact', 'network_manager'],
      ['Website', 'website'],
      ['Phone', 'ops_phone'],
      ['Coordination Email', 'ops_email'],
      ['Secondary Email', 'manager_email'],
      ['Address', 'address'],
      ['Notes', 'comments'],
      ['Agreement Status', 'agreement'],
    ],
  };

  const categoryOrder = [
    'TPA',
    'Ground Ambulance',
    'Air Ambulance',
    'Medical Escort',
    'Hospital/Clinic',
  ];

  const categories = [
    ...categoryOrder.filter((category) => allProviders.some((p) => p.type === category)),
    ...Array.from(new Set(allProviders.map((p) => p.type))).filter(
      (category) => !categoryOrder.includes(category)
    ),
  ];

  let currentStatusFilter = 'all';
  let currentCategoryFilter = 'all';

  function getGroundProviders() {
    if (typeof groundAmbulanceProvidersPromise !== 'undefined') {
      return groundAmbulanceProvidersPromise;
    }
    if (typeof groundAmbulanceProviders !== 'undefined') {
      return Promise.resolve(groundAmbulanceProviders);
    }
    return Promise.resolve([]);
  }

  function getAirProviders() {
    if (typeof airAmbulanceProvidersPromise !== 'undefined') {
      return airAmbulanceProvidersPromise;
    }
    if (typeof airAmbulanceProviders !== 'undefined') {
      return Promise.resolve(airAmbulanceProviders);
    }
    return Promise.resolve([]);
  }

  function getMedicalEscortProviders() {
    if (typeof medicalEscortProvidersPromise !== 'undefined') {
      return medicalEscortProvidersPromise;
    }
    if (typeof medicalEscortProviders !== 'undefined') {
      return Promise.resolve(medicalEscortProviders);
    }
    return Promise.resolve([]);
  }

  const worldBounds = L.latLngBounds([[-85, -180], [85, 180]]);
  const mapCenter = computeMapCenter(allProviders);
  const map = L.map('map', {
    center: mapCenter,
    zoom: 2,
    minZoom: 2,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    scrollWheelZoom: true,
    maxBounds: worldBounds,
    maxBoundsViscosity: 1,
    worldCopyJump: false,
  });

  const posLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href=\'https://carto.com/attributions\'>CARTO</a> contributors',
      maxZoom: 19,
      noWrap: true,
      bounds: worldBounds,
    }
  );
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    noWrap: true,
    bounds: worldBounds,
  });
  const satelliteImageryLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Imagery &copy; Esri',
      maxZoom: 19,
      noWrap: true,
      bounds: worldBounds,
    }
  );
  const satelliteLabelsLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Labels &copy; Esri',
      maxZoom: 19,
      noWrap: true,
      bounds: worldBounds,
    }
  );
  const satelliteLayer = L.layerGroup([satelliteImageryLayer, satelliteLabelsLayer]);

  satelliteLayer.addTo(map);
  constrainWorldView();
  map.on('resize', constrainWorldView);

  L.control
    .layers({
      'Satellite with labels': satelliteLayer,
      'Light map': posLayer,
      OpenStreetMap: osmLayer,
    })
    .addTo(map);

  const markers = allProviders.map((provider) => {
    const marker = L.marker([provider.lat, provider.lon], {
      icon: createProviderIcon(provider),
      riseOnHover: true,
    });
    marker.bindPopup(buildPopup(provider));
    marker.on('click', () => highlightProvider(provider._index));
    marker.addTo(map);
    return marker;
  });

  initializeCategoryFilters();
  initializeStatusFilters();
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  applyFilters();

  function computeMapCenter(providerList) {
    let sumLat = 0;
    let sumLon = 0;
    let count = 0;
    providerList.forEach((provider) => {
      if (provider.lat !== 0 || provider.lon !== 0) {
        sumLat += provider.lat;
        sumLon += provider.lon;
        count += 1;
      }
    });
    return count ? [sumLat / count, sumLon / count] : [0, 0];
  }

  function initializeCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    container.innerHTML = '';
    createCategoryButton(container, 'all', 'All categories');
    categories.forEach((category) => createCategoryButton(container, category, category));
  }

  function createCategoryButton(container, value, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.category = value;
    if (value === currentCategoryFilter) button.classList.add('active');
    button.addEventListener('click', () => {
      currentCategoryFilter = value;
      document
        .querySelectorAll('#categoryFilters button')
        .forEach((item) => item.classList.toggle('active', item.dataset.category === value));
      applyFilters();
    });
    container.appendChild(button);
  }

  function initializeStatusFilters() {
    const buttons = {
      filterAll: 'all',
      filterSigned: 'signed',
      filterPending: 'pending',
    };
    Object.entries(buttons).forEach(([id, value]) => {
      document.getElementById(id).addEventListener('click', () => {
        currentStatusFilter = value;
        Object.keys(buttons).forEach((buttonId) => {
          document.getElementById(buttonId).classList.toggle('active', buttonId === id);
        });
        applyFilters();
      });
    });
  }

  function getColor(status) {
    if (!status || typeof status !== 'string') return 'orange';
    const normalized = status.toLowerCase();
    if (
      normalized.includes('signed') &&
      !normalized.includes('waiting') &&
      !normalized.includes('await')
    ) {
      return 'green';
    }
    return 'orange';
  }

  function isSigned(provider) {
    return getColor(provider.agreement) === 'green';
  }

  function matchesProvider(provider, searchQuery) {
    if (currentCategoryFilter !== 'all' && provider.type !== currentCategoryFilter) return false;
    if (currentStatusFilter === 'signed' && !isSigned(provider)) return false;
    if (currentStatusFilter === 'pending' && isSigned(provider)) return false;
    if (!searchQuery) return true;

    const searchable = [
      provider.name,
      provider.type,
      provider.main_country,
      provider.region,
      provider.country,
      provider.city,
      provider.additional_countries,
      provider.covered_zones,
      provider.certification,
      provider.network_manager,
      provider.ops_email,
      provider.manager_email,
      provider.address,
      provider.comments,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(searchQuery);
  }

  function applyFilters() {
    const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
    const visibleProviders = [];

    allProviders.forEach((provider) => {
      const visible = matchesProvider(provider, searchQuery);
      const marker = markers[provider._index];
      if (visible) {
        visibleProviders.push(provider);
        if (!map.hasLayer || !map.hasLayer(marker)) marker.addTo(map);
      } else if (map.hasLayer && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });

    updateSummary(visibleProviders);
    updateList(visibleProviders, searchQuery);
  }

  function summarize(providerList) {
    const signed = providerList.filter(isSigned).length;
    return {
      total: providerList.length,
      signed,
      pending: providerList.length - signed,
    };
  }

  function updateSummary(visibleProviders) {
    const total = summarize(allProviders);
    const visible = summarize(visibleProviders);
    let text = `Total providers: ${total.total} - Signed: ${total.signed} - Pending: ${total.pending}`;
    if (visible.total !== total.total) {
      text += ` - Showing: ${visible.total}`;
    }
    document.getElementById('summaryText').textContent = text;
  }

  function updateList(visibleProviders, searchQuery) {
    const listEl = document.getElementById('providerList');
    listEl.innerHTML = '';

    visibleProviders.forEach((provider) => {
      const li = document.createElement('li');
      li.dataset.index = String(provider._index);

      const name = document.createElement('span');
      name.className = 'provider-name';
      name.innerHTML = highlightMatch(provider.name, searchQuery);

      const meta = document.createElement('span');
      meta.className = 'provider-meta';
      meta.textContent = [provider.type, provider.main_country || provider.region]
        .filter(Boolean)
        .join(' - ');

      li.appendChild(name);
      li.appendChild(meta);
      li.addEventListener('click', () => {
        focusProvider(provider._index);
      });
      listEl.appendChild(li);
    });
  }

  function focusProvider(index) {
    const provider = allProviders[index];
    if (!provider) return;
    highlightProvider(index);
    const target = [provider.lat, provider.lon];
    const zoom = Math.max(map.getMinZoom(), getFocusZoom(provider));
    map.flyTo(target, zoom, { duration: 0.65 });
    markers[index].openPopup();
  }

  function constrainWorldView() {
    const minZoom = Math.max(2, map.getBoundsZoom(worldBounds, true));
    map.setMinZoom(minZoom);
    if (map.getZoom() < minZoom) map.setZoom(minZoom);
    map.panInsideBounds(worldBounds, { animate: false });
  }

  function getFocusZoom(provider) {
    if (provider.lat === 0 && provider.lon === 0) return 2;
    if (hasValue(provider.city) || hasValue(provider.address)) return 8;
    return 5;
  }

  function highlightProvider(index) {
    document
      .querySelectorAll('#providerList li')
      .forEach((item) => item.classList.toggle('active', item.dataset.index === String(index)));
    const target = document.querySelector(`#providerList li[data-index='${index}']`);
    if (target) target.scrollIntoView({ block: 'nearest' });
  }

  function buildPopup(provider) {
    const definitions = fieldDefinitions[provider.type] || fieldDefinitions.TPA;
    const rows = definitions
      .map(([label, key]) => formatPopupRow(label, provider[key]))
      .filter(Boolean)
      .join('');
    return `<div class='popup-content'><strong>${escapeHTML(provider.name)}</strong>${rows}</div>`;
  }

  function createProviderIcon(provider) {
    const statusClass = isSigned(provider) ? 'marker-signed' : 'marker-pending';
    const categoryClass = categoryClassName(provider.type);
    return L.divIcon({
      className: 'provider-marker-shell',
      html: `<span class='provider-marker ${statusClass} ${categoryClass}'><span></span></span>`,
      iconSize: [30, 38],
      iconAnchor: [15, 34],
      popupAnchor: [0, -31],
    });
  }

  function categoryClassName(category) {
    return `marker-${String(category || 'provider').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function formatPopupRow(label, value) {
    if (!hasValue(value)) return '';
    return `<br/><b>${escapeHTML(label)}:</b> ${formatValue(value)}`;
  }

  function hasValue(value) {
    if (value === undefined || value === null) return false;
    const text = String(value).trim();
    return text !== '' && !['nan', 'none', 'n/a', 'na'].includes(text.toLowerCase());
  }

  function formatValue(value) {
    return escapeHTML(String(value)).replace(/\n/g, '<br/>');
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\x22/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightMatch(text, query) {
    const safeText = escapeHTML(text || '');
    if (!query) return safeText;
    const source = String(text || '');
    const index = source.toLowerCase().indexOf(query);
    if (index === -1) return safeText;
    const before = escapeHTML(source.slice(0, index));
    const match = escapeHTML(source.slice(index, index + query.length));
    const after = escapeHTML(source.slice(index + query.length));
    return `${before}<mark>${match}</mark>${after}`;
  }
})();
