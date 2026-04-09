"""
Dash Callbacks

All interactive callbacks for the dashboard.
Uses direct database queries (not HTTP) for speed.
"""
import dash
from dash import Input, Output, State, callback, no_update, html, dcc
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import pandas as pd
import io
import re

from app.services.dashboard_queries import (
    get_overview, get_vsl_ranking, get_vsl_ranking_by_lander, get_lander_ranking,
    get_daily_performance, get_available_vsls, get_sync_history,
)

from app.services.sync_service import (
    sync_redtrack, sync_vturb, get_setting, set_setting, sync_offers
)
from app.services.redtrack import test_connection as test_redtrack_api
from app.services.vturb import test_connection as test_vturb_api
from app.dash_app.layout import (
    COLORS, dashboard_page, ranking_page, landers_page,
    performance_page, sync_page, settings_page, mapping_page,
    _metric_card, format_currency, format_number, roi_color, _card,
)

import asyncio


# ========== HELPER: extract lead/version/traffic from lander name ==========

def extract_lead_info(lander_name: str) -> str:
    """
    Extract lead info from lander name.
    Example: "FB | FBR-Vini | Cartpanda | ED | Vigorox Prime | VSL 75 | V1 | Lead 1"
    Returns: "V1 | Lead 1" or "" if not found.
    """
    if not lander_name:
        return ""
    segments = [s.strip() for s in lander_name.split("|")]
    lead_parts = []
    for seg in segments:
        seg_clean = seg.strip()
        # Match V1, V2, etc.
        if re.match(r'^V\d+$', seg_clean, re.IGNORECASE):
            lead_parts.append(seg_clean)
        # Match Lead 1, Lead 2, etc.
        if re.match(r'^Lead\s*\d+', seg_clean, re.IGNORECASE):
            lead_parts.append(seg_clean)
        # Match ML 1, ML 2, ML1, ML2 (Microlead)
        if re.match(r'^ML\s*\d+', seg_clean, re.IGNORECASE):
            lead_parts.append(seg_clean)
    return " | ".join(lead_parts) if lead_parts else ""


def extract_traffic_source(lander_name: str) -> str:
    """
    Extract traffic source from lander name.
    - Starts with FB → "fb"
    - Starts with YT → "yt"
    - Anything else → "native"
    """
    if not lander_name:
        return "native"
    first_segment = lander_name.split("|")[0].strip().upper()
    if first_segment.startswith("FB"):
        return "fb"
    elif first_segment.startswith("YT"):
        return "yt"
    else:
        return "native"


def get_all_leads_from_df(df: pd.DataFrame) -> list:
    """Extract all unique lead combinations from a dataframe with lander_name column."""
    leads = set()
    if "lander_name" in df.columns:
        for name in df["lander_name"]:
            lead = extract_lead_info(name)
            if lead:
                leads.add(lead)
    return sorted(leads)


