import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyByH_pVX8jJgYftbIj9DGHkcVqmdR2ST2U",
  authDomain: "spikey-2004b.firebaseapp.com",
  projectId: "spikey-2004b",
  storageBucket: "spikey-2004b.firebasestorage.app",
  messagingSenderId: "863973173293",
  appId: "1:863973173293:web:554df79afc17d9fb3fb0a4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db }; 