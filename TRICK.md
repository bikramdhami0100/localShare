v.prod.example to the repo so the steps are turnkey. Here's exactly what to do:
0. On your computer — get a free domain (5 min)
1. Go to https://www.duckdns.org, sign in with any provider (Google/GitHub…).
2. Under Domains, type e.g. yourshare, click Add domain → you now own yourshare.duckdns.org.
3. The token is shown next to it — keep it. In a terminal run once (points it at your VPS IP):
curl "https://www.duckdns.org/update?domains=yourshare&token=YOUR_DUCK_DNS_TOKEN&ip="
1. On the VPS — prep
ssh root@YOUR_VPS_IP        # or ssh youruser@YOUR_VPS_IP

# update + basics
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git

# install Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
2. Get the project on the VPS
cd /opt
sudo mkdir -p apps && sudo chown $USER:apps apps 2>/dev/null; mkdir -p ~/apps
cd ~/apps
git clone <your-repo-url> localshare
#   (or: scp -r ./localShare youruser@YOUR_VPS_IP:~/apps/)
cd localshare
3. Configure
cp .env.prod.example .env.prod
nano .env.prod
# set:  DOMAIN=yourshare.duckdns.org
#        POSTGRES_PASSWORD=<long random password, e.g. openssl rand -hex 24>
4. Build & run (Postgres + app + Caddy)
docker compose -f docker-compose.prod.yml up -d --build --wait
docker compose -f docker-compose.prod.yml ps      # all 3 = healthy / running
5. Firewall — only open what's needed
sudo apt install -y ufw
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80/tcp          # Let's Encrypt / Caddy
sudo ufw allow 443/tcp         # HTTPS
sudo ufw enable
# Postgres and the app are internal-only — nothing else open.
6. Verify + ongoing
# open in your browser from anywhere:
https://yourshare.duckdns.org
# (first Caddy cert issue takes ~10–30 s)

docker compose -f docker-compose.prod.yml logs -f app    # app logs
docker compose -f docker-compose.prod.yml logs -f caddy  # TLS logs

# optional: auto-update IP if your ISP changes it (static VPS often doesn't need this)
crontab -e
# add:  */5 * * * * curl -s "https://www.duckdns.org/update?domains=yourshare&token=YOUR_TOKEN&ip=" >/dev/null 2>&1
Backup (metadata + files together)
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U localshare localshare > backup.sql
cp -r ~/apps/localshare/storage/shared-files ./files   # → same data the app writes (vol: localshare_files)
# restore:  psql -U localshare localshare < backup.sql  &&  copy files back
⚠️ Still the one open hole: the app has no login, so anyone who finds the URL can edit/delete. For a public VPS the biggest security win is adding a shared-space password — say the word and I'll implement it now (server-side password, entered once per device).
▣  Build · Big Pickle · 4m 25s
Build
/home/mstech/workspace/other