"""
Dash Frontend Layout

Dark mode SaaS-style dashboard with:
- Overview cards
- VSL Ranking table
- Lander detail table
- Performance charts
- Settings page
- Sync page
"""
import dash
from dash import html, dcc, dash_table, callback, Input, Output, State, no_update
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import httpx
import json
from datetime import datetime, timedelta

# Dark theme colors
COLORS = {
    "bg": "#0f1117",
    "card": "#1a1d27",
    "card_border": "#2a2d3a",
    "text": "#e4e4e7",
    "text_muted": "#71717a",
    "accent": "#3b82f6",
    "green": "#22c55e",
    "red": "#ef4444",
    "yellow": "#eab308",
    "purple": "#a855f7",
}

PERIODS = [
    {"label": "3 Dias", "value": "3D"},
    {"label": "7 Dias", "value": "7D"},
    {"label": "14 Dias", "value": "14D"},
    {"label": "30 Dias", "value": "30D"},
    {"label": "45 Dias", "value": "45D"},
    {"label": "60 Dias", "value": "60D"},
    {"label": "Total", "value": "TOTAL"},
]

API_BASE = ""  # Same origin


def create_layout():
    """Create the main Dash layout."""
    return dbc.Container(
        [
            dcc.Location(id="url", refresh=False),
            dcc.Store(id="current-period", data="30D"),
            dcc.Store(id="overview-data", data={}),
            dcc.Store(id="ranking-data", data=[]),
            dcc.Store(id="daily-data", data=[]),

            # Sidebar + Content
            dbc.Row(
                [
                    # Sidebar
                    dbc.Col(
                        _sidebar(),
                        width=2,
                        className="p-0",
                        style={
                            "backgroundColor": COLORS["card"],
                            "minHeight": "100vh",
                            "borderRight": f"1px solid {COLORS['card_border']}",
                            "position": "fixed",
                            "top": 0,
                            "left": 0,
                            "width": "220px",
                            "zIndex": 100,
                        },
                    ),
                    # Main Content
                    dbc.Col(
                        html.Div(id="page-content"),
                        style={
                            "marginLeft": "220px",
                            "padding": "24px",
                            "backgroundColor": COLORS["bg"],
                            "minHeight": "100vh",
                        },
                    ),
                ],
                className="g-0",
            ),
        ],
        fluid=True,
        style={"backgroundColor": COLORS["bg"], "padding": 0, "margin": 0},
    )


def _sidebar():
    """Create sidebar navigation."""
    nav_items = [
        {"label": "Dashboard", "href": "/", "icon": "bi-grid-1x2-fill"},
        {"label": "Ranking VSLs", "href": "/ranking", "icon": "bi-trophy-fill"},
        {"label": "Landers", "href": "/landers", "icon": "bi-layers-fill"},
        {"label": "Performance", "href": "/performance", "icon": "bi-graph-up"},
        {"label": "Sync", "href": "/sync", "icon": "bi-arrow-repeat"},
        {"label": "Mapeamento", "href": "/mapping", "icon": "bi-link-45deg"},
        {"label": "Settings", "href": "/settings", "icon": "bi-gear-fill"},

    ]

    return html.Div(
        [
            # Logo
            html.Div(
                [
                    html.I(className="bi bi-bar-chart-fill me-2", style={"fontSize": "20px", "color": COLORS["accent"]}),
                    html.Span("VSL Dashboard", style={"fontSize": "16px", "fontWeight": "700", "color": COLORS["text"]}),
                ],
                className="d-flex align-items-center p-3 mb-2",
                style={"borderBottom": f"1px solid {COLORS['card_border']}"},
            ),
            # Nav items
            html.Div(
                [
                    dcc.Link(
                        html.Div(
                            [
                                html.I(className=f"bi {item['icon']} me-2", style={"fontSize": "14px"}),
                                html.Span(item["label"], style={"fontSize": "13px"}),
                            ],
                            className="d-flex align-items-center px-3 py-2 rounded",
                            style={"color": COLORS["text_muted"], "cursor": "pointer"},
                        ),
                        href=item["href"],
                        style={"textDecoration": "none"},
                    )
                    for item in nav_items
                ],
                className="px-2",
            ),
        ],
    )


# ========== PAGE LAYOUTS ==========

