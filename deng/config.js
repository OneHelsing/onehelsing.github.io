// Lekla Stüdyo yapılandırması. Firebase web yapılandırması tasarım gereği herkese
// açıktır; yetkiyi Storage kuralları verir (apps/anadil/studio/firebase/storage.rules).
export const FIREBASE = {
  apiKey: 'AIzaSyCllap337W3xQeJfld26PBjO3-5VL1ccrA',
  authDomain: 'onehelsing-deng.firebaseapp.com',
  projectId: 'onehelsing-deng',
  storageBucket: 'onehelsing-deng.firebasestorage.app',
  messagingSenderId: '712014487192',
  appId: '1:712014487192:web:69096e120b75ea9679faed',
};

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

// Konuşan bağlantıları: yalnızca SHA-256 özetleri. Anahtarların kendisi
// apps/anadil/studio/keys.local.json'da (git dışı). tools/make_keys.mjs yazar.
// KEYS:BEGIN
export const SPEAKERS = [
  { id: 'deng1', hash: '6dc107c7ca1b4bfdd3b1d19876c7aafe718f429c04cba9b564ecfa91d3933396' },
  { id: 'deng2', hash: '0c2db2a4bb74ab0a9cc5451cf66503bdfcc6a6cfa73954f32152de5688bd28b1' },
  { id: 'deng3', hash: 'dae5411e662e2da00c6a7d5d9e70864f157134f2fa635ebd796fa623e21f26e0' },
  { id: 'deng4', hash: 'd047911a48f1392a1059419eafac1dde5a8fa7425bb6d129640bb4278636942f' },
  { id: 'deng5', hash: '90363e35583da7954b707200e9cdde66f7e43719c20f626238da564173b76b14' },
  { id: 'deng6', hash: '8334924398554a9d6950d868b84f37836923fc49a50360911aea05af5757df3b' },
];
// KEYS:END

// "#k=demo": hiçbir şey yüklenmez; sayfayı denemek için.
export const DEMO_KEY = 'demo';

export const CONSENT_VERSION = 'deng-izin-1';
export const CONTACT = 'onehelsingstudio@gmail.com';
