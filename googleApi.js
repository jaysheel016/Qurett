import { GOOGLE_API_KEY } from './config.js';

// Fetch place info from Google Places API
async function fetchPlaceData(name, location = "") {
  const query = `${name} ${location}`;
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    query
  )}&inputtype=textquery&fields=place_id,formatted_address&key=${GOOGLE_API_KEY}`;

  const findRes = await fetch(findUrl);
  const findData = await findRes.json();

  if (!findData.candidates || !findData.candidates[0]) return null;

  const placeId = findData.candidates[0].place_id;
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total,international_phone_number,website,editorial_summary&key=${GOOGLE_API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const details = await detailsRes.json();
  return details.result;
}
