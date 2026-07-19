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
})();
