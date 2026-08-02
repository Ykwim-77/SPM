require('dotenv').config();

console.log(process.env.EXPO_PUBLIC_BACKEND_URL)
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL ?? '',
  },
});
console.log("teste: ", process.env.EXPO_PUBLIC_BACKEND_URL)