def dashboard_page():
    """Main dashboard page."""
    return html.Div(
        [
            # Header
            dbc.Row(
                [
                    dbc.Col(
                        [
                            html.H4("Dashboard", className="mb-1", style={"color": COLORS["text"], "fontWeight": "700"}),
                            html.P("Visao geral de performance das suas VSLs", style={"color": COLORS["text_muted"], "fontSize": "13px"}),
                        ],
                    ),
                    dbc.Col(
                        dcc.Dropdown(
                            id="period-selector",
                            options=PERIODS,
                            value="30D",
                            clearable=False,
                            style={"width": "150px", "backgroundColor": COLORS["card"]},
                            className="dash-dark-dropdown",
                        ),
                        width="auto",
                        className="d-flex align-items-center",
                    ),
                ],
                className="mb-4 align-items-center",
            ),

            # Overview Cards
            html.Div(id="overview-cards"),

            # Top VSLs + Chart
            dbc.Row(
                [
                    dbc.Col(
                        _card("Top VSLs por Investimento", html.Div(id="top-vsls-table")),
                        md=7,
                    ),
                    dbc.Col(
                        _card("Performance Diaria", dcc.Graph(id="daily-chart", config={"displayModeBar": False})),
                        md=5,
                    ),
                ],
                className="mb-4",
            ),
        ],
    )


def ranking_page():
    """VSL ranking page with date picker, VSL search, and view mode toggle."""
    return html.Div(
        [
            dbc.Row(
                [
                    dbc.Col(
                        [
                            html.H4("Ranking de VSLs", style={"color": COLORS["text"], "fontWeight": "700"}),
                            html.P("Comparacao detalhada agrupada por VSL", style={"color": COLORS["text_muted"], "fontSize": "13px"}),
                        ],
                        width="auto",
                    ),
                    dbc.Col(
                        html.Div(
                            [
                                dcc.DatePickerRange(
                                    id="ranking-date-range",
                                    start_date_placeholder_text="Data Inicio",
                                    end_date_placeholder_text="Data Fim",
                                    display_format="DD/MM/YYYY",
                                    className="me-2",
                                    style={"fontSize": "12px"},
                                ),
                                dcc.Dropdown(
                                    id="ranking-vsl-search",
                                    placeholder="Buscar VSL...",
                                    clearable=True,
                                    searchable=True,
                                    style={"width": "180px"},
                                    className="dash-dark-dropdown me-2",
                                ),
                                dcc.RadioItems(
                                    id="ranking-view-mode",
                                    options=[
                                        {"label": " Agrupado", "value": "grouped"},
                                        {"label": " Por Lander", "value": "lander"},
                                    ],
                                    value="grouped",
                                    inline=True,
                                    style={"color": COLORS["text"], "fontSize": "12px"},
                                    className="me-3",
                                ),
                                dbc.Checkbox(
                                    id="ranking-only-vsl",
                                    label="Apenas VSLs",
                                    value=True,
                                    className="me-3",
                                    style={"color": COLORS["text"], "fontSize": "13px"},
                                ),
                                dbc.Button(
                                    [html.I(className="bi bi-download me-1"), "CSV"],
                                    id="ranking-csv-btn",
                                    color="secondary",
                                    size="sm",
                                    outline=True,
                                ),
                                dcc.Download(id="ranking-csv-download"),
                            ],
                            style={"display": "flex", "alignItems": "center", "gap": "8px", "flexWrap": "wrap"},
                        ),
                        className="text-end",
                    ),
                ],
                className="mb-4 align-items-center",
            ),
            html.Div(id="ranking-table"),
        ],
    )




def landers_page():
    """Individual landers page."""
    return html.Div(
        [
            dbc.Row(
                [
                    dbc.Col(
                        [
                            html.H4("Landers", style={"color": COLORS["text"], "fontWeight": "700"}),
                            html.P("Detalhamento individual de cada lander do RedTrack", style={"color": COLORS["text_muted"], "fontSize": "13px"}),
                        ],
                    ),
                    dbc.Col(
                        html.Div(
                            [
                                dcc.Dropdown(
                                    id="lander-period",
                                    options=PERIODS,
                                    value="30D",
                                    clearable=False,
                                    style={"width": "140px"},
                                    className="dash-dark-dropdown me-2",
                                ),
                                dcc.Dropdown(
                                    id="lander-vsl-filter",
                                    placeholder="Filtrar por VSL...",
                                    clearable=True,
                                    style={"width": "180px"},
                                    className="dash-dark-dropdown",
                                ),
                                dbc.Checklist(
                                    id="lander-only-vsl",
                                    options=[{"label": " Apenas VSLs", "value": "yes"}],
                                    value=["yes"],
                                    inline=True,
                                    className="text-light ms-2",
                                    style={"fontSize": "13px"},
                                ),
                            ],
                            className="d-flex align-items-center gap-2",
                        ),
                        width="auto",
                    ),
                ],
                className="mb-4 align-items-center",
            ),
            html.Div(id="landers-table-container"),
        ],
    )



