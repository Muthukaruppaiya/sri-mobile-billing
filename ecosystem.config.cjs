// pm2 process file for the app server: `pm2 start ecosystem.config.cjs`
// API + built web app run together on PORT (set in server/.env).
module.exports = {
  apps: [
    {
      name: 'sri-mobiles',
      cwd: './server',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',
      time: true,
    },
  ],
}