def run_async(coro):
    """Run async function from sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def register_callbacks(app):
    """Register all Dash callbacks."""

    # ========== ROUTING ==========
    @app.callback(
        Output("page-content", "children"),
        Input("url", "pathname"),
    )
    def display_page(pathname):
        if pathname == "/ranking":
            return ranking_page()
        elif pathname == "/landers":
            return landers_page()
        elif pathname == "/performance":
            return performance_page()
        elif pathname == "/sync":
            return sync_page()
        elif pathname == "/mapping":
            return mapping_page()
        elif pathname == "/settings":
            return settings_page()
        return dashboard_page()


    # ========== DASHBOARD ==========
    @app.callback(
        Output("overview-cards", "children"),
        Input("period-selector", "value"),
    )
    def update_overview(period):
        if not period:
            return no_update
        data = get_overview(period)

        cards = dbc.Row(
            [
                dbc.Col(_metric_card("Revenue", format_currency(data["revenue"]), data.get("revenue_change")), md=2),
                dbc.Col(_metric_card("Cost", format_currency(data["cost"]), data.get("cost_change")), md=2),
                dbc.Col(_metric_card("Profit", format_currency(data["profit"]), data.get("profit_change"), color=COLORS["green"] if data["profit"] > 0 else COLORS["red"]), md=2),
                dbc.Col(_metric_card("ROI", f"{data['roi']}%", color=roi_color(data["roi"])), md=2),
                dbc.Col(_metric_card("EPC", f"${data['epc']:.2f}"), md=2),
                dbc.Col(_metric_card("Vendas", format_number(data["purchases"])), md=2),
            ],
            className="mb-4",
        )
        return cards

    @app.callback(
        Output("top-vsls-table", "children"),
        Input("period-selector", "value"),
    )
    def update_top_vsls(period):
        if not period:
            return no_update
        df = get_vsl_ranking(period, sort_by="cost", sort_dir="desc", only_with_vsl=True)

        if df.empty:
            return html.P("Nenhum dado encontrado. Sincronize os dados primeiro.", style={"color": COLORS["text_muted"]})

        # Show top 10
        df = df.head(10)
        rows = []
        for _, row in df.iterrows():
            roi_c = roi_color(row["roi"])
            rows.append(
                html.Tr(
                    [
                        html.Td(
                            html.Div(
                                [
                                    html.Span(row["vsl_id"], style={"fontWeight": "600", "color": COLORS["text"]}),
                                    html.Span(f" {row['product']}", style={"fontSize": "11px", "color": COLORS["text_muted"]}) if row["product"] else None,
                                ],
                            ),
                        ),
                        html.Td(format_currency(row["revenue"]), style={"textAlign": "right", "color": COLORS["text"]}),
                        html.Td(format_currency(row["cost"]), style={"textAlign": "right", "color": COLORS["text"]}),
                        html.Td(format_currency(row["profit"]), style={"textAlign": "right", "color": COLORS["green"] if row["profit"] > 0 else COLORS["red"]}),
                        html.Td(f"{row['roi']:.1f}%", style={"textAlign": "right", "color": roi_c, "fontWeight": "600"}),
                        html.Td(str(row["purchases"]), style={"textAlign": "right", "color": COLORS["text"]}),
                        html.Td(f"${row['epc']:.2f}", style={"textAlign": "right", "color": COLORS["text"]}),
                    ],
                    style={"borderBottom": f"1px solid {COLORS['card_border']}"},
                )
            )

        table = html.Table(
            [
                html.Thead(
                    html.Tr(
                        [
                            html.Th("VSL", style={"color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                            html.Th("Revenue", style={"textAlign": "right", "color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                            html.Th("Cost", style={"textAlign": "right", "color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                            html.Th("Profit", style={"textAlign": "right", "color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                            html.Th("ROI", style={"textAlign": "right", "color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                            html.Th("Vendas", style={"textAlign": "right", "color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                            html.Th("EPC", style={"textAlign": "right", "color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase"}),
                        ],
                        style={"borderBottom": f"1px solid {COLORS['card_border']}"},
                    ),
                ),
                html.Tbody(rows),
            ],
            style={"width": "100%", "fontSize": "13px"},
        )
        return table

    @app.callback(
        Output("daily-chart", "figure"),
        Input("period-selector", "value"),
    )
    def update_daily_chart(period):
        df = get_daily_performance(period)
        fig = go.Figure()
        if not df.empty:
            fig.add_trace(go.Scatter(x=df["date"], y=df["revenue"], name="Revenue", line=dict(color=COLORS["accent"], width=2), fill="tozeroy", fillcolor="rgba(59,130,246,0.1)"))
            fig.add_trace(go.Scatter(x=df["date"], y=df["cost"], name="Cost", line=dict(color=COLORS["red"], width=2, dash="dot")))
            fig.add_trace(go.Scatter(x=df["date"], y=df["profit"], name="Profit", line=dict(color=COLORS["green"], width=2)))

        fig.update_layout(
            plot_bgcolor=COLORS["card"],
            paper_bgcolor=COLORS["card"],
            font=dict(color=COLORS["text_muted"], size=11),
            margin=dict(l=40, r=20, t=20, b=40),
            height=300,
            legend=dict(orientation="h", y=1.1, x=0, font=dict(size=11)),
            xaxis=dict(gridcolor=COLORS["card_border"], showgrid=True),
            yaxis=dict(gridcolor=COLORS["card_border"], showgrid=True),
        )
        return fig


    @app.callback(
        Output("ranking-vsl-search", "options"),
        Input("url", "pathname"),
    )
    def populate_ranking_vsl_search(pathname):
        if pathname != "/ranking":
            return no_update
        from app.services.dashboard_queries import get_available_vsls
        vsls = get_available_vsls()
        return [{"label": v, "value": v} for v in vsls]

    # ========== RANKING: Populate lead filter options ==========
    @app.callback(
        Output("ranking-lead-filter", "options"),
        Input("ranking-date-range", "start_date"),
        Input("ranking-date-range", "end_date"),
        Input("ranking-vsl-search", "value"),
        Input("ranking-only-vsl", "value"),
        Input("ranking-view-mode", "value"),
    )
    def populate_lead_filter(start_date, end_date, vsl_search, only_vsl, view_mode):
        """Populate the lead filter dropdown based on current data."""
        by_lander = view_mode == "lander"
        if not by_lander:
            return []

        df = get_vsl_ranking_by_lander(
            period="30D",
            sort_by="cost",
            sort_dir="desc",
            only_with_vsl=bool(only_vsl),
            date_from_str=start_date,
            date_to_str=end_date,
            vsl_filter=vsl_search,
        )

        if df.empty:
            return []

        leads = get_all_leads_from_df(df)
        return [{"label": l, "value": l} for l in leads]

    # ========== RANKING ==========
    @app.callback(
        Output("ranking-table", "children"),
        Input("ranking-date-range", "start_date"),
        Input("ranking-date-range", "end_date"),
        Input("ranking-vsl-search", "value"),
        Input("ranking-only-vsl", "value"),
        Input("ranking-view-mode", "value"),
        Input("ranking-lead-filter", "value"),
        Input("ranking-traffic-source", "value"),
        Input("ranking-sort-column", "value"),
    )
    def update_ranking(start_date, end_date, vsl_search, only_vsl, view_mode, lead_filter, traffic_source, sort_column):
        from app.services.dashboard_queries import get_vsl_ranking, get_vsl_ranking_by_lander

        # Determine sort column
        sort_col = sort_column or "cost"

        by_lander = view_mode == "lander"

        if by_lander:
            df = get_vsl_ranking_by_lander(
                period="30D",
                sort_by=sort_col,
                sort_dir="desc",
                only_with_vsl=bool(only_vsl),
                date_from_str=start_date,
                date_to_str=end_date,
                vsl_filter=vsl_search,
            )

            # Apply traffic source filter
            if traffic_source and traffic_source != "all" and not df.empty:
                mask = df["lander_name"].apply(lambda x: extract_traffic_source(x) == traffic_source)
                df = df[mask].reset_index(drop=True)

            # Apply lead filter
            if lead_filter and not df.empty:
                if isinstance(lead_filter, str):
                    lead_filter = [lead_filter]
                if lead_filter:
                    def matches_lead(lander_name):
                        lead_info = extract_lead_info(lander_name)
                        for lf in lead_filter:
                            if lf in lead_info:
                                return True
                        return False
                    mask = df["lander_name"].apply(matches_lead)
                    df = df[mask].reset_index(drop=True)

        else:
            df = get_vsl_ranking(
                period="30D",
                sort_by=sort_col,
                sort_dir="desc",
                only_with_vsl=bool(only_vsl),
                date_from_str=start_date,
                date_to_str=end_date,
                vsl_filter=vsl_search,
            )

        if df.empty:
            return _card("Ranking", html.P("Nenhum dado encontrado para o periodo selecionado.",
                         style={"color": COLORS["text_muted"], "textAlign": "center", "padding": "40px"}))

        rows = []
        for _, r in df.iterrows():
            if by_lander:
                # ---- MODO POR LANDER: clique para expandir nome completo ----
                lander_full = r["lander_name"]
                lander_short = lander_full[:45] + "..." if len(lander_full) > 45 else lander_full

                # Extract lead info for display
                lead_info = extract_lead_info(lander_full)
                traffic_src = extract_traffic_source(lander_full)
                traffic_badge_color = {"fb": "#1877F2", "yt": "#FF0000", "native": "#22c55e"}.get(traffic_src, "#71717a")
                traffic_label = {"fb": "FB", "yt": "YT", "native": "NT"}.get(traffic_src, "?")

                if len(lander_full) > 45:
                    lander_display = html.Details([
                        html.Summary(lander_short, style={
                            "fontSize": "11px",
                            "color": COLORS["text_muted"],
                            "cursor": "pointer",
                            "listStyle": "none",
                            "outline": "none",
                        }),
                        html.Div(lander_full, style={
                            "fontSize": "11px",
                            "color": COLORS["text"],
                            "fontWeight": "500",
                            "marginTop": "4px",
                            "padding": "6px 8px",
                            "backgroundColor": "rgba(59,130,246,0.08)",
                            "borderRadius": "4px",
                            "wordBreak": "break-word",
                            "lineHeight": "1.5",
                        }),
                    ], style={"marginTop": "2px"})
                else:
                    lander_display = html.Div(lander_full, style={
                        "fontSize": "11px",
                        "color": COLORS["text_muted"],
                        "marginTop": "2px",
                    })

                name_display = html.Div([
                    html.Div([
                        html.Span(traffic_label, style={
                            "fontSize": "9px",
                            "color": "#fff",
                            "backgroundColor": traffic_badge_color,
                            "padding": "1px 5px",
                            "borderRadius": "3px",
                            "marginRight": "6px",
                            "fontWeight": "600",
                        }),
                        html.Span(r["vsl_id"], style={"fontWeight": "700", "color": COLORS["text"], "fontSize": "14px"}),
                        html.Span(f' | {r["product"]}', style={"fontSize": "11px", "color": COLORS["accent"], "marginLeft": "4px"}) if r["product"] else None,
                        html.Span(f'  {lead_info}', style={"fontSize": "10px", "color": "#a78bfa", "marginLeft": "6px"}) if lead_info else None,
                    ]),
                    lander_display,
                    html.Div(f"Player: {r['player_id'][:20]}", style={"fontSize": "9px", "color": "#60a5fa", "marginTop": "1px"}) if r.get("player_id") else None,
                ], style={"minWidth": "320px"})

            else:
                # ---- MODO AGRUPADO: clique para expandir lista de landers ----
                landers_list = r.get("landers", [])
                first_lander = landers_list[0] if landers_list else ""
                first_short = first_lander[:50] + "..." if len(first_lander) > 50 else first_lander

                if len(landers_list) > 1:
                    all_landers_div = []
                    for ln in landers_list:
                        all_landers_div.append(
                            html.Div(ln, style={
                                "fontSize": "10px",
                                "color": COLORS["text"],
                                "padding": "3px 0",
                                "borderBottom": f"1px solid {COLORS['card_border']}",
                                "wordBreak": "break-word",
                                "lineHeight": "1.4",
                            })
                        )
                    lander_display = html.Details([
                        html.Summary(
                            html.Span([
                                html.Span(first_short, style={"color": COLORS["text_muted"]}),
                                html.Span(f"  +{len(landers_list) - 1} mais", style={"color": COLORS["accent"], "fontStyle": "italic"}),
                            ]),
                            style={
                                "fontSize": "10px",
                                "cursor": "pointer",
                                "listStyle": "none",
                                "outline": "none",
                            },
                        ),
                        html.Div(all_landers_div, style={
                            "marginTop": "4px",
                            "padding": "6px 8px",
                            "backgroundColor": "rgba(59,130,246,0.06)",
                            "borderRadius": "4px",
                            "maxHeight": "200px",
                            "overflowY": "auto",
                        }),
                    ], style={"marginTop": "3px"})
                elif landers_list:
                    lander_display = html.Div(first_lander, title=first_lander, style={
                        "fontSize": "10px",
                        "color": COLORS["text_muted"],
                        "marginTop": "3px",
                        "wordBreak": "break-word",
                    })
                else:
                    lander_display = None

                name_display = html.Div([
                    html.Div([
                        html.Span(r["vsl_id"], style={"fontWeight": "700", "color": COLORS["text"], "fontSize": "14px"}),
                        html.Span(f' | {r["product"]}', style={"fontSize": "11px", "color": COLORS["accent"], "marginLeft": "4px"}) if r["product"] else None,
                        html.Span(f'  ({r["lander_count"]} landers)', style={"fontSize": "10px", "color": COLORS["text_muted"], "marginLeft": "6px"}),
                    ]),
                    lander_display,
                ], style={"minWidth": "320px"})

            profit_color = "#22c55e" if r["profit"] > 0 else "#ef4444"
            roi_val = r["roi"]
            if roi_val < 0:
                roi_c = "#ef4444"
            elif roi_val <= 10:
                roi_c = "#eab308"
            else:
                roi_c = "#22c55e"

            plays_display = format_number(r.get("plays", 0)) if r.get("plays", 0) > 0 else ""
            wr_display = f'{r.get("watch_rate", 0):.1f}%' if r.get("plays", 0) > 0 else ""
            hr_display = f'{r.get("hook_rate", 0):.1f}%' if r.get("viewed", 0) > 0 else ""
            br_display = f'{r.get("body_rate", 0):.1f}%' if r.get("body_rate", 0) > 0 else ""

            rows.append(
                html.Tr(
                    [
                        html.Td(name_display),
                        html.Td(format_currency(r["revenue"]), style={"textAlign": "right"}),
                        html.Td(format_currency(r["cost"]), style={"textAlign": "right"}),
                        html.Td(format_currency(r["profit"]), style={"textAlign": "right", "color": profit_color}),
                        html.Td(f'{roi_val:.1f}%', style={"textAlign": "right", "color": roi_c, "fontWeight": "600"}),
                        html.Td(str(r["purchases"]) if r["purchases"] > 0 else "", style={"textAlign": "right"}),
                        html.Td(format_currency(r["epc"]) if r["epc"] > 0 else "", style={"textAlign": "right"}),
                        html.Td(f'{r["conv_rate"]:.1f}%' if r["conv_rate"] > 0 else "", style={"textAlign": "right"}),
                        html.Td(plays_display, style={"textAlign": "right", "color": "#60a5fa"}),
                        html.Td(wr_display, style={"textAlign": "right", "color": "#a78bfa"}),
                        html.Td(hr_display, style={"textAlign": "right", "color": "#34d399"}),
                        html.Td(br_display, style={"textAlign": "right", "color": "#f59e0b"}),
                        html.Td(str(r["clicks"]) if r["clicks"] > 0 else "", style={"textAlign": "right"}),
                    ],
                    style={"borderBottom": f"1px solid {COLORS['card_border']}"},
                )
            )

        # Column keys for sorting reference
        col_keys = ["vsl", "revenue", "cost", "profit", "roi", "purchases", "epc", "conv_rate", "plays", "watch_rate", "hook_rate", "body_rate", "clicks"]
        headers = ["VSL", "REVENUE", "COST", "PROFIT", "ROI", "VENDAS", "EPC", "CR", "PLAYS", "WATCH RATE", "HOOK RATE", "BODY RATE", "CLICKS"]

        mode_label = "Por Lander" if by_lander else "Agrupado por VSL"

        # Build header cells with sort indicator
        header_cells = []
        for i, h in enumerate(headers):
            style = {
                "color": COLORS["text_muted"],
                "fontSize": "11px",
                "textTransform": "uppercase",
                "padding": "8px 12px",
                "textAlign": "right" if i > 0 else "left",
                "whiteSpace": "nowrap",
            }
            if i == 0:
                style["minWidth"] = "320px"

            # Add sort indicator arrow
            sort_indicator = ""
            if i > 0 and i < len(col_keys):
                if col_keys[i] == sort_col:
                    sort_indicator = " ▼"
                    style["color"] = COLORS["accent"]
                    style["fontWeight"] = "700"

            header_cells.append(html.Th(f"{h}{sort_indicator}", style=style))

        return _card(
            f"Ranking ({len(df)} {'landers' if by_lander else 'VSLs'}) - {mode_label}",
            html.Div(
                html.Table(
                    [
                        html.Thead(
                            html.Tr(header_cells, style={"borderBottom": f"2px solid {COLORS['card_border']}"}),
                        ),
                        html.Tbody(rows),
                    ],
                    style={"width": "100%", "fontSize": "13px", "tableLayout": "auto"},
                ),
                style={"overflowX": "auto"},
            ),
        )



    @app.callback(
        Output("ranking-csv-download", "data"),
        Input("ranking-csv-btn", "n_clicks"),
        State("ranking-date-range", "start_date"),
        State("ranking-date-range", "end_date"),
        State("ranking-only-vsl", "value"),
        State("ranking-view-mode", "value"),
        State("ranking-vsl-search", "value"),
        prevent_initial_call=True,
    )
    def export_csv(n_clicks, start_date, end_date, only_vsl, view_mode, vsl_search):
        if not n_clicks:
            return no_update
        only = bool(only_vsl)
        by_lander = view_mode == "lander"

        if by_lander:
            df = get_vsl_ranking_by_lander(
                period="30D",
                sort_by="cost",
                sort_dir="desc",
                only_with_vsl=only,
                date_from_str=start_date,
                date_to_str=end_date,
                vsl_filter=vsl_search,
            )
        else:
            df = get_vsl_ranking(
                period="30D",
                sort_by="cost",
                sort_dir="desc",
                only_with_vsl=only,
                date_from_str=start_date,
                date_to_str=end_date,
                vsl_filter=vsl_search,
            )

        if df.empty:
            return no_update
        export_df = df.drop(columns=["landers"], errors="ignore")
        return dcc.send_data_frame(export_df.to_csv, "vsl-ranking.csv", index=False)

    # ========== LANDERS ==========
    @app.callback(
        Output("landers-table-container", "children"),
        Input("lander-period", "value"),
        Input("lander-vsl-filter", "value"),
        Input("lander-only-vsl", "value"),
    )
    def update_landers(period, vsl_filter, only_vsl):
        if not period:
            return no_update
        only = "yes" in (only_vsl or [])
        df = get_lander_ranking(period, vsl_filter=vsl_filter, sort_by="cost", sort_dir="desc", only_with_vsl=only)
        if df.empty:
            return html.P("Nenhum dado encontrado.", style={"color": COLORS["text_muted"], "textAlign": "center", "padding": "40px"})

        rows = []
        for _, row in df.iterrows():
            roi_c = roi_color(row["roi"])
            rows.append(
                html.Tr(
                    [
                        html.Td(
                            html.Div(
                                [
                                    html.Div(row["lander_name"][:80], style={"fontWeight": "500", "color": COLORS["text"], "fontSize": "12px"}),
                                    html.Div(
                                        [
                                            html.Span(row["vsl_id"], style={"fontSize": "10px", "color": COLORS["accent"]}),
                                            html.Span(f" | {row['product']}", style={"fontSize": "10px", "color": COLORS["text_muted"]}) if row["product"] else None,
                                        ],
                                        className="mt-1",
                                    ),
                                ],
                            ),
                        ),
                        html.Td(format_currency(row["revenue"]), style={"textAlign": "right", "color": COLORS["text"]}),
                        html.Td(format_currency(row["cost"]), style={"textAlign": "right", "color": COLORS["text"]}),
                        html.Td(format_currency(row["profit"]), style={"textAlign": "right", "color": COLORS["green"] if row["profit"] > 0 else COLORS["red"]}),
                        html.Td(f"{row['roi']:.1f}%", style={"textAlign": "right", "color": roi_c, "fontWeight": "600"}),
                        html.Td(str(row["purchases"]), style={"textAlign": "right", "color": COLORS["text"]}),
                        html.Td(f"${row['epc']:.2f}", style={"textAlign": "right", "color": COLORS["text"]}),
                    ],
                    style={"borderBottom": f"1px solid {COLORS['card_border']}"},
                )
            )

        return _card(
            f"Landers ({len(df)})",
            html.Table(
                [
                    html.Thead(
                        html.Tr(
                            [html.Th(h, style={"color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase", "textAlign": "right" if i > 0 else "left", "padding": "8px"})
                             for i, h in enumerate(["Lander", "Revenue", "Cost", "Profit", "ROI", "Vendas", "EPC"])],
                            style={"borderBottom": f"2px solid {COLORS['card_border']}"},
                        ),
                    ),
                    html.Tbody(rows),
                ],
                style={"width": "100%", "fontSize": "13px"},
            ),
        )


    @app.callback(
        Output("lander-vsl-filter", "options"),
        Input("lander-period", "value"),
    )
    def update_lander_vsl_options(period):
        vsls = get_available_vsls()
        return [{"label": v, "value": v} for v in vsls]

    # ========== PERFORMANCE ==========
    @app.callback(
        [
            Output("perf-revenue-cost", "figure"),
            Output("perf-profit", "figure"),
            Output("perf-purchases", "figure"),
            Output("perf-clicks", "figure"),
        ],
        Input("perf-period", "value"),
        Input("perf-vsl-filter", "value"),
    )
    def update_performance_charts(period, vsl_filter):
        df = get_daily_performance(period, vsl_filter)
        base_layout = dict(
            plot_bgcolor=COLORS["card"],
            paper_bgcolor=COLORS["card"],
            font=dict(color=COLORS["text_muted"], size=11),
            margin=dict(l=40, r=20, t=20, b=40),
            height=280,
            xaxis=dict(gridcolor=COLORS["card_border"]),
            yaxis=dict(gridcolor=COLORS["card_border"]),
        )

        # Revenue vs Cost
        fig1 = go.Figure()
        if not df.empty:
            fig1.add_trace(go.Bar(x=df["date"], y=df["revenue"], name="Revenue", marker_color=COLORS["accent"]))
            fig1.add_trace(go.Bar(x=df["date"], y=df["cost"], name="Cost", marker_color=COLORS["red"]))
        fig1.update_layout(**base_layout, barmode="group", legend=dict(orientation="h", y=1.1))

        # Profit
        fig2 = go.Figure()
        if not df.empty:
            colors = [COLORS["green"] if v >= 0 else COLORS["red"] for v in df["profit"]]
            fig2.add_trace(go.Bar(x=df["date"], y=df["profit"], marker_color=colors))
        fig2.update_layout(**base_layout)

        # Purchases
        fig3 = go.Figure()
        if not df.empty:
            fig3.add_trace(go.Scatter(x=df["date"], y=df["purchases"], fill="tozeroy", fillcolor="rgba(168,85,247,0.15)", line=dict(color=COLORS["purple"], width=2)))
        fig3.update_layout(**base_layout)

        # Clicks
        fig4 = go.Figure()
        if not df.empty:
            fig4.add_trace(go.Scatter(x=df["date"], y=df["clicks"], fill="tozeroy", fillcolor="rgba(59,130,246,0.15)", line=dict(color=COLORS["accent"], width=2)))
        fig4.update_layout(**base_layout)

        return fig1, fig2, fig3, fig4

    @app.callback(
        Output("perf-vsl-filter", "options"),
        Input("perf-period", "value"),
    )
    def update_perf_vsl_options(period):
        vsls = get_available_vsls()
        return [{"label": v, "value": v} for v in vsls]

    # ========== SYNC ==========
    @app.callback(
        Output("sync-rt-result", "children"),
        Input("sync-rt-btn", "n_clicks"),
        State("sync-rt-from", "date"),
        State("sync-rt-to", "date"),
        prevent_initial_call=True,
    )
    def do_sync_redtrack(n_clicks, date_from, date_to):
        if not n_clicks:
            return no_update
        result = run_async(sync_redtrack(date_from, date_to))
        # Also sync offers (ClickBank)
        offer_result = run_async(sync_offers(date_from, date_to))
        total_records = result.get("records", 0) + offer_result.get("records", 0)
        if result["success"]:
            return dbc.Alert(
                f"Sincronizado! {result['records']} landers + {offer_result.get('records', 0)} offers processados.",
                color="success", className="mt-2"
            )
        return dbc.Alert(f"Erro: {result.get('error', 'Unknown')}", color="danger", className="mt-2")


    @app.callback(
        Output("sync-vt-result", "children"),
        Input("sync-vt-btn", "n_clicks"),
        State("sync-vt-from", "date"),
        State("sync-vt-to", "date"),
        prevent_initial_call=True,
    )
    def do_sync_vturb(n_clicks, date_from, date_to):
        if not n_clicks:
            return no_update
        result = run_async(sync_vturb(date_from, date_to))
        if result["success"]:
            return dbc.Alert(f"Sincronizado! {result['records']} registros processados.", color="success", className="mt-2")
        return dbc.Alert(f"Erro: {result.get('error', 'Unknown')}", color="danger", className="mt-2")

    @app.callback(
        Output("sync-history", "children"),
        Input("url", "pathname"),
        Input("sync-rt-result", "children"),
        Input("sync-vt-result", "children"),
    )
    def update_sync_history(pathname, rt_result, vt_result):
        history = get_sync_history()
        if not history:
            return html.P("Nenhuma sincronizacao realizada ainda.", style={"color": COLORS["text_muted"]})

        rows = []
        for h in history:
            status_color = "success" if h["status"] == "success" else ("danger" if h["status"] == "error" else "warning")
            rows.append(
                html.Tr(
                    [
                        html.Td(h["source"].upper(), style={"color": COLORS["text"], "fontWeight": "500"}),
                        html.Td(dbc.Badge(h["status"], color=status_color, className="px-2")),
                        html.Td(f"{h['date_from']} - {h['date_to']}", style={"color": COLORS["text_muted"], "fontSize": "12px"}),
                        html.Td(str(h["records"]), style={"color": COLORS["text"], "textAlign": "right"}),
                        html.Td(h["started"], style={"color": COLORS["text_muted"], "fontSize": "12px"}),
                        html.Td(h.get("error", "")[:50] if h.get("error") else "", style={"color": COLORS["red"], "fontSize": "11px"}),
                    ],
                    style={"borderBottom": f"1px solid {COLORS['card_border']}"},
                )
            )

        return html.Table(
            [
                html.Thead(
                    html.Tr(
                        [html.Th(h, style={"color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase", "padding": "8px"})
                         for h in ["Fonte", "Status", "Periodo", "Registros", "Inicio", "Erro"]],
                        style={"borderBottom": f"2px solid {COLORS['card_border']}"},
                    ),
                ),
                html.Tbody(rows),
            ],
            style={"width": "100%", "fontSize": "13px"},
        )

    # ========== MAPPING ==========
    @app.callback(
        Output("mapping-table-container", "children"),
        Input("url", "pathname"),
    )
    def load_mapping_table(pathname):
        if pathname != "/mapping":
            return no_update

        from app.models.database import Lander, LanderDailyStats, Offer, OfferDailyStats, get_session
        from sqlalchemy import func

        session = get_session()
        try:
            # === LANDERS ===
            lander_rows = session.query(
                Lander.id,
                Lander.vsl_id,
                Lander.product,
                Lander.redtrack_name,
                Lander.vturb_player_id,
                func.sum(LanderDailyStats.cost).label("total_cost"),
            ).outerjoin(
                LanderDailyStats, Lander.id == LanderDailyStats.lander_id
            ).filter(
                Lander.vsl_id.isnot(None),
                Lander.is_active == 1,
            ).group_by(Lander.id).order_by(func.sum(LanderDailyStats.cost).desc()).all()

            # === OFFERS ===
            offer_rows = session.query(
                Offer.id,
                Offer.vsl_id,
                Offer.product,
                Offer.redtrack_name,
                Offer.vturb_player_id,
                func.sum(OfferDailyStats.cost).label("total_cost"),
            ).outerjoin(
                OfferDailyStats, Offer.id == OfferDailyStats.offer_id
            ).filter(
                Offer.vsl_id.isnot(None),
                Offer.is_active == 1,
            ).group_by(Offer.id).order_by(func.sum(OfferDailyStats.cost).desc()).all()

            if not lander_rows and not offer_rows:
                return html.P("Nenhuma lander/offer com VSL encontrada. Sincronize o RedTrack primeiro.",
                              style={"color": COLORS["text_muted"], "textAlign": "center", "padding": "40px"})

            # Group by VSL for display
            vsl_groups = {}

            for row in lander_rows:
                vsl = row.vsl_id or "Sem VSL"
                if vsl not in vsl_groups:
                    vsl_groups[vsl] = {"product": row.product or "", "items": []}
                vsl_groups[vsl]["items"].append({
                    "id": row.id,
                    "redtrack_name": row.redtrack_name,
                    "vturb_player_id": row.vturb_player_id,
                    "total_cost": row.total_cost,
                    "is_offer": False,
                })

            for row in offer_rows:
                vsl = row.vsl_id or "Sem VSL"
                if vsl not in vsl_groups:
                    vsl_groups[vsl] = {"product": row.product or "", "items": []}
                # Use negative ID for offers to distinguish from landers
                vsl_groups[vsl]["items"].append({
                    "id": -row.id,  # Negative = offer
                    "redtrack_name": row.redtrack_name,
                    "vturb_player_id": row.vturb_player_id,
                    "total_cost": row.total_cost,
                    "is_offer": True,
                })
                # Update product if not set
                if not vsl_groups[vsl]["product"] and row.product:
                    vsl_groups[vsl]["product"] = row.product

            table_rows = []
            total_items = 0
            for vsl_id, group in vsl_groups.items():
                n_items = len(group["items"])
                total_items += n_items
                # VSL header row
                table_rows.append(
                    html.Tr(
                        [
                            html.Td(
                                html.Div([
                                    html.Span(vsl_id, style={"fontWeight": "700", "color": COLORS["text"], "fontSize": "14px"}),
                                    html.Span(f" | {group['product']}", style={"fontSize": "11px", "color": COLORS["accent"]}) if group["product"] else None,
                                    html.Span(f" ({n_items} landers)", style={"fontSize": "11px", "color": COLORS["text_muted"], "marginLeft": "8px"}),
                                ]),
                                colSpan=4,
                            ),
                        ],
                        style={"backgroundColor": "rgba(59,130,246,0.08)", "borderBottom": f"1px solid {COLORS['card_border']}"},
                    )
                )

                # Each item (lander or offer) as its own row
                for item in group["items"]:
                    cost_display = f"${float(item['total_cost'] or 0):,.2f}"
                    has_mapping = bool(item["vturb_player_id"])
                    status = dbc.Badge("OK", color="success", className="me-1") if has_mapping else dbc.Badge("Pendente", color="warning", className="me-1")

                    full_name = item["redtrack_name"] or ""
                    short_name = full_name[:50] + "..." if len(full_name) > 50 else full_name

                    # Clique para expandir nome completo
                    if len(full_name) > 50:
                        name_element = html.Details([
                            html.Summary(short_name, style={
                                "fontSize": "11px",
                                "color": COLORS["text_muted"],
                                "cursor": "pointer",
                                "listStyle": "none",
                                "outline": "none",
                            }),
                            html.Div(full_name, style={
                                "fontSize": "11px",
                                "color": COLORS["text"],
                                "fontWeight": "500",
                                "marginTop": "4px",
                                "padding": "6px 8px",
                                "backgroundColor": "rgba(59,130,246,0.08)",
                                "borderRadius": "4px",
                                "wordBreak": "break-word",
                                "lineHeight": "1.5",
                            }),
                        ])
                    else:
                        name_element = html.Span(full_name, style={
                            "fontSize": "11px",
                            "color": COLORS["text"],
                            "fontWeight": "500",
                        })

                    table_rows.append(
                        html.Tr(
                            [
                                html.Td(
                                    html.Div([
                                        html.Div([
                                            status,
                                            html.Span(f" Cost: {cost_display}", style={
                                                "fontSize": "10px",
                                                "color": COLORS["text_muted"],
                                            }),
                                        ], style={"display": "flex", "alignItems": "center", "marginBottom": "2px"}),
                                        name_element,
                                    ]),
                                ),
                                html.Td(
                                    dbc.Input(
                                        id={"type": "player-id-input", "index": item["id"]},
                                        type="text",
                                        value=item["vturb_player_id"] or "",
                                        placeholder="Player ID do VTurb...",
                                        size="sm",
                                        style={"backgroundColor": COLORS["bg"], "color": COLORS["text"], "border": f"1px solid {COLORS['card_border']}", "fontSize": "11px"},
                                    ),
                                    style={"width": "260px", "minWidth": "260px"},
                                ),
                                html.Td(
                                    dbc.Button(
                                        "Salvar",
                                        id={"type": "save-mapping-btn", "index": item["id"]},
                                        color="primary",
                                        size="sm",
                                    ),
                                    style={"whiteSpace": "nowrap", "width": "80px"},
                                ),
                                html.Td(
                                    dbc.Button(
                                        "Copiar p/ VSL",
                                        id={"type": "copy-to-vsl-btn", "index": item["id"]},
                                        color="secondary",
                                        size="sm",
                                        outline=True,
                                    ),
                                    style={"whiteSpace": "nowrap", "width": "110px"},
                                ),
                            ],
                            style={"borderBottom": f"1px solid {COLORS['card_border']}"},
                        )
                    )


            return _card(
                f"Mapeamento VTurb ({total_items} landers em {len(vsl_groups)} VSLs)",
                html.Div([
                    html.P("Cada lander/offer pode ter seu proprio Player ID do VTurb. Use 'Copiar p/ VSL' para aplicar o mesmo ID a todas as landers e offers da mesma VSL.",
                           style={"color": COLORS["text_muted"], "fontSize": "12px", "marginBottom": "12px"}),
                    html.Table(
                        [
                            html.Thead(
                                html.Tr(
                                    [
                                        html.Th("Lander", style={"color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase", "padding": "8px", "width": "auto"}),
                                        html.Th("VTurb Player ID", style={"color": COLORS["text_muted"], "fontSize": "11px", "textTransform": "uppercase", "padding": "8px", "width": "260px"}),
                                        html.Th("", style={"width": "80px"}),
                                        html.Th("", style={"width": "110px"}),
                                    ],
                                    style={"borderBottom": f"2px solid {COLORS['card_border']}"},
                                ),
                            ),
                            html.Tbody(table_rows),
                        ],
                        style={"width": "100%", "fontSize": "12px", "tableLayout": "fixed"},
                    ),

                ]),
            )
        finally:
            session.close()

    @app.callback(
        Output("mapping-save-result", "children"),
        Input({"type": "save-mapping-btn", "index": dash.ALL}, "n_clicks"),
        Input({"type": "copy-to-vsl-btn", "index": dash.ALL}, "n_clicks"),
        State({"type": "player-id-input", "index": dash.ALL}, "value"),
        State({"type": "save-mapping-btn", "index": dash.ALL}, "id"),
        State({"type": "copy-to-vsl-btn", "index": dash.ALL}, "id"),
        prevent_initial_call=True,
    )
    def save_mapping(save_clicks, copy_clicks, player_ids, save_btn_ids, copy_btn_ids):
        from dash import ctx
        if not ctx.triggered_id:
            return no_update

        triggered_type = ctx.triggered_id.get("type", "")
        item_id = ctx.triggered_id["index"]

        # Find the matching player_id value
        player_id_value = None
        for i, btn in enumerate(save_btn_ids):
            if btn["index"] == item_id:
                player_id_value = player_ids[i]
                break

        if not player_id_value or not player_id_value.strip():
            return dbc.Alert("Cole um Player ID antes de salvar.", color="warning", duration=3000)

        from app.models.database import Lander, Offer, get_session
        session = get_session()
        try:
            # Determine if it's a lander (positive ID) or offer (negative ID)
            is_offer = item_id < 0
            real_id = abs(item_id)

            if is_offer:
                record = session.query(Offer).filter_by(id=real_id).first()
                if not record:
                    return dbc.Alert("Offer nao encontrada.", color="danger", duration=3000)
            else:
                record = session.query(Lander).filter_by(id=real_id).first()
                if not record:
                    return dbc.Alert("Lander nao encontrada.", color="danger", duration=3000)

            if triggered_type == "save-mapping-btn":
                # Save only to THIS item
                record.vturb_player_id = player_id_value.strip()
                session.commit()
                return dbc.Alert(
                    f"Player ID salvo para: {record.redtrack_name[:50]}",
                    color="success", duration=4000,
                )

            elif triggered_type == "copy-to-vsl-btn":
                # Copy to ALL landers AND offers with same VSL
                record.vturb_player_id = player_id_value.strip()
                count = 1
                if record.vsl_id:
                    # Update sibling landers
                    sibling_landers = session.query(Lander).filter(
                        Lander.vsl_id == record.vsl_id,
                    ).all()
                    for sibling in sibling_landers:
                        if not is_offer or sibling.id != real_id:
                            sibling.vturb_player_id = player_id_value.strip()
                            if is_offer or sibling.id != real_id:
                                count += 1

                    # Update sibling offers
                    sibling_offers = session.query(Offer).filter(
                        Offer.vsl_id == record.vsl_id,
                    ).all()
                    for sibling in sibling_offers:
                        if is_offer and sibling.id == real_id:
                            continue  # Already updated above
                        sibling.vturb_player_id = player_id_value.strip()
                        count += 1

                session.commit()
                return dbc.Alert(
                    f"Player ID copiado para todas as {count} landers/offers da {record.vsl_id}!",
                    color="success", duration=4000,
                )

        except Exception as e:
            session.rollback()
            return dbc.Alert(f"Erro: {e}", color="danger", duration=5000)
        finally:
            session.close()

    # ========== SETTINGS ==========
    @app.callback(
        Output("rt-save-result", "children"),
        Input("rt-save-btn", "n_clicks"),
        Input("rt-test-btn", "n_clicks"),
        State("rt-api-key-input", "value"),
        prevent_initial_call=True,
    )
    def handle_rt_settings(save_clicks, test_clicks, api_key):
        from dash import ctx
        triggered = ctx.triggered_id

        if triggered == "rt-save-btn" and api_key:
            try:
                set_setting("redtrack_api_key", api_key, "RedTrack API Key")
                return dbc.Alert("API Key salva com sucesso!", color="success", duration=4000)
            except Exception as e:
                return dbc.Alert(f"Erro: {e}", color="danger")

        if triggered == "rt-test-btn":
            try:
                result = run_async(test_redtrack_api(api_key or get_setting("redtrack_api_key")))
                return dbc.Alert("Conectado!", color="success", duration=4000)
            except Exception as e:
                return dbc.Alert(f"Erro: {e}", color="danger")

        return no_update

    @app.callback(
        Output("vt-save-result", "children"),
        Input("vt-save-btn", "n_clicks"),
        Input("vt-test-btn", "n_clicks"),
        State("vt-api-key-input", "value"),
        prevent_initial_call=True,
    )
    def handle_vt_settings(save_clicks, test_clicks, api_token):
        from dash import ctx
        triggered = ctx.triggered_id

        if triggered == "vt-save-btn" and api_token:
            try:
                set_setting("vturb_api_token", api_token, "VTurb API Token")
                return dbc.Alert("Token salvo com sucesso!", color="success", duration=4000)
            except Exception as e:
                return dbc.Alert(f"Erro: {e}", color="danger")

        if triggered == "vt-test-btn":
            try:
                result = run_async(test_vturb_api(api_token or get_setting("vturb_api_token")))
                return dbc.Alert("Conectado!", color="success", duration=4000)
            except Exception as e:
                return dbc.Alert(f"Erro: {e}", color="danger")

        return no_update

    @app.callback(
        Output("rt-key-status", "children"),
        Output("vt-key-status", "children"),
        Input("url", "pathname"),
    )
    def load_key_status(pathname):
        rt_key = get_setting("redtrack_api_key")
        vt_key = get_setting("vturb_api_token")

        rt_status = dbc.Badge("Configurada", color="success") if rt_key else dbc.Badge("Nao configurada", color="warning")
        vt_status = dbc.Badge("Configurado", color="success") if vt_key else dbc.Badge("Nao configurado", color="warning")

        return rt_status, vt_status
