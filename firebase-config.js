// Configuración de Firebase (Firestore) para la sincronización en la nube.
// Estas claves son públicas por diseño; la seguridad se aplica con las Reglas
// de Firestore. Si Firebase no carga (sin internet), la app sigue funcionando
// en local con localStorage.
(function () {
  try {
    if (typeof firebase === "undefined") return; // sin SDK (offline): modo local
    var firebaseConfig = {
      apiKey: "AIzaSyCulKMX9ji9eh9s5X8xdJxZc1HoHc6fynM",
      authDomain: "dgt-test-1359e.firebaseapp.com",
      projectId: "dgt-test-1359e",
      storageBucket: "dgt-test-1359e.firebasestorage.app",
      messagingSenderId: "218598446000",
      appId: "1:218598446000:web:7b81e2f7ba4dae7a43bc75",
    };
    firebase.initializeApp(firebaseConfig);
    window._db = firebase.firestore();
    // Persistencia offline: si se pierde la conexión, sigue guardando y sincroniza al volver.
    try { window._db.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (_) {}
  } catch (e) {
    console.warn("Firebase no disponible, se usa solo almacenamiento local:", e);
  }
})();
