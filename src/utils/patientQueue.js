import { openDB } from 'idb';
import { ref, set, push } from "firebase/database";
import { db } from "../firebaseConfig";
import { v4 as uuidv4 } from "uuid";


const DB_NAME = 'ems-pwa-db';
const STORE_NAME = 'patients';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    },
  });
}

export async function queuePatient(patient) {
  const db = await getDB();
  await db.put(STORE_NAME, patient);
}

export async function getQueuedPatients() {
  const db = await getDB();
  return await db.getAll(STORE_NAME);
}

export const syncOfflinePatients = async () => {
  const queuedPatients = await getQueuedPatients();
  if (!queuedPatients || queuedPatients.length === 0) {
    console.log("✅ No patients in offline queue.");
    return;
  }

  console.log(`📤 Attempting to sync ${queuedPatients.length} patient(s)...`);

  const failedPatients = [];

  for (const patient of queuedPatients) {
    try {
      const patientRef = push(ref(db, "patients"));
      const newPatient = {
        ...patient,
        id: uuidv4(), // ✅ Fresh unique ID for each sync
      };
      await set(patientRef, newPatient);
      console.log("✅ Synced patient:", newPatient.fullName);
    } catch (error) {
      console.error("❌ Failed to sync patient:", patient.fullName, error);
      failedPatients.push(patient);
    }
  }

  if (failedPatients.length === 0) {
    await clearQueuedPatients();
    console.log("✅ All patients synced successfully.");
  } else {
    console.warn("⚠️ Some patients failed to sync. Keeping them in the queue.");
    localStorage.setItem("offlinePatients", JSON.stringify(failedPatients));
  }
};


export async function clearQueuedPatients() {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
