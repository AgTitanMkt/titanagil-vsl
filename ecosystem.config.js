module.exports = {
  apps: [{
    name: "vsl-dashboard",
    script: "main.py",
    interpreter: "python3",
    cwd: "/var/www/vsl-dash-python",
    env: {
      PORT: 8050,
      DATABASE_URL: "mysql+pymysql://vsl_user:VslDash2026xK9w@localhost:3306/vsl_dashboard",
    },
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
