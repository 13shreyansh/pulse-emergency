import axios from "axios";
import { ENV } from "../_core/env";
import type { HospitalResult } from "../../shared/pulse-types";

const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchNearby";

// Map emergency types to Google Places types
const EMERGENCY_TYPE_TO_PLACE_TYPES: Record<string, string[]> = {
  cardiac_center: ["hospital"],
  trauma_center: ["hospital"],
  maternity_hospital: ["hospital"],
  hospital: ["hospital"],
};

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function searchNearbyHospitals(
  latitude: number,
  longitude: number,
  hospitalType: string = "hospital",
  radiusKm: number = 15
): Promise<HospitalResult[]> {
  const placeTypes = EMERGENCY_TYPE_TO_PLACE_TYPES[hospitalType] || ["hospital"];

  const response = await axios.post(
    PLACES_API_URL,
    {
      includedTypes: placeTypes,
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusKm * 1000,
        },
      },
    },
    {
      headers: {
        "X-Goog-Api-Key": ENV.googlePlacesApiKey,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.id,places.types",
        "Content-Type": "application/json",
      },
    }
  );

  const places = response.data.places || [];

  return places.map((place: any) => {
    const plat = place.location?.latitude || 0;
    const plng = place.location?.longitude || 0;
    return {
      name: place.displayName?.text || "Unknown Hospital",
      address: place.formattedAddress || "",
      latitude: plat,
      longitude: plng,
      distanceKm: Math.round(haversineDistance(latitude, longitude, plat, plng) * 10) / 10,
      websiteUri: place.websiteUri || undefined,
      phoneNumber: place.nationalPhoneNumber || undefined,
      placeId: place.id || "",
      types: place.types || [],
    } as HospitalResult;
  }).sort((a: HospitalResult, b: HospitalResult) => a.distanceKm - b.distanceKm);
}
