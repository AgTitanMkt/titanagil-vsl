# Project TODO

## Database & Schema
- [x] Create vsls table (id, name, group_name, product, vturb_player_id, redtrack_landing_id)
- [x] Create vsl_performance_data table (vsl_id, date, revenue, cost, profit, clicks, conversions, total_plays, unique_plays, watch_rate, avg_watch_time, retention_data JSON, quartiles)
- [x] Create api_sync_log table for tracking sync status and cache
- [x] Run migrations via webdev_execute_sql

## Backend - API Integration Services
- [x] RedTrack service: GET /report with group=landing, date filters, rate limit handling
- [x] VTurb service: POST /events/total_by_company_players, /conversions/video_timed, /conversions/stats_by_day
- [x] Data aggregation service: combine RedTrack + VTurb data by VSL name matching
- [x] VSL name normalization (case-insensitive, numeric variations like VSL56.2 -> VSL56)
- [x] Cache/polling system respecting rate limits (RedTrack 20 RPM, VTurb 60-800 RPM)

## Backend - tRPC Routers
- [x] VSL CRUD router (list, get by id, create, update mappings)
- [x] Dashboard overview router (aggregated totals for period)
- [x] VSL ranking router (sortable, paginated)
- [x] Performance data router (time series for charts)
- [x] VSL detail router (retention data, deep analysis)
- [x] Sync/refresh router (trigger data sync from APIs)
- [x] Comparison router (current vs previous period)

## Frontend - Theme & Layout
- [x] Dark theme SaaS-style design with professional color palette
- [x] DashboardLayout with sidebar navigation
- [x] Global filters bar (date range, VSL selector, group filter)

## Frontend - Dashboard Page
- [x] Overview cards: Total Revenue, Total Cost, Total Profit, ROI, EPC, Avg Conversion Rate, Total Plays
- [x] VSL Ranking table with sortable columns (name, group, revenue, profit, ROI, plays, conversions, watch rate, EPC)
- [x] Pagination for ranking table
- [x] Period comparison badges (current vs previous with % change)

## Frontend - Charts Page
- [x] Revenue/Profit/Cost time series chart (Recharts)
- [x] Plays/Conversions time series chart
- [x] Period selector (3D, 7D, 14D, 30D, 45D, 60D, TOTAL)
- [x] Interactive tooltips and legends

## Frontend - VSL Detail Page
- [x] Video retention curve (drop-off chart)
- [x] Detailed metrics cards
- [x] Revenue per minute watched correlation
- [x] Comparison with group average
- [x] Quartile tracking visualization (25%, 50%, 75%, 100%)

## Frontend - Filters & Comparison
- [x] Date range picker (period selector)
- [x] VSL multi-select filter (via VSL Detail selector)
- [x] Group filter on ranking and performance pages
- [x] Period comparison selector (current vs previous)
- [x] Default: show all VSLs when no filter active

## Settings & Configuration
- [x] API keys configuration page (RedTrack API key, VTurb API token)
- [x] VSL-to-player mapping management
- [x] Sync status display

## Extras
- [x] CSV export for ranking table
- [ ] Alert system placeholder (ROI below threshold, watch rate below threshold)
- [x] Loading states and error handling throughout
- [x] ROI color coding (red < 0%, yellow 0-10%, green > 10%)
- [x] Zero values displayed as blank (not "0")

## Métricas Expandidas - VSL Detail (nova solicitação)
- [x] Adicionar colunas ao schema: impressions, lp_views, lp_clicks, presell_views, presell_clicks, initiate_checkouts, purchases, cpc, cpi, cpa
- [x] Atualizar db helpers para novas métricas
- [x] Atualizar routers tRPC para calcular e retornar métricas expandidas
- [x] Redesenhar VSL Detail com seções: Financeiro (Custo, Faturamento, Profit, ROI), Vendas (Vendas, CPA, CPC, CPI), Funil (Hook Rate, Body Rate, taxa presell, taxa checkout), Vídeo (plays, watch rate, retenção)
- [x] Adicionar métricas calculadas: Hook Rate, Body Rate, Presell Pass Rate, Checkout Rate, LP CTR
- [x] Exibir valores zerados como branco (não "0")
- [x] ROI color coding (red < 0%, yellow 0-10%, green > 10%)
- [x] Comparação com média do grupo para todas as novas métricas

## Bug Fixes
- [x] Taxas de funil mostrando 0.0% - sync service não mapeia campos de funil do RedTrack para novas colunas (impressions, lpViews, lpClicks, initiateCheckouts, purchases)
- [x] Remover métricas de presell do funil (presellViews, presellClicks, presellPassRate)
- [x] Simplificar sync service para mapear apenas dados reais do RedTrack
- [x] Atualizar VSL Detail page removendo seção Presell & Checkout

## Deploy VPS - Código Standalone
- [x] Analisar dependências do Manus (OAuth, env, _core) e documentar adaptações
- [x] Criar Dockerfile para build de produção
- [x] Criar docker-compose.yml com MySQL + App
- [x] Criar ENV-VARIABLES.md com todas as variáveis necessárias
- [x] Criar README-DEPLOY.md com instruções completas de setup na VPS
- [x] Empacotar código completo em ZIP para download

## Bug Fix - Deploy VPS
- [x] Remover vite-plugin-manus-runtime do build de produção
- [x] Remover script de analytics do Manus do index.html
- [x] Garantir que o frontend funciona sem Manus OAuth (standalone)
- [x] Fix: getLoginUrl() crasha quando VITE_OAUTH_PORTAL_URL não está definido na VPS (new URL(undefined))
- [ ] Remover autenticação - acesso livre sem login/JWT/cookie
