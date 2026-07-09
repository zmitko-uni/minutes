// uuMinutes fork — default config profile for packaged builds and local dev.
if (process.env.NODE_CONFIG_ENV == null || process.env.NODE_CONFIG_ENV === '') {
  process.env.NODE_CONFIG_ENV = 'uuminutes';
}
