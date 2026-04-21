const worldwideHeadquartersOverrides = {
  tpa: [
    {
      name: 'MARITIME & HEALTHCARE GROUP',
      lat: 51.5305527,
      lon: -0.0936459,
      city: 'London',
      address: '20 Wenlock Road, London N1 7GU, United Kingdom',
    },
    {
      name: 'Flying Doctors Nigeria',
      lat: 6.5773702,
      lon: 3.3211601,
      city: 'Lagos',
      address:
        'Quits Aviation Terminal, ExecuJet Hangar 1, Murtala Muhammed International Airport, Lagos, Nigeria',
    },
    {
      name: 'Rowland Brothers Int. Repatriation',
      lat: 51.393573,
      lon: -0.093912,
      city: 'Croydon',
      address: '297 Whitehorse Road, Croydon CR0 2HR, United Kingdom',
    },
  ],
  groundAmbulance: [
    {
      name: 'ONE CALL',
      lat: 41.9211358,
      lon: -88.2669841,
      city: 'St. Charles',
      address: '3815 E Main Street Suite C, St. Charles, IL 60174, USA',
    },
    {
      name: 'EMERGENCY INTERNATIONAL CARE',
      lat: 26.120231,
      lon: -80.1431086,
      city: 'Fort Lauderdale',
      address: '200 South Andrews Avenue Suite 504, Fort Lauderdale, FL 33301, USA',
    },
    {
      name: 'GATEWAY',
      lat: 38.9030556,
      lon: -77.0343319,
      city: 'Washington, D.C.',
      address: '1015 15th Street NW Suite 600, Washington, D.C. 20005, USA',
    },
  ],
};

(function applyWorldwideHeadquartersOverrides() {
  const normalize = (value) => String(value || '').trim().toUpperCase();

  const apply = (records, overrides) => {
    if (!Array.isArray(records)) return;

    overrides.forEach((override) => {
      records
        .filter((provider) => normalize(provider.name) === normalize(override.name))
        .forEach((provider) => {
          Object.assign(provider, {
            lat: override.lat,
            lon: override.lon,
            city: override.city,
            address: override.address,
          });
        });
    });
  };

  if (typeof providers !== 'undefined') {
    apply(providers, worldwideHeadquartersOverrides.tpa);
  }

  if (typeof groundAmbulanceProvidersPromise !== 'undefined') {
    groundAmbulanceProvidersPromise.then((groundProviders) => {
      apply(groundProviders, worldwideHeadquartersOverrides.groundAmbulance);
    });
  }
})();
