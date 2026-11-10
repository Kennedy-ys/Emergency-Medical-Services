import L from 'leaflet';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import patientImg from '../../assets/icons/patient-icon.png';
import hospitalImg from '../../assets/icons/hospital-icon.png';
import ambulanceImg from '../../assets/icons/ambulance-icon.png';

/** Every marker icon in the app, defined once from bundled images. */
function pin(iconUrl) {
  return L.icon({
    iconUrl,
    shadowUrl: markerShadow,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -35],
  });
}

export const patientIcon = pin(patientImg);
export const hospitalIcon = pin(hospitalImg);
export const ambulanceIcon = pin(ambulanceImg);
