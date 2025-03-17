export async function createMap() {
  const width = 960,
    height = 500;
  const container = html`
    <div style="width: ${width}px;">
      <select id="drainage-select" style="width: ${width}px; height: 40px; font-size: 16px; margin-bottom: 5px;">
        <option value="all">-- SELECT ALL --</option>
      </select>
      <svg width="${width}" height="${height}"></svg>
    </div>
  `;
  const selectEl = container.querySelector("#drainage-select");
  const svg = d3.select(container).select("svg");

  const world = await d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson");
  const geoData = await d3.json("data/map.geojson");
  geoData.features = geoData.features.map(f => turf.rewind(f, { reverse: true }));

  const drainageZones = Array.from(new Set(geoData.features.map(d => d.properties.DRAINAGE))).sort();
  drainageZones.forEach(zone => {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone;
    selectEl.appendChild(option);
  });

  const combined = { type: "FeatureCollection", features: [...world.features, ...geoData.features] };
  const projection = d3.geoNaturalEarth1();
  projection.fitSize([width, height], combined);
  const path = d3.geoPath().projection(projection);

  const gBackground = svg.append("g").attr("class", "background-map");
  gBackground.selectAll("path")
    .data(world.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#eeeeee")
    .attr("stroke", "#999999")
    .attr("stroke-width", 0.5);

  const colorScale = d3.scaleQuantize()
    .domain(d3.extent(geoData.features, d => d.properties.Wsavg))
    .range(["#d1d750", "#c08826", "#a31717"]);

  const gData = svg.append("g").attr("class", "map-layer");
  gData.selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d => colorScale(d.properties.Wsavg || 0))
    .attr("stroke", "black")
    .attr("stroke-width", 0.5)
    .on("mouseenter", function (event, d) {
      if (selectEl.value === "all") {
        gData.selectAll("path").style("opacity", f => (f === d ? 1 : 0.2));
      }
      tooltip.style("visibility", "visible").text(`Wsavg : ${d.properties.Wsavg}`);
    })
    .on("mouseleave", function () {
      if (selectEl.value === "all") {
        gData.selectAll("path").style("opacity", 1);
      }
      tooltip.style("visibility", "hidden");
    })
    .on("click", function (event, d) {
      const zone = d.properties.DRAINAGE || "all";
      selectEl.value = zone;
      updateSelection(zone);
    });

  const tooltip = svg.append("text")
    .attr("class", "tooltip")
    .style("font-family", "sans-serif")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("visibility", "hidden");

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", event => {
      gBackground.attr("transform", event.transform);
      gData.attr("transform", event.transform);
    });
  svg.call(zoom);

  svg.node().addEventListener("click", function (event) {
    if (event.target.tagName.toLowerCase() === "svg") {
      selectEl.value = "all";
      updateSelection("all");
    }
  });

  function updateSelection(selectedZone) {
    if (selectedZone === "all" || selectedZone === "") {
      gData.selectAll("path").style("opacity", 1);
    } else {
      gData.selectAll("path")
        .style("opacity", d => d.properties.DRAINAGE === selectedZone ? 1 : 0.2);
      updateCharts(selectedZone.replace(/ RIVER/gi, ""));
    }
  }
  selectEl.addEventListener("change", function () {
    updateSelection(this.value);
  });

  function addColorLegend(svg, colorScale, width, height) {
    const legendWidth = 150,
      legendHeight = 12;
    const legendMargin = { top: 10, right: 10, bottom: 20, left: 10 };

    const legendGroup = svg.append("g")
      .attr("transform", `translate(${width - legendWidth - legendMargin.right}, ${height - legendHeight - legendMargin.bottom})`);

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .tickSize(4)
      .ticks(3);

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    colorScale.range().forEach((color, i) => {
      linearGradient.append("stop")
        .attr("offset", `${(i / (colorScale.range().length - 1)) * 100}%`)
        .attr("stop-color", color);
    });

    legendGroup.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)")
      .style("stroke", "black")
      .style("stroke-width", 0.5);

    legendGroup.append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .select(".domain")
      .remove();
  }

  addColorLegend(svg, colorScale, width, height);

  return container;
}
