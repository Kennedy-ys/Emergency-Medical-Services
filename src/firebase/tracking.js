// import { db } from './index';
// import { ref, push, set, onValue, update, serverTimestamp } from 'firebase/database';

// // Create a new ambulance booking
// export const createBooking = async (data) => {
//   const newBookingRef = push(ref(db, 'ambulanceBookings'));
//   await set(newBookingRef, {
//     ...data,
//     status: 'pending',
//     timestamp: Date.now(),
//   });
//   return newBookingRef.key;
// };

// // Update location (ambulance or patient)
// export const updateLocation = async (bookingId, role, coords) => {
//   const locationRef = ref(db, `ambulanceTracking/${bookingId}/${role}`);
//   await set(locationRef, {
//     lat: coords.lat,
//     lng: coords.lng,
//     updatedAt: Date.now(),
//   });
// };

// // Subscribe to real-time location updates
// export const subscribeToTracking = (bookingId, callback) => {
//   const trackingRef = ref(db, `ambulanceTracking/${bookingId}`);
//   return onValue(trackingRef, (snapshot) => {
//     callback(snapshot.val());
//   });
// };
