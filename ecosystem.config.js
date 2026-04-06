module.exports = {
  apps: [
    {
      name: "daybite-bot",
      script: "dist/index.js",
      interpreter: "node",
      interpreter_args: "--experimental-sqlite",
      cwd: "/home/pop/daybite-bot",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
