# Variáveis de Ambiente - VSL Dashboard

Copie este conteúdo para um arquivo `.env` na raiz do projeto e preencha os valores.

## Servidor

```
NODE_ENV=production
PORT=3000
```

## Banco de Dados MySQL

```
# Formato: mysql://usuario:senha@host:porta/database
DATABASE_URL=mysql://vsl_user:vsl_secure_pass_2026@localhost:3306/vsl_dashboard

# Se usar docker-compose, use o nome do serviço como host:
# DATABASE_URL=mysql://vsl_user:vsl_secure_pass_2026@db:3306/vsl_dashboard
```

## Docker Compose (MySQL)

```
MYSQL_ROOT_PASSWORD=vsl_root_pass_2026
MYSQL_DATABASE=vsl_dashboard
MYSQL_USER=vsl_user
MYSQL_PASSWORD=vsl_secure_pass_2026
DB_PORT=3306
APP_PORT=3000
```

## Autenticação

```
# Secret para assinar cookies de sessão JWT
# Gere com: openssl rand -hex 32
JWT_SECRET=change_me_to_a_random_64_char_string
```

## APIs Externas

As API keys do RedTrack e VTurb são configuradas pela interface do dashboard na página **Settings**. Não é necessário colocá-las no `.env`.

- **RedTrack API Key:** obtida em RedTrack > Settings > API
- **VTurb API Token:** obtido em VTurb > Configurações > API
