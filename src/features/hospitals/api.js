import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/**
 * @typedef {{ id: string, name: string, address: string|null, phone: string|null,
 *             lat: number, lng: number }} Hospital
 */

/** @returns {Promise<Hospital[]>} Active hospitals, by name. Archived ones are hidden by the database. */
async function fetchHospitals() {
  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name, address, phone, lat, lng')
    .order('name');
  if (error) throw error;
  return data;
}

export function useHospitals() {
  return useQuery({
    queryKey: ['hospitals'],
    queryFn: fetchHospitals,
    // The list changes rarely; keep it usable for a long time between visits.
    staleTime: 5 * 60_000,
  });
}
