import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, child } from "firebase/database"; // Pastikan modul ini diimpor

const firebaseConfig = {
  apiKey: "AIzaSyD_ROaVGAbJep3gp4BgnBnyRceAxjtX2tw",
  authDomain: "aplikasi-pkh-tapin.firebaseapp.com",
  databaseURL: "https://aplikasi-pkh-tapin-default-rtdb.firebaseio.com",
  projectId: "aplikasi-pkh-tapin",
  storageBucket: "aplikasi-pkh-tapin.firebasestorage.app",
  messagingSenderId: "553098582321",
  appId: "1:553098582321:web:d27b3445f92e1fd5c87810"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); // Inisialisasi database
