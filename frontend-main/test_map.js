const AFRICAN_COUNTRIES_FOR_MAP = ["Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Democratic Republic of the Congo", "Republic of the Congo", "Djibouti", "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Swaziland", "Tanzania", "Togo", "Uganda", "Zambia", "Zimbabwe", "United Republic of Tanzania", "Somaliland", "Côte d'Ivoire", "eSwatini"];

const normalizeCountryName = (name) => {
    const normalized = name.toLowerCase().trim();
    const mappings = {
      'united republic of tanzania': 'tanzania',
      'democratic republic of the congo': 'drc',
      'republic of the congo': 'congo',
      'ivory coast': 'côte d\'ivoire',
      'cote d\'ivoire': 'côte d\'ivoire',
      'guinea bissau': 'guinea-bissau',
      'somaliland': 'somalia',
      'swaziland': 'eswatini',
    };
    return mappings[normalized] || normalized;
};

// simulate what africaGeoJson might have:
const geoCountries = AFRICAN_COUNTRIES_FOR_MAP.map(c => ({properties: {name: c}}));

const testAfricanCountries = ["Tanzania", "Uganda", "Democratic Republic of the Congo", "Côte d'Ivoire", "Ghana"];

testAfricanCountries.forEach(country => {
    const normName = normalizeCountryName(country);
    const isMatched = geoCountries.some(f => normalizeCountryName(f.properties.name) === normName);
    console.log(`${country} -> ${normName} (Matched in geoJson: ${isMatched})`);
});
