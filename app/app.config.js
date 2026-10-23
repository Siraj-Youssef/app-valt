// Configuração dinâmica sobre o app.json. Só existe para publicar a versão web numa subpasta
// (GitHub Pages: EXPO_BASE_URL=/app-valt); sem a variável, nada muda.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
});
