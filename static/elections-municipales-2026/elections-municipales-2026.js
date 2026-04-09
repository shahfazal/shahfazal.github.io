      "use strict";

      // ── Constants ───────────────────────────────────────────────────────────────

      const CHART_ID = "chart";

      // Switch to './data/' when deploying to shahfazal.com/elections-municipales-2026/
      const DATA = "./data/";

      const BLOC_COLORS = {
        EXG: "#cc0000",
        GAU: "#e75480",
        CENT: "#ffcc00",
        DIV: "#aaaaaa",
        DTE: "#0055a4",
        EXD: "#1a1a2e",
      };

      const BLOC_LABELS = {
        EXG: "Extrême gauche",
        GAU: "Gauche",
        CENT: "Centre",
        DIV: "Divers",
        DTE: "Droite",
        EXD: "Extrême droite",
      };

      const BLOC_ORDER = ["EXG", "GAU", "CENT", "DIV", "DTE", "EXD"];

      // Shared hovertemplate: referenced in buildTraces() and restored by applySelection()
      // Indices match CD object below: NOM=0, BLOC_LABEL=1, TRANSACTIONS=4, PRIX_FR=5, ABS_FR=6
      const HOVER_TEMPLATE =
        "<b>%{customdata[0]}</b><br>" +
        "Bloc : %{customdata[1]}<br>" +
        "Prix médian : %{customdata[5]} €/m²<br>" +
        "Abstention : %{customdata[6]} %<br>" +
        "Transactions : %{customdata[4]}" +
        "<extra></extra>";

      // Named indices for customdata arrays: avoids magic numbers throughout
      // PRIX_FR / ABS_FR are pre-formatted French strings used in hover and pinned tooltip
      const CD = {
        NOM: 0,
        BLOC_LABEL: 1,
        PRIX: 2,
        ABSTENTION: 3,
        TRANSACTIONS: 4,
        PRIX_FR: 5,
        ABS_FR: 6,
      };

      // Opacity levels for selected/unselected states
      const OPACITY = {
        FULL: 1,
        HINT: 0.15, // same-bloc non-selected points when commune selected
        DIM: 0.06, // inactive bloc or no-match
      };

      // ── Module-level state ──────────────────────────────────────────────────────
      //
      // All mutable state lives here. Event handlers only mutate state
      // then call applySelection(). Nothing else writes to these variables.

      let traceData = {}; // bloc → array of data points (set once in init)
      let communeNames = []; // populated in init, used by scatter lazy-init

      let clickedCommune = null; // single commune from point click (null = none)
      const searchedCommunes = new Set(); // multi-select from search bar
      const filteredBlocs = new Set(); // legend bloc filter (empty = no filter = all shown)

      // ── Year toggle state ────────────────────────────────────────────────────────

      let activeYear = "2024";
      const scatterDataCache = {};

      async function loadScatterData(year) {
        if (scatterDataCache[year]) return scatterDataCache[year];
        const resp = await fetch(DATA + `prix-logement-elections-${year}.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        scatterDataCache[year] = await resp.json();
        return scatterDataCache[year];
      }

      async function switchYear(year) {
        if (year === activeYear) return;
        activeYear = year;

        // Toggle button states
        document.querySelectorAll(".year-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.year === year);
        });

        // Dynamic DVF year labels
        document.getElementById("dvf-year-label").textContent = year;
        document.getElementById("dvf-year-footer").textContent = year;

        // Reload scatter data → rebuild traceData → re-render
        const data = await loadScatterData(year);
        BLOC_ORDER.forEach((b) => (traceData[b] = []));
        data.forEach((d) => {
          const b =
            traceData[d.winning_bloc] !== undefined ? d.winning_bloc : "DIV";
          traceData[b].push(d);
        });
        Plotly.react(CHART_ID, buildTraces(), buildLayout(), buildConfig());
        // Re-apply active filters/selections so state carries across year switch
        applySelection();
        if (clickedCommune) {
          const cd = findCustomdata(clickedCommune);
          if (cd) showPinnedTooltip(cd);
        } else if (searchedCommunes.size > 0) {
          showSearchTooltips();
        }

        // Reset boxplots so they re-render on next visit (or immediately if active)
        boxplotReady = false;
        if (
          document.getElementById("panel-boxplot").classList.contains("active")
        )
          initBoxPlot();


        // Reset quintile chart similarly
        quintileReady = false;
        if (
          document.getElementById("panel-quintile").classList.contains("active")
        )
          initQuintileChart();

        // Tear down PLM maps: re-init with new year data on next visit
        Object.keys(plmMaps).forEach((city) => {
          plmMaps[city].remove();
          delete plmMaps[city];
          delete plmMapInited[city];
        });
        if (document.getElementById("panel-plm").classList.contains("active")) {
          const activeCity =
            document.querySelector("[data-plm].active")?.dataset.plm || "paris";
          initPLMMap(activeCity);
        }
      }

      // ── Data fetch ──────────────────────────────────────────────────────────────

      loadScatterData("2024")
        .then((data) => init(data))
        .catch((err) => {
          const p = document.createElement("p");
          p.className = "load-error";
          p.textContent = `Erreur de chargement : ${err.message}`;
          document.getElementById(CHART_ID).appendChild(p);
        });

      // ── Initialisation (runs once after data loads) ─────────────────────────────

      function init(data) {
        // Group data by bloc
        BLOC_ORDER.forEach((b) => {
          traceData[b] = [];
        });
        data.forEach((d) => {
          const b =
            traceData[d.winning_bloc] !== undefined ? d.winning_bloc : "DIV";
          traceData[b].push(d);
        });

        communeNames = [...new Set(data.map((d) => d.nom_commune))].sort(
          (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }),
        );

        // UI events (search, tabs, year toggle) wired up regardless of active tab
        attachUIEvents(communeNames);

        // Render whichever tab is active on landing
        if (
          document.getElementById("panel-scatter").classList.contains("active")
        ) {
          initScatterPlot();
        } else if (
          document.getElementById("panel-quintile").classList.contains("active")
        ) {
          initQuintileChart();
        }

        // Tour: small delay so active chart has fully painted
        setTimeout(() => {
          document
            .getElementById("tour-help-btn")
            .addEventListener("click", launchTour);
          if (!localStorage.getItem("elections-tour-completed")) launchTour();
        }, 600);
      }

      let scatterReady = false;

      function initScatterPlot() {
        if (scatterReady) return;
        scatterReady = true;
        Plotly.newPlot(CHART_ID, buildTraces(), buildLayout(), buildConfig());
        buildCustomLegend();
        attachChartEvents();
      }

      // ── Trace builder ───────────────────────────────────────────────────────────

      function buildTraces() {
        return BLOC_ORDER.map((bloc, i) => {
          // i is the Plotly trace index
          const pts = traceData[bloc];
          return {
            type: "scatter",
            mode: "markers",
            name: BLOC_LABELS[bloc],
            showlegend: false,
            x: pts.map((d) => d.median_prix_m2),
            y: pts.map((d) => d.abstention_rate),
            // Array-indexed customdata. Indices 5-6 are pre-formatted French strings
            // so hovertemplate doesn't need locale-aware D3 format specifiers.
            customdata: pts.map((d) => [
              d.nom_commune,
              BLOC_LABELS[d.winning_bloc] || d.winning_bloc,
              d.median_prix_m2,
              d.abstention_rate,
              d.n_transactions,
              Math.round(d.median_prix_m2).toLocaleString("fr-FR"),
              d.abstention_rate.toLocaleString("fr-FR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            ]),
            hovertemplate: HOVER_TEMPLATE,
            // selected/unselected styles: not affected by legend rendering
            selected: { marker: { opacity: 1, size: 14 } },
            unselected: { marker: { opacity: 0.08, size: 8 } },
            marker: {
              color: BLOC_COLORS[bloc],
              size: 8,
              opacity: 1,
              line: { width: 0.5, color: "rgba(255,255,255,0.5)" },
            },
          };
        });
      }

      function buildLayout() {
        return {
          paper_bgcolor: "#ffffff",
          plot_bgcolor: "#fafafa",
          font: {
            family:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            size: 12,
            color: "#333",
          },
          xaxis: {
            title: { text: "Prix médian au m² (€, échelle log)", standoff: 12 },
            type: "log",
            showgrid: true,
            gridcolor: "#e8e8e8",
            zeroline: false,
            // Explicit ticks: avoids Plotly log-axis offset artefact and enforces French spacing
            tickmode: "array",
            tickvals: [500, 1000, 2000, 3000, 5000, 7000, 10000, 15000],
            // \u00a0 = non-breaking space, more reliably rendered in SVG than \u202f
            ticktext: [
              "500",
              "1\u00a0000",
              "2\u00a0000",
              "3\u00a0000",
              "5\u00a0000",
              "7\u00a0000",
              "10\u00a0000",
              "15\u00a0000",
            ],
          },
          yaxis: {
            title: { text: "Taux d'abstention au 2nd tour (%)", standoff: 12 },
            showgrid: true,
            gridcolor: "#e8e8e8",
            zeroline: false,
            range: [0, 75],
          },
          showlegend: false,
          margin: { l: 60, r: 185, t: 20, b: 60 },
          hovermode: "closest",
          dragmode: false,
        };
      }

      function buildConfig() {
        return {
          responsive: true,
          displayModeBar: false,
          displaylogo: false,
          scrollZoom: false,
        };
      }

      // ── Shared selection state ──────────────────────────────────────────────────
      //
      // Single computation used by both applySelection() and syncLegend().
      // Prevents the two functions from diverging on what "active" means.

      function getSelectionState() {
        const communes = clickedCommune
          ? new Set([clickedCommune])
          : searchedCommunes;
        const hasCommunes = communes.size > 0;
        const hasBlocs = filteredBlocs.size > 0;
        const hasAny = hasCommunes || hasBlocs;

        // Which blocs contain at least one selected commune
        const communeActiveBlocs = hasCommunes
          ? new Set(
              BLOC_ORDER.filter((b) =>
                traceData[b].some((d) => communes.has(d.nom_commune)),
              ),
            )
          : new Set();

        return { communes, hasCommunes, hasBlocs, hasAny, communeActiveBlocs };
      }

      // ── Custom legend ───────────────────────────────────────────────────────────

      function buildCustomLegend() {
        const container = document.getElementById("custom-legend");
        BLOC_ORDER.forEach((bloc) => {
          const item = document.createElement("div");
          item.className = "legend-item";
          item.dataset.bloc = bloc;

          const dot = document.createElement("span");
          dot.className = "legend-dot";
          dot.style.background = BLOC_COLORS[bloc];

          const label = document.createElement("span");
          label.className = "legend-label";
          label.textContent = BLOC_LABELS[bloc];

          item.appendChild(dot);
          item.appendChild(label);
          container.appendChild(item);

          // Legend items are toggle buttons: keyboard and mouse both activate
          item.setAttribute("role", "button");
          item.setAttribute("tabindex", "0");
          item.setAttribute("aria-pressed", "false");

          function toggleBloc() {
            // Block legend filter when a point or search pill is active:
            // pulse reinit so user knows to reset first
            if (clickedCommune !== null || searchedCommunes.size > 0) {
              pulseResetBtn();
              return;
            }
            if (filteredBlocs.has(bloc)) {
              filteredBlocs.delete(bloc);
            } else {
              filteredBlocs.add(bloc);
            }
            applySelection();
          }

          item.addEventListener("click", toggleBloc);
          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleBloc();
            }
          });
        });
      }

      // Sync custom legend item states with current selection
      function syncLegend() {
        const { hasBlocs, hasCommunes, communeActiveBlocs } =
          getSelectionState();

        document.querySelectorAll(".legend-item").forEach((item) => {
          const bloc = item.dataset.bloc;
          let active = true;

          if (hasBlocs) {
            active = filteredBlocs.has(bloc);
          } else if (hasCommunes) {
            active = communeActiveBlocs.has(bloc);
          }

          item.classList.toggle("inactive", !active);
          // aria-pressed: true when this bloc is actively in the filter set
          item.setAttribute(
            "aria-pressed",
            filteredBlocs.has(bloc) ? "true" : "false",
          );
        });
      }

      // ── Selection rendering ─────────────────────────────────────────────────────
      //
      // Single source of truth. All state changes call this.
      //
      // Uses Plotly's selectedpoints API:
      //   null  → all points render at base marker style (full opacity)
      //   []    → all points render at unselected style (dim)
      //   [i,j] → those indices render at selected style; rest at unselected
      //
      // Critically: selectedpoints does NOT affect legend icon rendering.
      // Legend icons always use the base marker colour/opacity from the trace definition.

      function applySelection() {
        const { communes, hasCommunes, hasBlocs, hasAny, communeActiveBlocs } =
          getSelectionState();

        const resetBtn = document.getElementById("reset-btn");
        resetBtn.classList.toggle("visible", hasAny);
        // Keep aria-hidden + tabindex in sync: hidden button must not be focusable
        resetBtn.setAttribute("aria-hidden", hasAny ? "false" : "true");
        resetBtn.tabIndex = hasAny ? 0 : -1;

        if (!hasAny) {
          // Reset: restore all traces to full hover, both properties must be reset together
          Plotly.restyle(
            CHART_ID,
            {
              selectedpoints: BLOC_ORDER.map(() => null),
              hovertemplate: BLOC_ORDER.map(() => HOVER_TEMPLATE),
              hoverinfo: BLOC_ORDER.map(() => "text"),
            },
            BLOC_ORDER.map((_, i) => i),
          );
          syncLegend();
          return;
        }

        // Build per-trace arrays in one pass, then one batched restyle call
        const spValues = [];
        const unselectedOpacity = [];
        const unselectedSize = [];
        const hoverTemplateValues = [];
        const hoverInfoValues = [];

        BLOC_ORDER.forEach((bloc) => {
          const pts = traceData[bloc];
          const blocActive = hasBlocs
            ? filteredBlocs.has(bloc)
            : !hasCommunes || communeActiveBlocs.has(bloc);

          if (!blocActive) {
            spValues.push([]);
            unselectedOpacity.push(OPACITY.DIM);
            unselectedSize.push(8);
            // Both must be set together: hovertemplate overrides hoverinfo when present,
            // so clearing hovertemplate alone falls back to raw x/y tooltip; 'skip' alone
            // is ignored when hovertemplate is set. Together they fully suppress hover.
            hoverTemplateValues.push(false);
            hoverInfoValues.push("skip");
            return;
          }

          if (!hasCommunes) {
            // Bloc active via legend filter only: all points full
            spValues.push(null);
            unselectedOpacity.push(OPACITY.DIM);
            unselectedSize.push(8);
            hoverTemplateValues.push(HOVER_TEMPLATE);
            hoverInfoValues.push("text");
            return;
          }

          // Find indices of matching communes in this trace
          const matching = pts.reduce((acc, d, i) => {
            if (communes.has(d.nom_commune)) acc.push(i);
            return acc;
          }, []);

          spValues.push(matching.length > 0 ? matching : []);
          unselectedOpacity.push(
            matching.length > 0 ? OPACITY.HINT : OPACITY.DIM,
          );
          unselectedSize.push(8);
          hoverTemplateValues.push(HOVER_TEMPLATE);
          hoverInfoValues.push("text");
        });

        Plotly.restyle(
          CHART_ID,
          {
            selectedpoints: spValues,
            "unselected.marker.opacity": unselectedOpacity,
            "unselected.marker.size": unselectedSize,
            hovertemplate: hoverTemplateValues,
            hoverinfo: hoverInfoValues,
          },
          BLOC_ORDER.map((_, i) => i),
        );

        syncLegend();
      }

      // ── Chart event handlers (attached once) ────────────────────────────────────

      function attachChartEvents() {
        const chartEl = document.getElementById(CHART_ID);

        // plotly_click fires before the native click event: flag lets the background
        // handler know not to pulse when the click actually landed on a point.
        let lastClickWasPoint = false;

        // Point click: single-select, pin tooltip, suppress hover on rest
        chartEl.on("plotly_click", (e) => {
          lastClickWasPoint = true;
          const pt = e.points[0];
          if (!pt || !pt.customdata) return;

          // Block all point clicks when a legend filter is active: the two modes don't compose
          if (filteredBlocs.size > 0) return;

          const nom = pt.customdata[CD.NOM];
          if (clickedCommune === nom) {
            clickedCommune = null;
            hidePinnedTooltip();
            Plotly.relayout(CHART_ID, { hovermode: "closest" });
          } else {
            clickedCommune = nom;
            // Use the actual mouse position: d2p + _offset drifts on log axes
            const chartRect = chartEl.getBoundingClientRect();
            const pixelPos = {
              x: e.event.clientX - chartRect.left,
              y: e.event.clientY - chartRect.top,
            };
            showPinnedTooltip(pt.customdata, pixelPos);
            Plotly.relayout(CHART_ID, { hovermode: false });
          }
          applySelection();
        });

        // Legend interaction handled by custom HTML legend: no Plotly legend events needed

        // Background click: no reset (↺ is the sole reset path), but pulse the button
        // so the user discovers it when they click expecting something to happen.
        chartEl.addEventListener("click", () => {
          if (!lastClickWasPoint) {
            const hasAny =
              clickedCommune !== null ||
              filteredBlocs.size > 0 ||
              searchedCommunes.size > 0;
            if (hasAny) pulseResetBtn();
          }
          lastClickWasPoint = false;
        });
      }

      // ── Pinned tooltip ──────────────────────────────────────────────────────────

      const pinnedTooltip = document.getElementById("pinned-tooltip");

      // Convert data coordinates to pixel position within the chart div.
      // Uses d2p (data-to-pixel) which handles log scale internally: no manual Math.log10.
      // _offset is the axis margin (distance from SVG edge to plot area edge).
      function dataToPixel(prix, abstention) {
        const chartEl = document.getElementById(CHART_ID);
        const layout = chartEl._fullLayout;
        const xax = layout.xaxis;
        const yax = layout.yaxis;
        const xPx = xax.d2p(prix) + (xax._offset || layout.margin.l);
        const yPx = yax.d2p(abstention) + (yax._offset || layout.margin.t);
        return { x: xPx, y: yPx };
      }

      function positionTooltip(el, cd, pixelPos) {
        const TOOLTIP_W = 250;
        const TOOLTIP_H = 115;
        const OFFSET = 12;
        const chartEl = document.getElementById(CHART_ID);
        const layout = chartEl._fullLayout;
        const chartW = chartEl.offsetWidth;
        const chartH = chartEl.offsetHeight;
        const mt = layout.margin.t || 0;
        const RIGHT_BOUNDARY = chartW - 190;

        const { x: ptX, y: ptY } =
          pixelPos || dataToPixel(cd[CD.PRIX], cd[CD.ABSTENTION]);

        let left = ptX + OFFSET;
        let top = ptY - TOOLTIP_H - OFFSET;
        if (left + TOOLTIP_W > RIGHT_BOUNDARY) left = ptX - TOOLTIP_W - OFFSET;
        if (top < mt) top = ptY + OFFSET;
        left = Math.max(4, Math.min(left, chartW - TOOLTIP_W - 4));
        top = Math.max(4, Math.min(top, chartH - TOOLTIP_H - 4));

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
      }

      function buildTooltipContent(el, cd) {
        el.replaceChildren();
        const name = document.createElement("span");
        name.className = "tooltip-name";
        name.textContent = cd[CD.NOM];
        el.appendChild(name);
        [
          `Bloc : ${cd[CD.BLOC_LABEL]}`,
          `Prix médian : ${cd[CD.PRIX_FR]} €/m²`,
          `Abstention : ${cd[CD.ABS_FR]} %`,
          `Transactions : ${cd[CD.TRANSACTIONS]}`,
        ].forEach((text) => {
          const row = document.createElement("span");
          row.className = "tooltip-row";
          row.textContent = text;
          el.appendChild(row);
        });
      }

      // pixelPos optional: from click event; falls back to dataToPixel.
      function showPinnedTooltip(cd, pixelPos) {
        positionTooltip(pinnedTooltip, cd, pixelPos);
        pinnedTooltip.hidden = false;
        buildTooltipContent(pinnedTooltip, cd);
      }

      function hidePinnedTooltip() {
        pinnedTooltip.hidden = true;
        clearSearchTooltips();
      }

      function clearSearchTooltips() {
        document
          .querySelectorAll(".search-tooltip")
          .forEach((el) => el.remove());
      }

      // One pinned tooltip per searched commune. hovermode stays false: background dead.
      function showSearchTooltips() {
        clearSearchTooltips();
        const chartWrapper = document.querySelector(".chart-wrapper");
        searchedCommunes.forEach((name) => {
          const cd = findCustomdata(name);
          if (!cd) return;
          const el = document.createElement("div");
          el.className = "search-tooltip";
          positionTooltip(el, cd);
          buildTooltipContent(el, cd);
          chartWrapper.appendChild(el);
        });
      }

      function pulseResetBtn() {
        const btn = document.getElementById("reset-btn");
        btn.classList.remove("pulse");
        // Force reflow so the animation restarts cleanly if already playing
        void btn.offsetWidth;
        btn.classList.add("pulse");
        btn.addEventListener(
          "animationend",
          () => btn.classList.remove("pulse"),
          { once: true },
        );
      }

      // Find customdata for a commune by name: used to show tooltip after search-select
      function findCustomdata(nom) {
        for (const bloc of BLOC_ORDER) {
          const d = traceData[bloc].find((p) => p.nom_commune === nom);
          if (d) {
            return [
              d.nom_commune,
              BLOC_LABELS[d.winning_bloc] || d.winning_bloc,
              d.median_prix_m2,
              d.abstention_rate,
              d.n_transactions,
              Math.round(d.median_prix_m2).toLocaleString("fr-FR"),
              d.abstention_rate.toLocaleString("fr-FR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            ];
          }
        }
        return null;
      }

      // ── Reset ───────────────────────────────────────────────────────────────────

      function resetAll() {
        clickedCommune = null;
        searchedCommunes.clear();
        filteredBlocs.clear();
        hidePinnedTooltip();
        document.getElementById("pills-container").innerHTML = "";
        // Guard: scatter chart may not be initialized yet (quintile is the landing tab)
        const chartEl = document.getElementById(CHART_ID);
        if (chartEl && chartEl.data) {
          Plotly.relayout(CHART_ID, { hovermode: "closest" });
          applySelection();
        }
      }

      // ── UI event handlers (attached once after chart renders) ───────────────────

      function attachUIEvents(communeNames) {
        document
          .getElementById("reset-btn")
          .addEventListener("click", resetAll);
        document
          .getElementById("btn-tour1")
          .addEventListener("click", () => setTour(1));
        document
          .getElementById("btn-tour2")
          .addEventListener("click", () => setTour(2));
        document
          .querySelectorAll(".year-btn")
          .forEach((btn) =>
            btn.addEventListener("click", () => switchYear(btn.dataset.year)),
          );
        document
          .getElementById("btn-back-tour2")
          .addEventListener("click", () => setTour(2));

        // Esc resets all filters/selections from anywhere on the page
        document.addEventListener("keydown", (e) => {
          if (e.key !== "Escape") return;
          const hasAny =
            clickedCommune !== null ||
            filteredBlocs.size > 0 ||
            searchedCommunes.size > 0;
          if (hasAny) resetAll();
        });

        attachAutocomplete(communeNames);
      }

      // ── Tour toggle ─────────────────────────────────────────────────────────────

      function setTour(tour) {
        // No-op if already on this tour: prevents resetAll() wiping user's selection
        const currentlyActive =
          tour === 1
            ? document.getElementById("btn-tour1").classList.contains("active")
            : document.getElementById("btn-tour2").classList.contains("active");
        if (currentlyActive) return;

        // Clear all selection state before switching: prevents tooltip floating over overlay
        resetAll();
        const btn1 = document.getElementById("btn-tour1");
        const btn2 = document.getElementById("btn-tour2");
        btn1.classList.toggle("active", tour === 1);
        btn2.classList.toggle("active", tour === 2);
        btn1.setAttribute("aria-pressed", tour === 1 ? "true" : "false");
        btn2.setAttribute("aria-pressed", tour === 2 ? "true" : "false");
        const overlay = document.getElementById("tour1-overlay");
        overlay.classList.toggle("visible", tour === 1);
        if (tour === 1) {
          // Move focus into the dialog so keyboard/AT users land on the action button
          document.getElementById("btn-back-tour2").focus();
        } else {
          // Return focus to the toggle that opened the overlay
          document.getElementById("btn-tour1").focus();
        }
      }

      // ── Autocomplete ────────────────────────────────────────────────────────────

      function attachAutocomplete(communeNames) {
        const input = document.getElementById("commune-input");
        const dropdown = document.getElementById("autocomplete-dropdown");
        let highlightedIdx = -1;

        input.addEventListener("input", () => {
          const q = input.value.trim();
          if (q.length < 2) {
            closeDropdown();
            return;
          }

          const ql = q.toLowerCase();
          const matches = communeNames
            .filter((n) => n.toLowerCase().includes(ql))
            .slice(0, 40);

          if (matches.length === 0) {
            showEmptyDropdown();
          } else {
            renderDropdown(matches);
          }
        });

        input.addEventListener("keydown", (e) => {
          const items = dropdown.querySelectorAll(".autocomplete-item");
          if (!dropdown.classList.contains("open") || items.length === 0)
            return;

          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
              updateHighlight(items);
              break;
            case "ArrowUp":
              e.preventDefault();
              highlightedIdx = Math.max(highlightedIdx - 1, 0);
              updateHighlight(items);
              break;
            case "Enter":
              e.preventDefault();
              if (highlightedIdx >= 0 && items[highlightedIdx]) {
                // Explicit arrow-key selection
                selectCommune(items[highlightedIdx].textContent);
              } else if (items.length === 1) {
                // Single match: auto-select without needing to arrow down
                selectCommune(items[0].textContent);
              } else if (items.length > 1) {
                // Multiple matches: auto-select only if input is an exact match
                const exact = input.value.trim();
                const exactMatch = [...items].find(
                  (el) =>
                    el.textContent.localeCompare(exact, "fr", {
                      sensitivity: "base",
                    }) === 0,
                );
                if (exactMatch) selectCommune(exactMatch.textContent);
              }
              break;
            case "Escape":
              closeDropdown();
              break;
          }
        });

        input.addEventListener("blur", () => setTimeout(closeDropdown, 150));

        function renderDropdown(matches) {
          dropdown.innerHTML = "";
          highlightedIdx = -1;
          matches.forEach((name, i) => {
            const item = document.createElement("div");
            item.className = "autocomplete-item";
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", "false");
            item.id = `autocomplete-option-${i}`;
            item.textContent = name;
            item.addEventListener("mousedown", (e) => {
              e.preventDefault();
              selectCommune(name);
            });
            dropdown.appendChild(item);
          });
          dropdown.classList.add("open");
          input.setAttribute("aria-expanded", "true");
        }

        function showEmptyDropdown() {
          const msg = document.createElement("p");
          msg.className = "autocomplete-empty";
          msg.setAttribute("role", "status");
          msg.textContent =
            "Commune non trouvée dans les résultats du 2ème tour : peut-être élue au 1er tour ? (les visualisations dispo bientôt)";
          dropdown.innerHTML = "";
          dropdown.appendChild(msg);
          dropdown.classList.add("open");
          input.setAttribute("aria-expanded", "true");
        }

        function updateHighlight(items) {
          items.forEach((el, i) => {
            const active = i === highlightedIdx;
            el.classList.toggle("highlighted", active);
            el.setAttribute("aria-selected", active ? "true" : "false");
          });
          if (highlightedIdx >= 0) {
            items[highlightedIdx].scrollIntoView({ block: "nearest" });
            input.setAttribute(
              "aria-activedescendant",
              items[highlightedIdx].id,
            );
          }
        }

        function closeDropdown() {
          dropdown.classList.remove("open");
          dropdown.innerHTML = "";
          highlightedIdx = -1;
          input.setAttribute("aria-expanded", "false");
          input.removeAttribute("aria-activedescendant");
        }

        function selectCommune(name) {
          // No-op if already selected via search
          if (searchedCommunes.has(name)) {
            input.value = "";
            closeDropdown();
            return;
          }

          // Clear point-click selection when switching to search mode
          if (clickedCommune !== null) {
            clickedCommune = null;
            hidePinnedTooltip();
            Plotly.relayout(CHART_ID, { hovermode: "closest" });
          }

          searchedCommunes.add(name);
          addPill(name);
          Plotly.relayout(CHART_ID, { hovermode: false });
          applySelection();
          showSearchTooltips();

          input.value = "";
          closeDropdown();
        }
      }

      // ── Pills ───────────────────────────────────────────────────────────────────

      function addPill(name) {
        const container = document.getElementById("pills-container");
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.setAttribute("role", "listitem");
        pill.dataset.commune = name;

        const label = document.createTextNode(`${name}\u00A0`);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "×";
        btn.setAttribute("aria-label", `Supprimer ${name}`);
        btn.addEventListener("click", () => {
          searchedCommunes.delete(name);
          pill.remove();
          if (searchedCommunes.size === 0) {
            Plotly.relayout(CHART_ID, { hovermode: "closest" });
            clearSearchTooltips();
          } else {
            showSearchTooltips();
          }
          applySelection();
        });

        pill.appendChild(label);
        pill.appendChild(btn);
        container.appendChild(pill);
      }
      // ── Guided tour (Driver.js) ─────────────────────────────────────────────────

      function buildTour() {
        const { driver } = window.driver.js;

        function hideResetBtn() {
          const btn = document.getElementById("reset-btn");
          btn.classList.remove("visible");
          btn.setAttribute("aria-hidden", "true");
          btn.tabIndex = -1;
        }

        function demoCommune(nom) {
          clickedCommune = nom;
          applySelection();
          hideResetBtn();
          const cd = findCustomdata(nom);
          if (cd) showPinnedTooltip(cd);
        }

        function cleanupInput() {
          const input = document.getElementById("commune-input");
          input.value = "";
          input.style.color = "";
        }

        return driver({
          showProgress: true,
          progressText: "{{current}} / {{total}}",
          nextBtnText: "Suivant →",
          prevBtnText: "← Précédent",
          doneBtnText: "Terminer",
          allowClose: true,
          // Full cleanup on exit: covers both "Terminer" and the × close button
          onDestroyed: () => {
            localStorage.setItem("elections-tour-completed", "true");
            cleanupInput();
            document.getElementById("reset-btn").style.pointerEvents = "";
            resetAll();
          },
          steps: [
            {
              // No element: centered modal for the welcome step; Lyon still pre-selected via hook
              popover: {
                popoverClass: "tour-welcome",
                title: "Bienvenue sur la visualisation",
                description:
                  "Cette visualisation présente les <b>prix médians au mètre carré</b> et les <b>taux d'abstention</b> pour <b>838 communes françaises ayant eu un 2ème tour avec données DVF disponibles</b>, au <b>2ème tour des élections municipales du 22 mars 2026</b>.<ul style=\"margin:.5em 0 0 1.2em;line-height:1.6\"><li><b>Axe horizontal (X)</b> : <b>Prix médian au m²</b> (échelle logarithmique pour comparer les communes les plus chères et les plus abordables).</li><li><b>Axe vertical (Y)</b> : <b>Taux d'abstention (%)</b>.</li><li><b>Couleurs</b> : <b>Bloc politique vainqueur au 2ème tour</b> (<em>Extrême gauche</em>, <em>Gauche</em>, <em>Centre</em>, <em>Divers</em>, <em>Droite</em>, <em>Extrême droite</em>).</li></ul>",
                side: "bottom",
                align: "center",
              },
              onHighlightStarted: () => demoCommune("Montrouge"),
              onDeselected: () => resetAll(),
            },
            {
              element: "#commune-input",
              popover: {
                title: "Trouver une commune",
                description:
                  "Tu peux <b>rechercher une commune</b> pour la mettre en évidence dans le graphique.<br>Exemple : tape <b>« Paris »</b> pour voir ses détails spécifiques.<br><em>Plusieurs communes peuvent être sélectionnées en même temps.</em>",
                side: "bottom",
                align: "start",
              },
              // Show ghost text in the search field to demonstrate
              onHighlightStarted: () => {
                const input = document.getElementById("commune-input");
                input.value = "Paris";
                input.style.color = "#aaa";
              },
              onDeselected: cleanupInput,
            },
            {
              element: "#custom-legend",
              popover: {
                title: "Filtrer par bloc politique",
                description:
                  "Clique sur un <b>bloc politique</b> pour n'afficher que ses communes.<br><em>Plusieurs blocs peuvent être sélectionnés simultanément.</em><br>Utilise <b>↺ Réinitialiser</b> ou la touche <b>Échap</b> pour tout effacer et revenir à la vue complète.",
                side: "left",
                align: "start",
              },
              // Activate Gauche bloc as a live demo of the filter
              onHighlightStarted: () => {
                filteredBlocs.add("GAU");
                applySelection();
                hideResetBtn();
              },
              onDeselected: () => {
                filteredBlocs.clear();
                applySelection();
              },
            },
            {
              element: "#chart",
              popover: {
                title: "Détails d'une commune",
                description:
                  'Clique sur <b>un point</b> pour voir ses détails :<ul style="margin:.5em 0 0 1.2em;line-height:1.6"><li><b>Prix médian au m²</b>,</li><li><b>Taux d\'abstention</b>,</li><li><b>Nombre de transactions DVF</b>,</li><li><b>Bloc politique vainqueur</b>.</li></ul>',
                side: "top",
                align: "center",
              },
              // Pre-select Paris to demonstrate the point-click state
              onHighlightStarted: () => demoCommune("Paris"),
              onDeselected: () => resetAll(),
            },
            {
              element: "#reset-btn",
              popover: {
                title: "↺ Réinitialiser",
                description:
                  "Le bouton <b>↺ Réinitialiser</b> (ou la touche <b>Échap</b>) efface tout d'un coup :<ul style=\"margin:.5em 0 0 1.2em;line-height:1.6\"><li><b>Communes sélectionnées</b> (clics sur les points),</li><li><b>Filtres de blocs politiques</b> actifs,</li><li><b>Commune recherchée</b> en cours.</li></ul><em>Il n'apparaît que lorsqu'une sélection ou un filtre est actif.</em><br><b>Un clic ou Échap suffit pour revenir à la vue initiale complète.</b>",
                side: "left",
                align: "start",
              },
              onHighlightStarted: () => {
                const btn = document.getElementById("reset-btn");
                btn.classList.add("visible");
                btn.setAttribute("aria-hidden", "false");
                btn.tabIndex = 0;
                btn.style.pointerEvents = "none"; // prevent accidental reset during tour
              },
              onDeselected: () => {
                document.getElementById("reset-btn").style.pointerEvents = "";
                applySelection(); // restores correct visibility
              },
            },
          ],
        });
      }

      function launchBoxPlotTour() {
        const { driver } = window.driver.js;
        driver({
          showProgress: true,
          progressText: "{{current}} / {{total}}",
          nextBtnText: "Suivant →",
          prevBtnText: "← Précédent",
          doneBtnText: "Terminer",
          allowClose: true,
          onDestroyed: () =>
            localStorage.setItem("elections-tour-completed", "true"),
          steps: [
            {
              element: "#boxplot",
              popover: {
                title: "Distribution du Prix par bloc politique",
                description:
                  "Chaque boîte représente la <b>distribution des prix au m²</b> pour un bloc politique.<br><br>" +
                  "La ligne centrale = <b>médiane</b>. La boîte = Q1–Q3 (50% des communes). " +
                  "Les points isolés = <b>valeurs extrêmes</b>.<br><br>" +
                  "Les triangles ▲▼ indiquent la commune la plus chère et la moins chère du bloc.",
                side: "top",
                align: "center",
              },
            },
          ],
        }).drive();
      }

      function launchAbstentionBoxPlotTour() {
        const { driver } = window.driver.js;
        driver({
          showProgress: true,
          progressText: "{{current}} / {{total}}",
          nextBtnText: "Suivant →",
          prevBtnText: "← Précédent",
          doneBtnText: "Terminer",
          allowClose: true,
          onDestroyed: () =>
            localStorage.setItem("elections-tour-completed", "true"),
          steps: [
            {
              element: "#boxplot-abst",
              popover: {
                title: "Taux d'Abstention par bloc politique",
                description:
                  "Chaque boîte montre la <b>distribution du taux d'abstention</b> dans les communes remportées par ce bloc au 2ème tour.<br><br>" +
                  "La ligne centrale = <b>médiane</b>. La boîte = Q1–Q3 (50% des communes). " +
                  "Les points isolés = <b>valeurs extrêmes</b>.<br><br>" +
                  "Les triangles ▲▼ indiquent la commune avec la plus haute et la plus basse abstention du bloc.",
                side: "top",
                align: "center",
              },
            },
          ],
        }).drive();
      }

      function launchQuintileTour() {
        const { driver } = window.driver.js;
        driver({
          showProgress: true,
          progressText: "{{current}} / {{total}}",
          nextBtnText: "Suivant →",
          prevBtnText: "← Précédent",
          doneBtnText: "Terminer",
          allowClose: true,
          onDestroyed: () =>
            localStorage.setItem("elections-tour-completed", "true"),
          steps: [
            {
              element: "#quintile-chart",
              popover: {
                title: "Vue d'ensemble : 5 tranches de prix",
                description:
                  "Les 838 communes sont divisées en <b>5 tranches égales</b> selon leur prix médian au m², de la moins chère à la plus chère.<br><br>" +
                  "Chaque barre montre la <b>part des communes</b> remportée par chaque bloc politique dans cette tranche de prix.<br><br>" +
                  "Ex. : si la Droite occupe 47% de la barre «Les plus chères», cela signifie que <b>47% des communes les plus chères ont été remportées par la Droite.</b><br/><br/>" + 
                  "Le bouton <b>?</b> lance un guide spécifique à chaque onglet.",
                side: "top",
                align: "center",
              },
            },
            {
              element: "#year-toggle-bar",
              popover: {
                title: "Données DVF : 2024 ou 2025",
                description:
                  "Bascule entre les prix immobiliers DVF <b>2024</b> et <b>2025</b> pour vérifier si la corrélation tient dans les deux années.<br><br>" +
                  "S'applique aux onglets <b>Vue d'ensemble</b>, <b>Distribution du Prix par bloc</b> et <b>Prix &amp; abstention</b>. Désactivé sur <b>Taux d'Abstention par bloc</b> et <b>Paris-Lyon-Marseille</b> (données non DVF).",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: ".viz-tabs",
              popover: {
                title: "Cinq visualisations",
                description:
                  "<b>Vue d'ensemble</b> : 5 tranches de prix, la distribution des blocs par tranche.<br>" +
                  "<b>Taux d'Abstention par bloc</b> : boîtes à moustaches du taux d'abstention par bloc.<br>" +
                  "<b>Distribution du Prix par bloc</b> : boîtes à moustaches des prix au m² par bloc.<br>" +
                  "<b>Paris-Lyon-Marseille</b> : analyse par arrondissement pour les trois grandes villes.<br>" +
                  "<b>Prix &amp; abstention</b> : un point par commune, couleur = bloc gagnant.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#quintile-chart .legend",
              popover: {
                title: "Légende des blocs",
                description:
                  "Chaque couleur correspond à un <b>bloc politique</b>. " +
                  "Survole une barre pour voir le détail : part en % et nombre de communes.",
                side: "top",
                align: "center",
              },
            },
          ],
        }).drive();
      }

      function launchPLMTour() {
        const { driver } = window.driver.js;
        // Target the currently-visible map panel: avoids anchoring to a hidden element
        const activeCity =
          document.querySelector("[data-plm].active")?.dataset.plm || "paris";
        driver({
          showProgress: true,
          progressText: "{{current}} / {{total}}",
          nextBtnText: "Suivant →",
          prevBtnText: "← Précédent",
          doneBtnText: "Terminer",
          allowClose: true,
          onDestroyed: () =>
            localStorage.setItem("elections-tour-completed", "true"),
          steps: [
            {
              element: ".plm-subtabs",
              popover: {
                title: "Paris-Lyon-Marseille",
                description:
                  "Cette section explore les <b>prix au m²</b> et les <b>résultats électoraux</b> par arrondissement pour <b>Paris, Lyon et Marseille</b>.<br><br>" +
                  "Choisis une ville via ces sous-onglets pour afficher sa carte.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: `#map-${activeCity}`,
              popover: {
                title: "Carte des arrondissements",
                description:
                  "Chaque carte combine deux lectures :<ul style='margin:.5em 0 0 1.2em;line-height:1.7'>" +
                  "<li><b>Couleur de fond</b> : bloc politique vainqueur au 2ème tour.</li>" +
                  "<li><b>Taille du cercle</b> : prix médian au m², plus le cercle est grand, plus l'arrondissement est cher.</li>" +
                  `<li><b>Info-bulle</b> : prix, abstention, transactions DVF ${activeYear}.</li></ul>` +
                  "<em>Survoles un arrondissement ou un cercle pour voir ses détails.</em>",
              },
            },
          ],
        }).drive();
      }

      function launchTour() {
        const activeTab = document.querySelector(
          ".viz-tab:not([data-plm]).active",
        )?.dataset.panel;
        if (activeTab === "boxplot-abst") {
          launchAbstentionBoxPlotTour();
          return;
        }
        if (activeTab === "boxplot") {
          launchBoxPlotTour();
          return;
        }
        if (activeTab === "plm") {
          launchPLMTour();
          return;
        }
        if (activeTab === "quintile") {
          launchQuintileTour();
          return;
        }
        // Default: scatter tour
        buildTour().drive();
      }

      // ── Box plot ────────────────────────────────────────────────────────────────

      // Register FR locale for box plot number formatting (thousands separator = espace insécable)
      Plotly.register({
        moduleType: "locale",
        name: "fr",
        dictionary: {},
        format: {
          thousands: "\u00a0",
          decimal: ",",
        },
      });

      let boxplotReady = false;

      function initBoxPlot() {
        if (boxplotReady) return;
        boxplotReady = true;

        const traces = [];

        BLOC_ORDER.forEach((bloc) => {
          const pts = traceData[bloc];
          // Keep pts and prices aligned so text[i] matches y[i]
          const filtered = pts.filter((d) => d.median_prix_m2 != null);
          const prices = filtered.map((d) => d.median_prix_m2);
          const communeText = filtered.map(
            (d) =>
              `<b>${d.nom_commune}</b><br>${Math.round(d.median_prix_m2).toLocaleString("fr-FR")}\u00a0€/m²`,
          );
          const color = BLOC_COLORS[bloc];
          const label = BLOC_LABELS[bloc] || bloc;

          // Box trace
          traces.push({
            type: "box",
            name: label,
            y: prices,
            x: Array(prices.length).fill(label),
            text: communeText,
            // hovertemplate applies to outlier scatter points only: %{text} and %{y}
            // work fine here. Box summary stats use Plotly's built-in hover (not affected).
            hovertemplate: "%{text}<extra></extra>",
            marker: { color },
            line: { color },
            fillcolor: color + "33", // 20% opacity fill
            boxpoints: "outliers",
            width: 0.3,
            hoverlabel: { namelength: 0 },
            showlegend: false,
          });

          // Min/max markers
          if (filtered.length === 0) return;
          const sorted = [...pts]
            .filter((d) => d.median_prix_m2 != null)
            .sort((a, b) => a.median_prix_m2 - b.median_prix_m2);
          const minPt = sorted[0];
          const maxPt = sorted[sorted.length - 1];

          // Triangle-up: highest price
          traces.push({
            type: "scatter",
            mode: "markers+text",
            x: [label],
            y: [maxPt.median_prix_m2],
            text: [maxPt.nom_commune],
            textposition: "top center",
            textfont: { size: 9, color: "#333" },
            marker: { symbol: "triangle-up", size: 9, color },
            hoverinfo: "skip",
            showlegend: false,
          });

          // Triangle-down: lowest price
          traces.push({
            type: "scatter",
            mode: "markers+text",
            x: [label],
            y: [minPt.median_prix_m2],
            text: [minPt.nom_commune],
            textposition: "bottom center",
            textfont: { size: 9, color: "#333" },
            marker: { symbol: "triangle-down", size: 9, color },
            hoverinfo: "skip",
            showlegend: false,
          });
        });

        const layout = {
          yaxis: {
            type: "log",
            title: {
              text: "Prix médian au m² (€, échelle log)",
              font: { size: 12 },
            },
            // ",.0f" = integer with D3 thousands sep; FR locale then converts "," → "\u00a0"
            // giving "8 360" instead of "8 360,477"
            hoverformat: ",.0f",
            showgrid: true,
            gridcolor: "#eeeeee",
            tickvals: [500, 1000, 2000, 3000, 5000, 7000, 10000, 15000],
            ticktext: [
              "500",
              "1\u00a0000",
              "2\u00a0000",
              "3\u00a0000",
              "5\u00a0000",
              "7\u00a0000",
              "10\u00a0000",
              "15\u00a0000",
            ],
          },
          xaxis: {
            title: { text: "Bloc politique vainqueur", font: { size: 12 } },
            categoryorder: "array",
            categoryarray: BLOC_ORDER.map((b) => BLOC_LABELS[b] || b),
          },
          plot_bgcolor: "white",
          paper_bgcolor: "white",
          margin: { l: 70, r: 20, t: 20, b: 60 },
          hovermode: "closest",
          dragmode: false,
        };

        Plotly.newPlot("boxplot", traces, layout, {
          displayModeBar: false,
          scrollZoom: false,
          responsive: true,
          locale: "fr",
        });
      }

      // ── Abstention box plot ─────────────────────────────────────────────────────

      let boxplotAbstReady = false;

      function initAbstentionBoxPlot() {
        if (boxplotAbstReady) return;
        boxplotAbstReady = true;

        const traces = [];

        BLOC_ORDER.forEach((bloc) => {
          const pts = traceData[bloc];
          const filtered = pts.filter((d) => d.abstention_rate != null);
          const rates = filtered.map((d) => d.abstention_rate);
          const communeText = filtered.map(
            (d) =>
              `<b>${d.nom_commune}</b><br>${d.abstention_rate.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0%`,
          );
          const color = BLOC_COLORS[bloc];
          const label = BLOC_LABELS[bloc] || bloc;

          traces.push({
            type: "box",
            name: label,
            y: rates,
            x: Array(rates.length).fill(label),
            text: communeText,
            hovertemplate: "%{text}<extra></extra>",
            marker: { color },
            line: { color },
            fillcolor: color + "33",
            boxpoints: "outliers",
            width: 0.3,
            hoverlabel: { namelength: 0 },
            showlegend: false,
          });

          if (filtered.length === 0) return;
          const sorted = [...filtered].sort(
            (a, b) => a.abstention_rate - b.abstention_rate,
          );
          const minPt = sorted[0];
          const maxPt = sorted[sorted.length - 1];

          traces.push({
            type: "scatter",
            mode: "markers+text",
            x: [label],
            y: [maxPt.abstention_rate],
            text: [maxPt.nom_commune],
            textposition: "top center",
            textfont: { size: 9, color: "#333" },
            marker: { symbol: "triangle-up", size: 9, color },
            hoverinfo: "skip",
            showlegend: false,
          });

          traces.push({
            type: "scatter",
            mode: "markers+text",
            x: [label],
            y: [minPt.abstention_rate],
            text: [minPt.nom_commune],
            textposition: "bottom center",
            textfont: { size: 9, color: "#333" },
            marker: { symbol: "triangle-down", size: 9, color },
            hoverinfo: "skip",
            showlegend: false,
          });
        });

        const layout = {
          yaxis: {
            title: {
              text: "Taux d\u2019abstention au 2nd tour (%)",
              font: { size: 12 },
            },
            showgrid: true,
            gridcolor: "#eeeeee",
            ticksuffix: "\u00a0%",
          },
          xaxis: {
            title: { text: "Bloc politique vainqueur", font: { size: 12 } },
            categoryorder: "array",
            categoryarray: BLOC_ORDER.map((b) => BLOC_LABELS[b] || b),
          },
          plot_bgcolor: "white",
          paper_bgcolor: "white",
          margin: { l: 70, r: 20, t: 20, b: 60 },
          hovermode: "closest",
          dragmode: false,
        };

        Plotly.newPlot("boxplot-abst", traces, layout, {
          displayModeBar: false,
          scrollZoom: false,
          responsive: true,
          locale: "fr",
        });
      }

      // ── Quintile chart ──────────────────────────────────────────────────────────

      let quintileReady = false;

      function initQuintileChart() {
        if (quintileReady) return;
        // Guard: data not yet loaded (called at startup before fetch completes)
        const totalPts = BLOC_ORDER.reduce(
          (s, b) => s + (traceData[b]?.length || 0),
          0,
        );
        if (totalPts === 0) return;
        quintileReady = true;

        // Flatten all commune data across blocs
        const allData = BLOC_ORDER.flatMap((b) => traceData[b]);
        const sorted = [...allData].sort(
          (a, b) => a.median_prix_m2 - b.median_prix_m2,
        );
        const n = sorted.length;

        const QUINTILE_NAMES = [
          "Les moins chères",
          "Peu chères",
          "Intermédiaires",
          "Chères",
          "Les plus chères",
        ];

        // Build quintiles with equal commune counts
        const quintiles = QUINTILE_NAMES.map((name, q) => {
          const start = Math.round((q * n) / 5);
          const end = Math.round(((q + 1) * n) / 5);
          const group = sorted.slice(start, end);

          const counts = {};
          BLOC_ORDER.forEach((b) => (counts[b] = 0));
          group.forEach((d) => {
            const b = counts[d.winning_bloc] !== undefined ? d.winning_bloc : "DIV";
            counts[b]++;
          });

          const total = group.length;
          const pcts = {};
          BLOC_ORDER.forEach((b) => (pcts[b] = (counts[b] / total) * 100));

          const priceMin = Math.round(group[0].median_prix_m2).toLocaleString("fr-FR");
          const priceMax = Math.round(group[group.length - 1].median_prix_m2).toLocaleString("fr-FR");

          return { name, pcts, priceMin, priceMax, total };
        });

        // Y-axis labels: quintile name + price range
        const yLabels = quintiles.map(
          (q) => `${q.name}<br><span style='font-size:10px'>${q.priceMin} – ${q.priceMax} €/m²</span>`,
        );
        // Plotly doesn't render HTML in axis labels — use plain text instead
        const yTicks = quintiles.map(
          (q) => `${q.name} (${q.priceMin}\u202f–\u202f${q.priceMax}\u00a0€/m²)`,
        );

        const traces = BLOC_ORDER.map((bloc) => ({
          type: "bar",
          name: BLOC_LABELS[bloc],
          orientation: "h",
          y: yTicks,
          x: quintiles.map((q) => Math.round(q.pcts[bloc] * 10) / 10),
          customdata: quintiles.map((q) => [
            (Math.round(q.pcts[bloc] * 10) / 10).toLocaleString("fr-FR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            q.total,
            Math.round((q.pcts[bloc] / 100) * q.total),
          ]),
          hovertemplate:
            "<b>" +
            BLOC_LABELS[bloc] +
            "</b><br>" +
            "%{customdata[0]}\u00a0% des communes<br>" +
            "%{customdata[2]} commune(s) sur %{customdata[1]}" +
            "<extra></extra>",
          marker: { color: BLOC_COLORS[bloc] },
        }));

        const layout = {
          barmode: "stack",
          paper_bgcolor: "#ffffff",
          plot_bgcolor: "#fafafa",
          font: {
            family:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            size: 12,
            color: "#333",
          },
          xaxis: {
            title: { text: "Part des communes (%)", standoff: 8 },
            ticksuffix: "%",
            range: [0, 100],
            gridcolor: "#e8e8e8",
            zeroline: false,
          },
          yaxis: {
            automargin: true,
            tickfont: { size: 11 },
          },
          margin: { l: 20, r: 20, t: 20, b: 60 },
          legend: {
            orientation: "h",
            x: 0,
            y: -0.18,
            traceorder: "normal",
          },
          hovermode: "closest",
          dragmode: false,
        };

        Plotly.newPlot("quintile-chart", traces, layout, {
          displayModeBar: false,
          responsive: true,
        });
      }

      // ── Viz tab switching ───────────────────────────────────────────────────────

      const TAB_BLURBS = {
        scatter:
          "Un point par commune : 2ème tour du 22 mars 2026. Comment les prix immobiliers et les taux d'abstention varient-ils selon le bloc vainqueur\u00a0?",
        "boxplot-abst":
          "Distribution du taux d\u2019abstention par bloc politique vainqueur au 2\u00e8me tour. Les communes qui s\u2019abstiennent le plus votent-elles diff\u00e9remment\u00a0?",
        boxplot:
          "Distribution des prix au m² par bloc politique vainqueur au 2ème tour. Les communes les plus chères votent-elles différemment\u00a0?",
        plm: "Résultats du 2ème tour et prix au m² par arrondissement dans les trois plus grandes villes de France. Choisis une ville.",
        quintile:
          "Les 838 communes classées en 5 tranches de prix. Dans chaque tranche, quelle part a voté pour quel bloc\u00a0? Survole dessus les coleurs pour voir les chiffres. \n\nPar ex : la Droite (DTE) a gagné 47% des communes dans la tranche la plus chère contre 15,5% pour la Gauche. \n\n Et la Gauche (GAU) a gagné 31,5% dans les commune les moin chères.",
      };

      function switchVizTab(panel) {
        document.querySelectorAll(".viz-tab:not([data-plm])").forEach((btn) => {
          const active = btn.dataset.panel === panel;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        document
          .querySelectorAll(".tab-panel:not([id^='plm-panel-'])")
          .forEach((p) =>
            p.classList.toggle("active", p.id === "panel-" + panel),
          );
        document.getElementById("tab-blurb").textContent =
          TAB_BLURBS[panel] || "";
        document
          .getElementById("year-toggle-bar")
          .classList.toggle("disabled", panel === "plm" || panel === "boxplot-abst");
        document.getElementById("year-toggle-bar").classList.toggle("disabled-plm", panel === "plm");
        document.getElementById("year-toggle-bar").classList.toggle("disabled-electoral", panel === "boxplot-abst");
        if (panel === "scatter") initScatterPlot();
        if (panel === "boxplot-abst") initAbstentionBoxPlot();
        if (panel === "boxplot") initBoxPlot();
        if (panel === "quintile") initQuintileChart();
        if (panel === "plm") {
          // Wait for display:block before Leaflet can measure the container
          setTimeout(() => {
            if (plmMaps["paris"]) {
              plmMaps["paris"].invalidateSize();
            } else {
              initPLMMap("paris");
            }
          }, 50);
        }
      }

      const PLM_BLURBS = {
        paris:
          "Résultats du 2ème tour par arrondissement parisien. Les arrondissements les plus chers ont-ils voté différemment\u00a0?",
        lyon: "Résultats du 2ème tour par arrondissement lyonnais. Prix au m² et bloc vainqueur\u00a0: quels arrondissements combinent les deux extrêmes\u00a0?",
        marseille:
          "Résultats du 2ème tour par secteur marseillais. Le clivage nord\u2013sud se lit-il aussi dans les prix\u00a0?",
      };

      function switchPLMSubtab(city) {
        document.querySelectorAll("[data-plm]").forEach((btn) => {
          const active = btn.dataset.plm === city;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        document
          .querySelectorAll("[id^='plm-panel-']")
          .forEach((p) =>
            p.classList.toggle("active", p.id === "plm-panel-" + city),
          );
        document.getElementById("plm-blurb").textContent =
          PLM_BLURBS[city] || "";
        // Lazy init: only when PLM panel is actually visible (display:block)
        // Guard prevents init into hidden 0×0 container (Leaflet zooms to maxZoom)
        const plmPanelActive = document
          .getElementById("panel-plm")
          .classList.contains("active");
        setTimeout(() => {
          if (plmMaps[city]) {
            // Only invalidateSize: fitBounds would reset any manual zoom/pan the user did
            plmMaps[city].invalidateSize();
          } else if (plmPanelActive) {
            initPLMMap(city);
          }
        }, 50);
      }

      // PLM sub-tab clicks
      document
        .querySelectorAll("[data-plm]")
        .forEach((btn) =>
          btn.addEventListener("click", () => switchPLMSubtab(btn.dataset.plm)),
        );

      // Main viz tab clicks (exclude PLM sub-tabs which have data-plm)
      document
        .querySelectorAll(".viz-tab:not([data-plm])")
        .forEach((btn) =>
          btn.addEventListener("click", () => switchVizTab(btn.dataset.panel)),
        );

      // ── PLM choropleth maps ───────────────────────────────────────────────────

      const plmDataCache = {};
      const plmMaps = {};
      const plmMapInited = {};

      const PLM_DEPT = { paris: "75", lyon: "69", marseille: "13" };

      async function loadPLMData() {
        if (plmDataCache[activeYear]) return plmDataCache[activeYear];
        const resp = await fetch(DATA + `plm-secteurs-${activeYear}.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        plmDataCache[activeYear] = await resp.json();
        return plmDataCache[activeYear];
      }

      async function initPLMMap(city) {
        if (plmMapInited[city]) return;

        const mapEl = document.getElementById(`map-${city}`);
        const loader = document.createElement("div");
        loader.className = "plm-loader";
        loader.textContent = "Chargement de la carte…";
        mapEl.appendChild(loader);

        try {
          const data = await loadPLMData();
          const citySecteurs = data.filter(
            (d) => d.ville.toLowerCase() === city,
          );

          // arrondissement code → secteur lookup
          const arrdtToSecteur = {};
          citySecteurs.forEach((s) => {
            s.arrondissement_codes.forEach((code) => {
              arrdtToSecteur[code] = s;
            });
          });

          // Normalise prix within city → t ∈ [0, 1] for circle radius
          const allPrix = citySecteurs
            .map((s) => s.median_prix_m2)
            .filter(Boolean);
          const prixMin = Math.min(...allPrix);
          const prixMax = Math.max(...allPrix);
          const normPrix = (v) =>
            prixMax > prixMin ? (v - prixMin) / (prixMax - prixMin) : 0.5;

          // Tooltip builder: shared between polygons and circles
          function tooltipHtml(feature) {
            const secteur = arrdtToSecteur[feature.properties.code];
            const nom = feature.properties.nom;
            if (!secteur) {
              return `<b>${nom}</b><br><span style="color:#999;font-style:italic">Pas de 2ème tour</span>`;
            }
            const bloc =
              BLOC_LABELS[secteur.winning_bloc] || secteur.winning_bloc;
            const bcolor = BLOC_COLORS[secteur.winning_bloc] || "#aaa";
            const prix = secteur.median_prix_m2
              ? new Intl.NumberFormat("fr-FR").format(
                  Math.round(secteur.median_prix_m2),
                ) + "\u00a0€/m²"
              : "N/A";
            const abst =
              secteur.abstention_rate != null
                ? secteur.abstention_rate.toFixed(1) + "\u00a0%"
                : "N/A";
            return (
              `<b>${nom}</b><br>` +
              `<span style="display:inline-block;width:9px;height:9px;background:${bcolor};border:1px solid rgba(255,255,255,0.4);border-radius:2px;vertical-align:middle;margin-right:4px"></span>${bloc}<br>` +
              `Prix médian\u00a0: ${prix}<br>` +
              `Abstention\u00a0: ${abst}<br>` +
              `Transactions\u00a0: ${secteur.n_transactions ?? "N/A"}`
            );
          }

          // Fetch GeoJSON
          const dept = PLM_DEPT[city];
          const geoResp = await fetch(
            `https://geo.api.gouv.fr/communes?codeDepartement=${dept}` +
              `&type=arrondissement-municipal&geometry=contour&format=geojson`,
          );
          if (!geoResp.ok)
            throw new Error(`geo.api.gouv.fr HTTP ${geoResp.status}`);
          const raw = await geoResp.json();
          // Filter out features with null/missing geometry: geo.api.gouv.fr occasionally
          // returns null geometry for arrondissements (causes Leaflet _clipPoints crash)
          const geojson = {
            ...raw,
            features: (raw.features || []).filter(
              (f) =>
                f.geometry &&
                Array.isArray(f.geometry.coordinates) &&
                f.geometry.coordinates.length,
            ),
          };

          // Initialize with a default view so layers render immediately (not queued).
          // Without this, L.map() has no view → .addTo() queues layers → fitBounds fires
          // setView → queued layers render while renderer bounds are still undefined → crash.
          const CITY_VIEW = {
            paris: { center: [48.856, 2.347], zoom: 12 },
            lyon: { center: [45.76, 4.835], zoom: 12 },
            marseille: { center: [43.296, 5.37], zoom: 11 },
          };
          const { center: defCenter, zoom: defZoom } = CITY_VIEW[city];
          const map = L.map(`map-${city}`, {
            zoomControl: true,
            center: defCenter,
            zoom: defZoom,
          });
          L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            {
              attribution: "&copy; OpenStreetMap &copy; CARTO",
              subdomains: "abcd",
              maxZoom: 18,
            },
          ).addTo(map);

          // Choropleth: solid bloc colour
          const geoLayer = L.geoJSON(geojson, {
            style: (feature) => {
              const secteur = arrdtToSecteur[feature.properties.code];
              if (!secteur) {
                return {
                  color: "#bbb",
                  weight: 1,
                  dashArray: "4 3",
                  fillColor: "#f0f0f0",
                  fillOpacity: 0.6,
                };
              }
              return {
                color: "#fff",
                weight: 1.5,
                fillColor: BLOC_COLORS[secteur.winning_bloc] || "#aaa",
                fillOpacity: 0.75,
              };
            },
            onEachFeature: (feature, layer) => {
              layer.bindTooltip(tooltipHtml(feature), {
                sticky: true,
                direction: "right",
              });
            },
          }).addTo(map);

          // Vertex-average centroid: more accurate than bounding-box center for
          // coastal/irregular polygons (e.g. Marseille arrondissements with islands)
          function geoCentroid(feature) {
            const geom = feature.geometry;
            const ring =
              geom.type === "Polygon"
                ? geom.coordinates[0]
                : geom.coordinates.reduce((a, b) =>
                    b[0].length > a[0].length ? b : a,
                  )[0];
            const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
            const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
            return L.latLng(lat, lng);
          }

          // Proportional circles: radius ∝ prix médian au m² (7 → 24 px)
          geoLayer.eachLayer((layer) => {
            const secteur = arrdtToSecteur[layer.feature.properties.code];
            if (!secteur?.median_prix_m2) return;
            const radius = 7 + normPrix(secteur.median_prix_m2) * 17;
            L.circleMarker(geoCentroid(layer.feature), {
              radius,
              fillColor: "#fff",
              fillOpacity: 0.82,
              color: BLOC_COLORS[secteur.winning_bloc] || "#aaa",
              weight: 2.5,
            })
              .bindTooltip(tooltipHtml(layer.feature), {
                sticky: true,
                direction: "right",
              })
              .addTo(map);
          });

          const bounds = geoLayer.getBounds();
          map.fitBounds(bounds, { padding: [20, 20] });

          // ── City-level winner badge ───────────────────────────────────────────────
          // Derive from secteur data: plurality bloc by secteur count
          // Count by arrondissement polygons (not secteurs): SR01 covers 4 arrondissements
          const blocCount = {};
          let totalArrdts = 0;
          citySecteurs.forEach((s) => {
            const n = s.arrondissement_codes.length;
            blocCount[s.winning_bloc] = (blocCount[s.winning_bloc] || 0) + n;
            totalArrdts += n;
          });
          const winnerBloc = Object.entries(blocCount).sort(
            (a, b) => b[1] - a[1],
          )[0];
          const [wBloc, wCount] = winnerBloc;
          const wColor = BLOC_COLORS[wBloc] || "#aaa";
          const wLabel = BLOC_LABELS[wBloc] || wBloc;
          const wTotal = totalArrdts;

          // ── Combined legend (winner + blocs + bubble key) ─────────────────────────
          const legend = L.control({ position: "bottomright" });
          legend.onAdd = () => {
            const div = L.DomUtil.create("div", "plm-legend");
            const blocs = [...new Set(citySecteurs.map((s) => s.winning_bloc))];
            div.innerHTML =
              // Winner
              `<span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em">Vainqueur</span><br>` +
              `<span style="font-size:15px;font-weight:700;color:${wColor}">${wLabel}</span><br>` +
              `<span style="font-size:10px;color:#aaa">${wCount} arrondissement${wCount > 1 ? "s" : ""} sur ${wTotal}</span>` +
              "<hr style='margin:7px 0;border-color:#eee'>" +
              // Blocs
              "<b style='display:block;margin-bottom:4px'>Bloc vainqueur</b>" +
              blocs
                .sort((a, b) => BLOC_ORDER.indexOf(a) - BLOC_ORDER.indexOf(b))
                .map(
                  (b) =>
                    `<span class="plm-legend-dot" style="background:${BLOC_COLORS[b]}"></span>` +
                    `${BLOC_LABELS[b] || b}`,
                )
                .join("<br>") +
              "<hr style='margin:7px 0;border-color:#eee'>" +
              // Bubble size key
              "<b style='display:block;margin-bottom:4px'>Prix médian au m²</b>" +
              "<span style='display:flex;align-items:center;gap:6px;margin-bottom:3px'>" +
              "<svg width='20' height='20' aria-hidden='true'><circle cx='10' cy='10' r='4' fill='#fff' stroke='#888' stroke-width='2'/></svg>" +
              "<span style='color:#555;font-size:10px'>Plus abordable</span>" +
              "</span>" +
              "<span style='display:flex;align-items:center;gap:6px'>" +
              "<svg width='20' height='20' aria-hidden='true'><circle cx='10' cy='10' r='9' fill='#fff' stroke='#888' stroke-width='2'/></svg>" +
              "<span style='color:#555;font-size:10px'>Plus cher</span>" +
              "</span>";
            return div;
          };
          legend.addTo(map);

          plmMaps[city] = map;
          plmMapInited[city] = true;
        } catch (err) {
          // Reset flag so the user can retry by switching away and back
          plmMapInited[city] = false;
          loader.remove();
          const errEl = document.createElement("p");
          errEl.className = "load-error";
          errEl.textContent = `Erreur de chargement : ${err.message}`;
          mapEl.appendChild(errEl);
          return;
        }
        loader.remove();
      }

      // Set initial blurbs
      switchVizTab("quintile");
      switchPLMSubtab("paris");
