// Existing provider updates confirmed in the worldwide provider review.
const worldwideProviderRecordOverrides = [
  {
    matchName: "MED EVASAN",
    matchType: "TPA",
    agreement: "Agreement signed",
    main_country: "France",
    country: "France",
    city: "Marseille",
    region: "Provence-Alpes-Cote d'Azur",
    lat: 43.251415995532,
    lon: 5.394950958618,
    address: "637 Avenue de Mazargues, 13009 Marseille, France",
    website: "https://www.med-evasan.com",
    ops_email: "nantoun@medeva.org; info@medeva.org",
    ops_phone: "+33 4 913 219 36",
    comments: "Medical assistance and repatriation services across France.",
  },
  {
    matchName: "ARUSHA MEDIVAC",
    matchType: "Air Ambulance",
    agreement: "Agreement signed",
    main_country: "Tanzania",
    country: "Tanzania",
    city: "Arusha",
    region: "Arusha",
    lat: -3.3668439,
    lon: 36.6257181,
    address: "Arusha Airport, Arusha, Tanzania",
    network_manager: "Joleen D'Mello",
    ops_phone: "+255 767 996 996; +255 683 996 996",
    ops_email: "info@arushamedivac.org; joleen@arushamedivac.org",
    website: "https://arushamedivac.org/",
    comments: "Fixed-wing turboprop air ambulance for regional transfers. Does not operate helicopters. Helicopter support in Tanzania is coordinated with LEVEL UP.",
  },
  {
    matchName: "Egypt In-Touch Assistance",
    matchType: "TPA",
    agreement: "Agreement signed",
    main_country: "Egypt",
    country: "Egypt",
    additional_countries: "Egypt, Oman, Zanzibar",
    city: "Hurghada",
    region: "Red Sea Governorate",
    lat: 27.2568629,
    lon: 33.8069185,
    address: "Villa 20 D, El Helal District, Hurghada, Red Sea Governorate, Egypt",
    network_manager: "Amira Jacob (escalation)",
    ops_phone: "+20 122 024 0504; +20 122 024 0560; +20 65 355 5332",
    ops_email: "info@egyptintouch.com",
    manager_email: "amira.jacob@egyptintouch.com",
    website: "https://www.egyptintouch.com/",
    comments: "Medical and travel assistance coverage for Egypt, Oman and Zanzibar.",
  },
];

(function applyWorldwideProviderRecordOverrides() {
  const normalize = (value) => String(value || "").trim().toUpperCase();
  const apply = (records) => {
    if (!Array.isArray(records)) return;
    worldwideProviderRecordOverrides.forEach((override) => {
      const { matchName, matchType, ...updates } = override;
      records
        .filter(
          (provider) =>
            normalize(provider.name) === normalize(matchName) &&
            (!matchType || normalize(provider.type) === normalize(matchType)),
        )
        .forEach((provider) => Object.assign(provider, updates));
    });
  };

  if (typeof providers !== "undefined") apply(providers);
  if (typeof groundAmbulanceProvidersPromise !== "undefined") {
    groundAmbulanceProvidersPromise.then(apply);
  }
  if (typeof airAmbulanceProvidersPromise !== "undefined") {
    airAmbulanceProvidersPromise.then(apply);
  }
  if (typeof medicalEscortProvidersPromise !== "undefined") {
    medicalEscortProvidersPromise.then(apply);
  }
  if (typeof hospitalClinicProviders !== "undefined") apply(hospitalClinicProviders);
  if (typeof germanyHospitalClinicProviders !== "undefined") apply(germanyHospitalClinicProviders);
  if (typeof arcticHospitalClinicProviders !== "undefined") apply(arcticHospitalClinicProviders);
  if (typeof worldwideImportedProviders !== "undefined") apply(worldwideImportedProviders);
  if (typeof networkUpdateProviders !== "undefined") apply(networkUpdateProviders);
})();
