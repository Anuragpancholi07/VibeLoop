import districtsData from './districts.json';

export interface StateDistrictGroup {
  state: string;
  districts: string[];
}

export const STATES_AND_DISTRICTS: StateDistrictGroup[] = districtsData.states;

// Extract all unique districts/cities in alphabetical order
export const INDIAN_DISTRICTS: string[] = Array.from(
  new Set(
    districtsData.states.flatMap((s) => s.districts)
  )
).sort();

// Popular cities as requested by the user
export const POPULAR_CITIES = [
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Surat',
  'Lucknow',
  'Goa',
  'Chandigarh',
  'Kochi',
  'Patna',
  'Indore',
  'Bhopal',
  'Nagpur'
];
