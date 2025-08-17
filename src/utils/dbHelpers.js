import { ref, runTransaction, update, get, getDatabase } from 'firebase/database';
import { db } from '../firebaseConfig';
import DriverPhoto from '../assets/avatar.png'

export async function getNextDriverNumber() {
  const counterRef = ref(db, 'driverCount');
  let newCount;
  
  await runTransaction(counterRef, (current) => {
    if (current === null) return 1;
    return current + 1;
  }).then((result) => {
    newCount = result.snapshot.val();
  });
  
  return newCount;
}

export async function registerDriver(driverData) {
  const count = await getNextDriverNumber();
  const serialNumber = `EMS-${String(count).padStart(3, '0')}`;
  const ambulanceId = `ambulance-${String(count).padStart(3, '0')}`;
  const ambulanceRef = ref(db, `ambulances/${ambulanceId}`);
  await update(ambulanceRef, {
    ...driverData,
    driverPhoto: driverData.driverPhoto || DriverPhoto,
    id: ambulanceId,
    serialNumber,
    lastActive: new Date().toISOString(),
    status: 'active',
  });
  return ambulanceId; // return ID for reference
}

export const fetchAmbulanceIdForUser = async (uid) => {
  const ambulanceRef = ref(db, `ambulances`);
  const snapshot = await get(ambulanceRef);
  if (snapshot.exists()) {
    const ambulances = snapshot.val();
    for (const key in ambulances) {
      if (ambulances[key].uid === uid) {
        return key;
      }
    }
  }
  return null;
};

export async function getDriverData(ambulanceId) {
  const ambulanceRef = ref(db, `ambulances/${ambulanceId}`);
  const snapshot = await get(ambulanceRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
}

export async function updateDriverProfile(ambulanceId, profileData) {
  const ambulanceRef = ref(db, `ambulances/${ambulanceId}`);
  await update(ambulanceRef, {
    ...profileData,
    id: ambulanceId,
  });
}