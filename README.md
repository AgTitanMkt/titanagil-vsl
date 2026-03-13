# VSL Dashboard - Python Edition

Dashboard de métricas de VSL com integração RedTrack + VTurb.

**Stack:** FastAPI (backend) + Dash/Plotly (frontend) + MySQL + SQLAlchemy

## Funcionalidades

- **Dashboard** com visão geral: Revenue, Cost, Profit, ROI, EPC, Conversões
- **Ranking de VSLs** agrupado automaticamente pelo identificador VSL (ex: VSL 70, VSL 75)
- **Filtros** por período, VSL, produto
- **Apenas landers ativas** - filtra automaticamente landers sem dados
- **Extração automática** do VSL ID do nome da lander do RedTrack
- **Comparação de períodos** (vs período anterior)
- **Dark mode** nativo

## Arquitetura

```
vsl-dash-python/
├── main.py                    # Entry point (FastAPI + Dash)
├── app/
│   ├── config.py              # Settings (env vars)
│   ├── models/
│   │   └── database.py        # SQLAlchemy models
│   ├── services/
│   │   ├── redtrack.py        # RedTrack API client
│   │   ├── vturb.py           # VTurb API client
│   │   ├── sync_service.py    # Data sync orchestrator
│   │   ├── vsl_normalizer.py  # VSL name extraction
│   │   └── dashboard_queries.py # Dashboard data queries
│   ├── routes/
│   │   └── api.py             # FastAPI REST endpoints
│   └── dash_app/
│       ├── layout.py          # Dash UI layout
│       └── callbacks.py       # Dash interactivity
├── assets/
│   └── custom.css             # Dark mode CSS
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Setup na VPS

### 1. Pré-requisitos

```bash
# Python 3.11+
sudo apt install python3.11 python3.11-venv python3-pip

# MySQL
sudo apt install mysql-server
```

### 2. Banco de Dados

```bash
mysql -u root -p
CREATE DATABASE vsl_dashboard;
CREATE USER 'vsl_user'@'localhost' IDENTIFIED BY 'VslDash2026xK9w';
GRANT ALL PRIVILEGES ON vsl_dashboard.* TO 'vsl_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Instalação

```bash
cd /var/www/vsl-dash-python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Configuração

```bash
cp .env.example .env
nano .env
# Ajuste DATABASE_URL e outras variáveis
```

### 5. Rodar

```bash
# Desenvolvimento
python main.py

# Produção com PM2
pm2 start main.py --name vsl-dashboard --interpreter python3
```

### 6. Nginx (proxy reverso)

```nginx
server {
    listen 80;
    server_name vsl.agenciatitandev.com;

    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Health check |
| POST | `/api/settings` | Salvar API key |
| GET | `/api/settings/{key}` | Buscar API key |
| POST | `/api/sync/redtrack` | Sincronizar RedTrack |
| POST | `/api/sync/vturb` | Sincronizar VTurb |
| POST | `/api/sync/all` | Sincronizar tudo |
| GET | `/api/dashboard/overview` | Dados do dashboard |
| GET | `/api/dashboard/ranking` | Ranking de VSLs |
| POST | `/api/test/redtrack` | Testar conexão RedTrack |
| POST | `/api/test/vturb` | Testar conexão VTurb |

## Otimizações

- **1 request RedTrack** por sync (agrupado por day+landing)
- **Apenas landers ativas** são processadas (revenue > 0 OR cost > 0 OR clicks > 0)
- **Cache em banco** - dados sincronizados ficam no MySQL, dashboard lê do banco
- **VSL ID automático** - extrai "VSL 70" de "MG | LP | LipoRise | VSL 70 | lifenutraforge.com"
