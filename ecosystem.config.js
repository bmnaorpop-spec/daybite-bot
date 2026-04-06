module.exports = {
  apps: [
    {
      name: "daybite-bot",
      script: "src/index.ts",
      interpreter: "node",
      interpreter_args: "--experimental-sqlite -r ts-node/register",
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
