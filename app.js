// JavaScript logic for the provider network map with category and status filters.

(async function () {
  const MANUAL_DATA_KEY = 'providerNetworkManualDataV1';
  const manualData = loadManualData();
  const sheetsData = await getSheetsData();
  const tpaProviders = typeof providers !== 'undefined' ? providers : [];
  const groundProviders = await getGroundProviders();
  const airProviders = await getAirProviders();
  const medicalEscortProviders = await getMedicalEscortProviders();

  const loadedProviders = [
    ...tpaProviders,
    ...groundProviders,
    ...airProviders,
    ...medicalEscortProviders,
    ...sheetsData.providers,
    ...manualData.providers,
  ];
  let allProviders = normalizeProviders(applyApprovedProviderChanges(loadedProviders, sheetsData.changes));

  const fieldDefinitions = {
    TPA: [
      ['Type', 'type'],
      ['Headquarters', 'address'],
      ['City', 'city'],
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
    'Hospital/Clinic': [
      ['Type', 'type'],
      ['Location', 'main_country'],
      ['Country', 'country'],
      ['City', 'city'],
      ['Region', 'region'],
      ['Contact', 'network_manager'],
      ['Website', 'website'],
      ['Phone', 'ops_phone'],
      ['Email', 'ops_email'],
      ['Address', 'address'],
      ['Notes', 'comments'],
      ['Agreement Status', 'agreement'],
    ],
    Generic: [
      ['Type', 'type'],
      ['Location', 'main_country'],
      ['Country', 'country'],
      ['City', 'city'],
      ['Region', 'region'],
      ['Contact', 'network_manager'],
      ['Website', 'website'],
      ['Phone', 'ops_phone'],
      ['Email', 'ops_email'],
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

  let categories = buildCategories();

  let currentStatusFilter = 'all';
  let currentCategoryFilter = 'all';
  let modalSubmitHandler = null;

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

  async function getSheetsData() {
    if (
      typeof window === 'undefined' ||
      !window.providerSheetsDataPromise ||
      typeof window.providerSheetsDataPromise.then !== 'function'
    ) {
      return { providers: [], categories: [], changes: [] };
    }

    try {
      const data = await window.providerSheetsDataPromise;
      return {
        providers: Array.isArray(data?.providers) ? data.providers : [],
        categories: Array.isArray(data?.categories) ? data.categories : [],
        changes: Array.isArray(data?.changes) ? data.changes : [],
      };
    } catch (error) {
      console.warn('Could not load Google Sheets provider data.', error);
      return { providers: [], categories: [], changes: [] };
    }
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

  const markers = allProviders.map(createMarker);

  function createMarker(provider) {
    const marker = L.marker([provider.lat, provider.lon], {
      icon: createProviderIcon(provider),
      riseOnHover: true,
    });
    marker.bindPopup(buildPopup(provider));
    marker.on('click', () => highlightProvider(provider._index));
    marker.addTo(map);
    return marker;
  }

  initializeCategoryFilters();
  initializeStatusFilters();
  initializeManualControls();
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  applyFilters();

  function normalizeProviders(providerList) {
    const seen = new Set();
    return providerList
      .filter((provider) => Number.isFinite(Number(provider.lat)) && Number.isFinite(Number(provider.lon)))
      .filter((provider) => {
        const key = provider.id
          ? `id:${provider.id}`
          : [
              provider.name,
              provider.type,
              Number(provider.lat).toFixed(6),
              Number(provider.lon).toFixed(6),
            ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((provider, index) => normalizeProvider(provider, index));
  }

  function normalizeProvider(provider, index) {
    return {
      ...provider,
      lat: Number(provider.lat),
      lon: Number(provider.lon),
      type: cleanText(provider.type) || 'TPA',
      _index: index,
    };
  }

  function buildCategories() {
    const categorySet = new Set([
      ...categoryOrder,
      ...sheetsData.categories,
      ...manualData.categories,
      ...allProviders.map((provider) => provider.type).filter(Boolean),
    ]);
    return [
      ...categoryOrder.filter((category) => categorySet.has(category)),
      ...Array.from(categorySet).filter((category) => !categoryOrder.includes(category)).sort(),
    ];
  }

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

  function initializeManualControls() {
    const addCategoryButton = document.getElementById('addCategoryButton');
    const addProviderButton = document.getElementById('addProviderButton');
    const modal = document.getElementById('manualModal');
    const form = document.getElementById('manualForm');
    const cancelButton = document.getElementById('modalCancel');
    const closeButton = document.querySelector('.modal-close');

    if (!addCategoryButton || !addProviderButton || !modal || !form) return;

    addCategoryButton.addEventListener('click', openCategoryModal);
    addProviderButton.addEventListener('click', openProviderModal);
    document.addEventListener('click', handleProviderReviewAction);
    cancelButton.addEventListener('click', closeModal);
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!modalSubmitHandler) return;
      try {
        const formData = Object.fromEntries(new FormData(form).entries());
        modalSubmitHandler(formData);
        closeModal();
      } catch (error) {
        document.getElementById('modalError').textContent = error.message;
      }
    });
  }

  function openCategoryModal() {
    openModal({
      title: 'Add category',
      submitLabel: 'Submit category',
      fields: `
        <label class="form-field form-field-full">
          <span>Category name</span>
          <input name="category" type="text" required autocomplete="off" />
        </label>
      `,
      onSubmit(data) {
        const category = cleanText(data.category);
        if (!category) throw new Error('Category name is required.');
        if (!categories.includes(category)) {
          manualData.categories.push(category);
          manualData.categories = uniqueCleanValues(manualData.categories);
          saveManualData();
          categories = buildCategories();
        }
        currentCategoryFilter = category;
        initializeCategoryFilters();
        applyFilters();
        submitReviewItem({
          submission_type: 'category',
          category,
          submitted_at: new Date().toISOString(),
        });
      },
    });
  }

  function openProviderModal() {
    const defaultCategory =
      currentCategoryFilter !== 'all' && categories.includes(currentCategoryFilter)
        ? currentCategoryFilter
        : 'Hospital/Clinic';

    openModal({
      title: 'Add provider',
      submitLabel: 'Submit for approval',
      fields: buildProviderFields({ type: defaultCategory }),
      onSubmit(data) {
        const provider = buildManualProvider(data);
        manualData.providers.push(provider);
        saveManualData();
        addProviderToMap(provider);
        submitReviewItem({
          submission_type: 'provider',
          provider,
          submitted_at: new Date().toISOString(),
        });
      },
    });
  }

  function handleProviderReviewAction(event) {
    const button = event.target.closest('[data-provider-review-action]');
    if (!button) return;

    const provider = allProviders[Number(button.dataset.providerIndex)];
    if (!provider) return;

    if (button.dataset.providerReviewAction === 'edit') {
      openProviderEditRequest(provider);
    } else if (button.dataset.providerReviewAction === 'delete') {
      openProviderDeletionRequest(provider);
    }
  }

  function openProviderEditRequest(provider) {
    const snapshot = snapshotReviewProvider(provider);
    openModal({
      title: 'Request provider edit',
      submitLabel: 'Submit edit request',
      fields: `
        <input name="change_action" type="hidden" value="edit" />
        <input name="target_provider_json" type="hidden" value="${escapeAttribute(JSON.stringify(snapshot))}" />
        <input name="provider_id" type="hidden" value="${escapeAttribute(provider.id || '')}" />
        ${buildProviderFields(provider, true)}
      `,
      onSubmit(data) {
        submitReviewItem({
          submission_type: 'provider_change',
          change_action: 'edit',
          target_provider: snapshot,
          provider: buildManualProvider(data),
          request_notes: cleanText(data.request_notes),
          submitted_at: new Date().toISOString(),
        });
      },
    });
  }

  function openProviderDeletionRequest(provider) {
    const snapshot = snapshotReviewProvider(provider);
    openModal({
      title: 'Request provider deletion',
      submitLabel: 'Submit deletion request',
      fields: `
        <input name="change_action" type="hidden" value="delete" />
        <input name="target_provider_json" type="hidden" value="${escapeAttribute(JSON.stringify(snapshot))}" />
        <div class="provider-change-summary form-field-full">
          <span>${escapeHTML(provider.name)}</span>
          <small>${escapeHTML([provider.type, provider.main_country || provider.region].filter(Boolean).join(' - '))}</small>
        </div>
        <label class="form-field form-field-full">
          <span>Request notes</span>
          <textarea name="request_notes" rows="3"></textarea>
        </label>
      `,
      onSubmit(data) {
        submitReviewItem({
          submission_type: 'provider_change',
          change_action: 'delete',
          target_provider: snapshot,
          request_notes: cleanText(data.request_notes),
          submitted_at: new Date().toISOString(),
        });
      },
    });
  }

  function buildProviderFields(defaults = {}, includeRequestNotes = false) {
    const selectedType = cleanText(defaults.type) || 'Hospital/Clinic';
    const selectedAgreement = cleanText(defaults.agreement) || 'Agreement pending';
    const categoryOptions = categories
      .map(
        (category) =>
          `<option value="${escapeAttribute(category)}"${
            category === selectedType ? ' selected' : ''
          }>${escapeHTML(category)}</option>`
      )
      .join('');

    return `
      <label class="form-field">
        <span>Category</span>
        <select name="type" required>${categoryOptions}</select>
      </label>
      <label class="form-field">
        <span>Agreement status</span>
        <select name="agreement">
          <option value="Agreement pending"${
            selectedAgreement === 'Agreement pending' ? ' selected' : ''
          }>Agreement pending</option>
          <option value="Agreement signed"${
            selectedAgreement === 'Agreement signed' ? ' selected' : ''
          }>Agreement signed</option>
        </select>
      </label>
      <label class="form-field form-field-full">
        <span>Provider name</span>
        <input name="name" type="text" required autocomplete="organization" value="${escapeAttribute(defaults.name || '')}" />
      </label>
      <label class="form-field">
        <span>Country or location</span>
        <input name="main_country" type="text" autocomplete="country-name" value="${escapeAttribute(defaults.main_country || defaults.country || '')}" />
      </label>
      <label class="form-field">
        <span>City</span>
        <input name="city" type="text" autocomplete="address-level2" value="${escapeAttribute(defaults.city || '')}" />
      </label>
      <label class="form-field">
        <span>Region</span>
        <input name="region" type="text" value="${escapeAttribute(defaults.region || '')}" />
      </label>
      <label class="form-field">
        <span>Latitude</span>
        <input name="lat" type="number" step="any" min="-90" max="90" required value="${escapeAttribute(defaults.lat ?? '')}" />
      </label>
      <label class="form-field">
        <span>Longitude</span>
        <input name="lon" type="number" step="any" min="-180" max="180" required value="${escapeAttribute(defaults.lon ?? '')}" />
      </label>
      <label class="form-field form-field-full">
        <span>Address</span>
        <input name="address" type="text" autocomplete="street-address" value="${escapeAttribute(defaults.address || '')}" />
      </label>
      <label class="form-field">
        <span>Contact</span>
        <input name="network_manager" type="text" autocomplete="name" value="${escapeAttribute(defaults.network_manager || '')}" />
      </label>
      <label class="form-field">
        <span>Phone</span>
        <input name="ops_phone" type="tel" autocomplete="tel" value="${escapeAttribute(defaults.ops_phone || '')}" />
      </label>
      <label class="form-field">
        <span>Email</span>
        <input name="ops_email" type="email" autocomplete="email" value="${escapeAttribute(defaults.ops_email || '')}" />
      </label>
      <label class="form-field">
        <span>Website</span>
        <input name="website" type="url" autocomplete="url" value="${escapeAttribute(defaults.website || '')}" />
      </label>
      <label class="form-field form-field-full">
        <span>Notes</span>
        <textarea name="comments" rows="3">${escapeHTML(defaults.comments || '')}</textarea>
      </label>
      ${
        includeRequestNotes
          ? `<label class="form-field form-field-full">
              <span>Request notes</span>
              <textarea name="request_notes" rows="3"></textarea>
            </label>`
          : ''
      }
    `;
  }

  function openModal({ title, submitLabel, fields, onSubmit }) {
    const modal = document.getElementById('manualModal');
    const titleEl = document.getElementById('modalTitle');
    const fieldsEl = document.getElementById('modalFields');
    const errorEl = document.getElementById('modalError');
    const submitButton = document.getElementById('modalSubmit');
    const form = document.getElementById('manualForm');

    titleEl.textContent = title;
    fieldsEl.innerHTML = fields;
    errorEl.textContent = '';
    submitButton.textContent = submitLabel;
    modalSubmitHandler = onSubmit;
    form.reset();
    modal.hidden = false;

    const firstField = fieldsEl.querySelector('input, select, textarea');
    if (firstField) firstField.focus();
  }

  function closeModal() {
    const modal = document.getElementById('manualModal');
    const form = document.getElementById('manualForm');
    if (form) form.reset();
    if (modal) modal.hidden = true;
    modalSubmitHandler = null;
  }

  function buildManualProvider(data) {
    const name = cleanText(data.name);
    const type = cleanText(data.type);
    const lat = Number(data.lat);
    const lon = Number(data.lon);

    if (!name) throw new Error('Provider name is required.');
    if (!type) throw new Error('Category is required.');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90.');
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error('Longitude must be between -180 and 180.');
    }

    const mainCountry = cleanText(data.main_country);
    return compactObject({
      id: cleanText(data.provider_id) || `manual-${Date.now()}`,
      source: 'manual',
      name,
      type,
      agreement: cleanText(data.agreement) || 'Agreement pending',
      main_country: mainCountry,
      country: mainCountry,
      city: cleanText(data.city),
      region: cleanText(data.region),
      lat,
      lon,
      address: cleanText(data.address),
      network_manager: cleanText(data.network_manager),
      ops_phone: cleanText(data.ops_phone),
      ops_email: cleanText(data.ops_email),
      website: cleanText(data.website),
      comments: cleanText(data.comments),
    });
  }

  function addProviderToMap(provider) {
    const normalized = normalizeProvider(provider, allProviders.length);
    allProviders.push(normalized);
    markers.push(createMarker(normalized));
    if (!categories.includes(normalized.type)) {
      manualData.categories = uniqueCleanValues([...manualData.categories, normalized.type]);
      saveManualData();
      categories = buildCategories();
      initializeCategoryFilters();
    }
    currentCategoryFilter = normalized.type;
    initializeCategoryFilters();
    applyFilters();
    focusProvider(normalized._index);
  }

  function submitReviewItem(submission) {
    if (
      typeof window === 'undefined' ||
      typeof window.submitProviderNetworkSubmission !== 'function'
    ) {
      return;
    }

    window.submitProviderNetworkSubmission(submission).catch((error) => {
      console.warn('Could not send provider submission to Google Sheets.', error);
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
    const definitions = fieldDefinitions[provider.type] || fieldDefinitions.Generic;
    const rows = definitions
      .map(([label, key]) => formatPopupRow(label, provider[key]))
      .filter(Boolean)
      .join('');
    const reviewActions = `
      <div class="provider-review-actions">
        <button type="button" data-provider-review-action="edit" data-provider-index="${provider._index}">Request edit</button>
        <button type="button" class="danger" data-provider-review-action="delete" data-provider-index="${provider._index}">Request deletion</button>
      </div>
    `;
    return `<div class='popup-content'><strong>${escapeHTML(provider.name)}</strong>${rows}${reviewActions}</div>`;
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

  function cleanText(value) {
    return String(value || '').trim();
  }

  function compactObject(record) {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
  }

  function uniqueCleanValues(values) {
    return Array.from(new Set(values.map(cleanText).filter(Boolean)));
  }

  function applyApprovedProviderChanges(providerList, changes) {
    if (!Array.isArray(changes) || changes.length === 0) return providerList;
    return changes.reduce((currentList, change) => {
      const action = cleanText(change.change_action).toLowerCase();
      const target = change.target_provider || {};
      const index = currentList.findIndex((provider) => isSameReviewProvider(provider, target));
      if (index === -1) return currentList;

      if (action === 'delete') {
        return currentList.filter((_, providerIndex) => providerIndex !== index);
      }

      if (action === 'edit' && change.provider) {
        const updated = currentList.slice();
        updated[index] = compactObject({
          ...updated[index],
          ...change.provider,
          id: updated[index].id || change.provider.id,
          source: change.provider.source || updated[index].source,
        });
        return updated;
      }

      return currentList;
    }, providerList);
  }

  function isSameReviewProvider(provider, target) {
    if (!provider || !target) return false;
    const providerId = cleanText(provider.id);
    const targetId = cleanText(target.id);
    if (providerId && targetId && providerId === targetId) return true;

    const sameName = normalizeReviewText(provider.name) === normalizeReviewText(target.name);
    const sameType = normalizeReviewText(provider.type) === normalizeReviewText(target.type);
    const sameLat = isCloseCoordinate(provider.lat, target.lat);
    const sameLon = isCloseCoordinate(provider.lon, target.lon);
    return sameName && sameType && sameLat && sameLon;
  }

  function snapshotReviewProvider(provider) {
    return compactObject({
      id: provider.id,
      source: provider.source,
      name: provider.name,
      type: provider.type,
      agreement: provider.agreement,
      main_country: provider.main_country,
      country: provider.country,
      city: provider.city,
      region: provider.region,
      lat: provider.lat,
      lon: provider.lon,
      address: provider.address,
      network_manager: provider.network_manager,
      ops_phone: provider.ops_phone,
      ops_email: provider.ops_email,
      website: provider.website,
      comments: provider.comments,
    });
  }

  function normalizeReviewText(value) {
    return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
  }

  function isCloseCoordinate(left, right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
    return Math.abs(leftNumber - rightNumber) < 0.000001;
  }

  function loadManualData() {
    const empty = { categories: [], providers: [] };
    const storage = getStorage();
    if (!storage) return empty;

    try {
      const raw = storage.getItem(MANUAL_DATA_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return {
        categories: uniqueCleanValues(Array.isArray(parsed.categories) ? parsed.categories : []),
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      };
    } catch (error) {
      return empty;
    }
  }

  function saveManualData() {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(
      MANUAL_DATA_KEY,
      JSON.stringify({
        categories: uniqueCleanValues(manualData.categories),
        providers: manualData.providers,
      })
    );
  }

  function getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (error) {
      return null;
    }
    return null;
  }

  function formatValue(value) {
    return escapeHTML(String(value)).replace(/\n/g, '<br/>');
  }

  function escapeAttribute(value) {
    return escapeHTML(value).replace(/`/g, '&#96;');
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
