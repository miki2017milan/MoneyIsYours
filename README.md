# Household expenses

Node.js + Express API, SQLite (better-sqlite3), plain HTML/CSS/JS frontend.

## Run on the Raspberry Pi
    sudo apt install -y nodejs npm     # Node 18+ recommended
    cd expense-tracker
    npm install
    npm start                          # http://<pi-ip>:3000

Data is stored in `expenses.db` next to `server.js` (back it up by copying the file).
Change the port with `PORT=8080 npm start`.

## Start on boot (systemd)
Create `/etc/systemd/system/expenses.service`:

    [Unit]
    Description=Expense tracker
    After=network.target
    [Service]
    WorkingDirectory=/home/pi/expense-tracker
    ExecStart=/usr/bin/node server.js
    Restart=always
    User=pi
    [Install]
    WantedBy=multi-user.target

Then: `sudo systemctl enable --now expenses`
