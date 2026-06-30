import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

// Replace these values with your Firebase project config.
// Get them from: Firebase Console → Project Settings → Your apps → SDK setup
const firebaseConfig = {
  apiKey: 'AIzaSyBVzNvmflJ3fNuw9RJI4W87ivs3tUkZ564',
  authDomain: 'raffle-draw-84ade.firebaseapp.com',
  databaseURL: 'https://raffle-draw-84ade-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'raffle-draw-84ade',
  storageBucket: 'raffle-draw-84ade.firebasestorage.app',
  messagingSenderId: '793468971257',
  appId: '1:793468971257:web:de1fae71d670018a209a28',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
