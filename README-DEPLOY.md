# VSL Performance Dashboard - Guia de Deploy na VPS

## Visão Geral

Este guia explica como rodar o VSL Dashboard na sua própria VPS com domínio customizado.

O projeto usa **Node.js 22**, **MySQL 8**, **React 19** e **tRPC 11**.

---

## Pré-requisitos

- VPS com Ubuntu 22.04+ (mínimo 1GB RAM, 1 vCPU)
- Docker e Docker Compose instalados
- Domínio apontando para o IP da VPS (DNS A record)
- Portas 80 e 443 abertas no firewall

---

## Opção 1: Deploy com Docker Compose (Recomendado)

### 1. Clonar/Copiar o projeto

```bash
# Copie os arquivos para a VPS
scp -r vsl-dashboard/ user@sua-vps:/home/user/vsl-dashboard/

# Ou clone do GitHub se exportou
git clone https://github.com/seu-user/vsl-dashboard.git
cd vsl-dashboard
```

### 2. Configurar variáveis de ambiente

```bash
# Criar arquivo .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# MySQL
MYSQL_ROOT_PASSWORD=SUA_SENHA_ROOT_FORTE
MYSQL_DATABASE=vsl_dashboard
MYSQL_USER=vsl_user
MYSQL_PASSWORD=SUA_SENHA_FORTE

# JWT Secret (gere com: openssl rand -hex 32)
JWT_SECRET=COLE_AQUI_O_RESULTADO_DO_OPENSSL

# Portas
DB_PORT=3306
APP_PORT=3000
EOF
```

### 3. Subir os containers

```bash
docker compose up -d --build
```

### 4. Rodar migrações do banco

```bash
# Aguarde o MySQL iniciar (~30s), depois:
docker compose exec app node scripts/migrate.mjs
```

### 5. Gerar token de acesso (autenticação)

Como o sistema original usa Manus OAuth, na VPS você precisa gerar um token manualmente:

```bash
docker compose exec app node scripts/setup-standalone-auth.mjs
```

O script vai gerar um token JWT. Copie-o e cole no console do browser conforme instruções exibidas.

### 6. Acessar o dashboard

Abra `http://IP_DA_VPS:3000` no navegador.

---

## Opção 2: Deploy Manual (sem Docker)

### 1. Instalar Node.js 22 e pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable
corepack prepare pnpm@10.4.1 --activate
```

### 2. Instalar MySQL 8

```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Criar banco e usuário
sudo mysql -e "
  CREATE DATABASE vsl_dashboard;
  CREATE USER 'vsl_user'@'localhost' IDENTIFIED BY 'SUA_SENHA_FORTE';
  GRANT ALL PRIVILEGES ON vsl_dashboard.* TO 'vsl_user'@'localhost';
  FLUSH PRIVILEGES;
"
```

### 3. Configurar o projeto

```bash
cd vsl-dashboard

# Criar .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://vsl_user:SUA_SENHA_FORTE@localhost:3306/vsl_dashboard
JWT_SECRET=COLE_AQUI_O_RESULTADO_DO_OPENSSL
EOF

# Instalar dependências
pnpm install

# Rodar migrações
node scripts/migrate.mjs

# Build de produção
pnpm build
```

### 4. Rodar com PM2 (process manager)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar
pm2 start dist/index.js --name vsl-dashboard

# Configurar para iniciar no boot
pm2 startup
pm2 save
```

### 5. Gerar token de acesso

```bash
node scripts/setup-standalone-auth.mjs
```

---

## Configurar Domínio com Nginx + SSL

### 1. Instalar Nginx e Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configurar Nginx

```bash
# Copiar configuração de exemplo
sudo cp nginx.conf.example /etc/nginx/sites-available/vsl-dashboard

# Editar e trocar "dashboard.seusite.com" pelo seu domínio
sudo nano /etc/nginx/sites-available/vsl-dashboard

# Ativar o site
sudo ln -s /etc/nginx/sites-available/vsl-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Gerar certificado SSL

```bash
# Primeiro, comente o bloco HTTPS no nginx e use apenas HTTP
# Depois rode o certbot:
sudo certbot --nginx -d dashboard.seusite.com

# O Certbot vai configurar o SSL automaticamente
```

---

## Estrutura de Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile` | Build multi-stage para container de produção |
| `docker-compose.yml` | Orquestra MySQL + App |
| `ENV-VARIABLES.md` | Documentação de todas as variáveis de ambiente |
| `nginx.conf.example` | Configuração Nginx para proxy reverso com SSL |
| `scripts/migrate.mjs` | Script de migração do banco de dados |
| `scripts/setup-standalone-auth.mjs` | Gera token JWT para acesso sem Manus OAuth |
| `drizzle/schema.ts` | Schema do banco de dados (Drizzle ORM) |

---

## Configurar APIs (RedTrack e VTurb)

Após acessar o dashboard:

1. Vá em **Settings** no menu lateral
2. Configure a **RedTrack API Key** (obtida em RedTrack > Settings > API)
3. Configure o **VTurb API Token** (obtido em VTurb > Configurações > API)
4. Teste as conexões clicando nos botões de teste
5. Vá em **Sync** e sincronize os dados

---

## Troubleshooting

### Container não inicia
```bash
docker compose logs app
docker compose logs db
```

### Erro de conexão com MySQL
```bash
# Verificar se MySQL está rodando
docker compose ps
# Aguardar healthcheck
docker compose exec db mysqladmin ping -h localhost -u root -pSUA_SENHA
```

### Token expirou
```bash
# Gerar novo token
docker compose exec app node scripts/setup-standalone-auth.mjs
# Ou sem Docker:
node scripts/setup-standalone-auth.mjs
```

### Build falha
```bash
# Limpar cache e rebuildar
docker compose down
docker system prune -f
docker compose up -d --build --force-recreate
```

---

## Atualizações

Para atualizar o dashboard:

```bash
# Com Docker
cd vsl-dashboard
git pull  # ou copie os novos arquivos
docker compose up -d --build

# Sem Docker
cd vsl-dashboard
git pull
pnpm install
pnpm build
pm2 restart vsl-dashboard
```

---

## Backup do Banco

```bash
# Com Docker
docker compose exec db mysqldump -u root -pSUA_SENHA vsl_dashboard > backup.sql

# Sem Docker
mysqldump -u vsl_user -pSUA_SENHA vsl_dashboard > backup.sql

# Restaurar
mysql -u vsl_user -pSUA_SENHA vsl_dashboard < backup.sql
```
