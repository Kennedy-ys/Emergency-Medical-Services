// Firebase configuration file for EMS PWA
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';


const firebaseConfig = {
  apiKey: "AIzaSyBvDUooEb3mpGFWttxZZq6YINopqu03_ro",
  authDomain: "ems-pwa-5b6b0.firebaseapp.com",
  databaseURL: "https://ems-pwa-5b6b0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ems-pwa-5b6b0",
  storageBucket: "ems-pwa-5b6b0.firebasestorage.app",
  messagingSenderId: "461013486188",
  appId: "1:461013486188:web:9019c0b1f12cef35f76649"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const db = getDatabase(app);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

export {app, db, auth};
