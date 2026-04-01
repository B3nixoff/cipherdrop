import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cipherdrop.mobile",
  appName: "CipherDrop",
  webDir: ".next",
  server: {
    url: "https://whyisthislifeismine.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