def performance_page():
    """Performance charts page."""
    return html.Div(
        [
            dbc.Row(
                [
                    dbc.Col(
                        [
                            html.H4("Performance", style={"color": COLORS["text"], "fontWeight": "700"}),
                            html.P("Graficos de performance temporal", style={"color": COLORS["text_muted"], "fontSize": "13px"}),
                        ],
                    ),
                    dbc.Col(
                        html.Div(
                            [
                                dcc.Dropdown(
                                    id="perf-period",
                                    options=PERIODS,
                                    value="30D",
                                    clearable=False,
                                    style={"width": "140px"},
                                    className="dash-dark-dropdown me-2",
                                ),
                                dcc.Dropdown(
                                    id="perf-vsl-filter",
                                    placeholder="Filtrar por VSL...",
                                    clearable=True,
                                    style={"width": "180px"},
                                    className="dash-dark-dropdown",
                                ),
                            ],
                            className="d-flex align-items-center gap-2",
                        ),
                        width="auto",
                    ),
                ],
                className="mb-4 align-items-center",
            ),
            dbc.Row(
                [
                    dbc.Col(_card("Revenue vs Cost", dcc.Graph(id="perf-revenue-cost", config={"displayModeBar": False})), md=6),
                    dbc.Col(_card("Profit Diario", dcc.Graph(id="perf-profit", config={"displayModeBar": False})), md=6),
                ],
                className="mb-4",
            ),
            dbc.Row(
                [
                    dbc.Col(_card("Vendas por Dia", dcc.Graph(id="perf-purchases", config={"displayModeBar": False})), md=6),
                    dbc.Col(_card("Clicks por Dia", dcc.Graph(id="perf-clicks", config={"displayModeBar": False})), md=6),
                ],
            ),
        ],
    )


