// Reference data for identity verification uploads. Not exhaustive — covers
// common cases with sensible defaults for everywhere else. Add specific
// countries here as needed; anything not listed falls back to DEFAULT_DOCUMENT_TYPES.
//
// This list intentionally does NOT include a raw SSN/national-ID-number text
// field anywhere — only document photo uploads. A typed SSN is far more
// sensitive to store than a document photo and isn't needed for a manual,
// staff-reviewed verification flow like this one.

const DEFAULT_DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "Government-issued national ID" },
  { value: "drivers_license", label: "Driver's license" },
];

const COUNTRY_DOCUMENT_TYPES = {
  US: [
    { value: "drivers_license", label: "Driver's license" },
    { value: "passport", label: "Passport" },
    { value: "state_id", label: "State-issued ID card" },
  ],
  GB: [
    { value: "passport", label: "Passport" },
    { value: "drivers_license", label: "Driving licence" },
    { value: "national_id", label: "National ID card (BRP)" },
  ],
  CA: [
    { value: "drivers_license", label: "Driver's licence" },
    { value: "passport", label: "Passport" },
    { value: "provincial_id", label: "Provincial ID card" },
  ],
};

function getDocumentTypesForCountry(countryCode) {
  return COUNTRY_DOCUMENT_TYPES[countryCode] || DEFAULT_DOCUMENT_TYPES;
}

// Minimal ISO country list for the dropdown. Trimmed to commonly-needed
// entries rather than the full ISO-3166 list — extend as needed.
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "ZA", name: "South Africa" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "OTHER", name: "Other" },
];

module.exports = { DEFAULT_DOCUMENT_TYPES, COUNTRY_DOCUMENT_TYPES, getDocumentTypesForCountry, COUNTRIES };
