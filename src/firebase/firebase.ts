import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';

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

// Initialize Auth
const auth = getAuth(app);

// Auth functions
export const signUp = (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signIn = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logOut = () => {
  return signOut(auth);
};

export { db, auth }; 