def sync_page():
    """Sync management page."""
    return html.Div(
        [
            html.H4("Sincronizacao", style={"color": COLORS["text"], "fontWeight": "700"}),
            html.P("Sincronize dados do RedTrack e VTurb", style={"color": COLORS["text_muted"], "fontSize": "13px"}),

            dbc.Row(
                [
                    dbc.Col(
                        _card(
                            "RedTrack",
                            html.Div(
                                [
                                    html.P("Sincronizar dados de landers e metricas financeiras.", style={"color": COLORS["text_muted"], "fontSize": "13px"}),
                                    dbc.Row(
                                        [
                                            dbc.Col(dcc.DatePickerSingle(id="sync-rt-from", date=(datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"), display_format="DD/MM/YYYY"), width=4),
                                            dbc.Col(dcc.DatePickerSingle(id="sync-rt-to", date=datetime.now().strftime("%Y-%m-%d"), display_format="DD/MM/YYYY"), width=4),
                                            dbc.Col(dbc.Button("Sincronizar", id="sync-rt-btn", color="danger", size="sm"), width=4, className="d-flex align-items-end"),
                                        ],
                                        className="mb-2",
                                    ),
                                    html.Div(id="sync-rt-result"),
                                ],
                            ),
                        ),
                        md=6,
                    ),
                    dbc.Col(
                        _card(
                            "VTurb",
                            html.Div(
                                [
                                    html.P("Sincronizar metricas de video e retencao.", style={"color": COLORS["text_muted"], "fontSize": "13px"}),
                                    dbc.Row(
                                        [
                                            dbc.Col(dcc.DatePickerSingle(id="sync-vt-from", date=(datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"), display_format="DD/MM/YYYY"), width=4),
                                            dbc.Col(dcc.DatePickerSingle(id="sync-vt-to", date=datetime.now().strftime("%Y-%m-%d"), display_format="DD/MM/YYYY"), width=4),
                                            dbc.Col(dbc.Button("Sincronizar", id="sync-vt-btn", color="primary", size="sm"), width=4, className="d-flex align-items-end"),
                                        ],
                                        className="mb-2",
                                    ),
                                    html.Div(id="sync-vt-result"),
                                ],
                            ),
                        ),
                        md=6,
                    ),
                ],
                className="mb-4",
            ),

            _card("Historico de Sincronizacao", html.Div(id="sync-history")),
        ],
    )


def settings_page():
    """Settings page for API keys."""
    return html.Div(
        [
            html.H4("Configuracoes", style={"color": COLORS["text"], "fontWeight": "700"}),
            html.P("Configure as integracoes e mapeamentos", style={"color": COLORS["text_muted"], "fontSize": "13px"}),

            dbc.Row(
                [
                    dbc.Col(
                        _card(
                            "RedTrack API Key",
                            html.Div(
                                [
                                    html.Div(id="rt-key-status", className="mb-2"),
                                    dbc.Input(id="rt-api-key-input", type="password", placeholder="Insira sua RedTrack API Key", className="mb-2"),
                                    html.Div(
                                        [
                                            dbc.Button("Salvar", id="rt-save-btn", color="primary", size="sm", className="me-2"),
                                            dbc.Button("Testar Conexao", id="rt-test-btn", color="secondary", size="sm", outline=True),
                                        ],
                                    ),
                                    html.Div(id="rt-save-result", className="mt-2"),
                                ],
                            ),
                        ),
                        md=6,
                    ),
                    dbc.Col(
                        _card(
                            "VTurb API Token",
                            html.Div(
                                [
                                    html.Div(id="vt-key-status", className="mb-2"),
                                    dbc.Input(id="vt-api-key-input", type="password", placeholder="Insira seu VTurb API Token", className="mb-2"),
                                    html.Div(
                                        [
                                            dbc.Button("Salvar", id="vt-save-btn", color="primary", size="sm", className="me-2"),
                                            dbc.Button("Testar Conexao", id="vt-test-btn", color="secondary", size="sm", outline=True),
                                        ],
                                    ),
                                    html.Div(id="vt-save-result", className="mt-2"),
                                ],
                            ),
                        ),
                        md=6,
                    ),
                ],
            ),
        ],
    )

def mapping_page():
    """VTurb player mapping page."""
    return html.Div(
        [
            html.H4("Mapeamento VTurb", style={"color": COLORS["text"], "fontWeight": "700"}),
            html.P(
                "Associe o Player ID do VTurb a cada VSL/lander para puxar métricas de vídeo.",
                style={"color": COLORS["text_muted"], "fontSize": "13px"},
            ),
            dbc.Alert(
                [
                    html.I(className="bi bi-info-circle me-2"),
                    "O Player ID fica na URL do VTurb (ex: app.vturb.com.br/player/",
                    html.Strong("abc123def456"),
                    ") ou no código de embed.",
                ],
                color="info",
                className="mb-4",
                style={"fontSize": "13px"},
            ),
            html.Div(id="mapping-table-container"),
            html.Div(id="mapping-save-result"),
        ],
    )



# ========== HELPERS ==========

def _card(title, content):
    """Create a styled card."""
    return html.Div(
        [
            html.Div(
                html.Span(title, style={"fontSize": "14px", "fontWeight": "600", "color": COLORS["text"]}),
                className="px-3 py-2",
                style={"borderBottom": f"1px solid {COLORS['card_border']}"},
            ),
            html.Div(content, className="p-3"),
        ],
        style={
            "backgroundColor": COLORS["card"],
            "borderRadius": "8px",
            "border": f"1px solid {COLORS['card_border']}",
            "marginBottom": "16px",
        },
    )


def _metric_card(label, value, change=None, color=None, prefix=""):
    """Create a metric card for overview."""
    change_el = None
    if change is not None:
        change_color = COLORS["green"] if change >= 0 else COLORS["red"]
        arrow = "bi-arrow-up" if change >= 0 else "bi-arrow-down"
        change_el = html.Span(
            [html.I(className=f"bi {arrow} me-1"), f"{abs(change):.1f}%"],
            style={"fontSize": "11px", "color": change_color},
        )

    return html.Div(
        [
            html.Div(label, style={"fontSize": "11px", "color": COLORS["text_muted"], "textTransform": "uppercase", "letterSpacing": "0.5px"}),
            html.Div(
                [
                    html.Span(f"{prefix}{value}", style={"fontSize": "22px", "fontWeight": "700", "color": color or COLORS["text"]}),
                ],
                className="mt-1",
            ),
            html.Div(change_el, className="mt-1") if change_el else None,
        ],
        style={
            "backgroundColor": COLORS["card"],
            "borderRadius": "8px",
            "border": f"1px solid {COLORS['card_border']}",
            "padding": "16px",
        },
    )


def format_currency(val):
    """Format number as currency."""
    if val >= 1000:
        return f"${val:,.2f}"
    return f"${val:.2f}"


def format_number(val):
    """Format number with commas."""
    return f"{val:,}"


def roi_color(roi):
    """Get color for ROI value."""
    if roi < 0:
        return COLORS["red"]
    elif roi <= 10:
        return COLORS["yellow"]
    return COLORS["green"]
