let viewMode = "overview";
let selectedCountry = null;
let selectedCity = null;
let allData = [];
let currentPage = 0;
const pageSize = 20;

const pollutantColors = {
  "PM2.5": "#f7585bff",
  Ozone: "#377eb8",
  NO2: "#4daf4a",
  CO: "#ff7f00",
};

const svgWidth = 840;
const svgHeight = 650;
const m_right = 40;
const m_top = 40;
const m_bottom = 120;
const m_left = 80;
const width = svgWidth - m_left - m_right;
const height = svgHeight - m_top - m_bottom;

const svg = d3
  .select("#chart-svg")
  .attr("width", svgWidth)
  .attr("height", svgHeight);

const barchart = svg
  .append("g")
  .attr("transform", `translate(${m_left}, ${m_top})`);

const Title = d3.select("#title");
const description = d3.select("#description");
const backButton = d3.select("#back-button");
const prevButton = d3.select("#prev-button");
const nextButton = d3.select("#next-button");
const tooltip = d3.select("#tooltip");

d3.csv("global_air_pollution_data.csv").then((data) => {
  const rawColumns = data.columns;
  data.forEach((d) => {
    const cleanRow = {};
    rawColumns.forEach((col) => {
      let cleanKey = col.trim().replace(/[^a-zA-Z0-9_]/g, "_");
      cleanRow[cleanKey] = isNaN(d[col]) ? d[col] : +d[col];
    });
    if (cleanRow.country_name && cleanRow.country_name.trim() !== "") {
      allData.push(cleanRow);
    }
  });

  mainVis();
});

function mainVis() {
  prevButton.classed("hidden", viewMode !== "overview");
  nextButton.classed("hidden", viewMode !== "overview");

  switch (viewMode) {
    case "overview":
      overviewscene();
      break;
    case "countryDetail":
      CountryScene();
      break;
    case "cityDetail":
      CityScene();
      break;
  }
}

function overviewscene() {
  Title.text("Global Air Quality Overview");
  description.text(
    "Some countries have greater air pollution than others. This chart shows the average Air Quality Index (AQI) by country. Higher values indicate worse air quality. Click a country to view more details."
  );
  backButton.classed("hidden", true);

  const countryAverages = d3.rollup(
    allData,
    (v) => d3.mean(v, (d) => d.aqi_value),
    (d) => d.country_name
  );
  const overviewData = Array.from(countryAverages, ([key, value]) => ({
    country: key,
    avg_aqi: value,
  })).sort((a, b) => b.avg_aqi - a.avg_aqi);

  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = overviewData.slice(startIndex, endIndex);
  const totalPages = Math.ceil(overviewData.length / pageSize);

  prevButton.property("disabled", currentPage === 0);
  nextButton.property("disabled", currentPage >= totalPages - 1);

  barchart.selectAll("*").remove();

  const xScale = d3
    .scaleBand()
    .domain(paginatedData.map((d) => d.country))
    .range([0, width])
    .paddingInner(0.2)
    .paddingOuter(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(overviewData, (d) => d.avg_aqi)])
    .range([height, 0])
    .nice();

  const colorScale = d3
    .scaleLinear()
    .domain([
      0,
      Math.floor((overviewData.length - 1) * 0.1),
      Math.floor((overviewData.length - 1) * 0.2),
      Math.floor((overviewData.length - 1) * 0.4),
      Math.floor((overviewData.length - 1) * 0.6),
      Math.floor((overviewData.length - 1) * 0.8),
      overviewData.length - 1,
    ])
    .range([
      "#d50875ff",
      "#e53935",
      "#ff9800",
      "#fff176",
      "#ffffff",
      "#90caf9",
      "#1a237e",
    ]);

  const xAxis = d3.axisBottom(xScale);
  barchart
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-45)");

  barchart.append("g").call(d3.axisLeft(yScale));
  barchart
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", -m_left + 20)
    .attr("x", -height / 2)
    .style("text-anchor", "middle")
    .text("Average Air Quality Index (AQI)");

  barchart
    .selectAll(".bar")
    .data(paginatedData)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => xScale(d.country))
    .attr("y", (d) => yScale(d.avg_aqi))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.avg_aqi))
    .attr("fill", (d, i) => colorScale(startIndex + i))
    .on("click", (event, d) => {
      tooltip.classed("hidden", true);
      viewMode = "countryDetail";
      selectedCountry = d.country;
      mainVis();
    })

    .on("mouseover", function (event, d) {
      d3.select(this).style("stroke", "#333").style("stroke-width", "2px");
      tooltip
        .html(
          `<strong>${d.country}</strong><br/>Avg. AQI: ${d.avg_aqi.toFixed(2)}`
        )
        .classed("hidden", false)
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", null).style("stroke-width", null);
      tooltip.classed("hidden", true);
    });

  if (currentPage === 0) {
    const highestCountry = paginatedData[0];
    const annotations = [
      {
        note: {
          label: `Has The Highest Average AQI`,
          title: `${highestCountry.country}`,
        },
        x: xScale(highestCountry.country) + xScale.bandwidth() / 2,
        y: yScale(highestCountry.avg_aqi) + 10,
        dy: -10,
        dx: 40,
      },
    ];
    barchart.append("g").call(d3.annotation().annotations(annotations));
  }
}

function CountryScene() {
  Title.text(`Most Polluted Cities in ${selectedCountry}`);
  description.text(
    "Some cities are pollution hotspots of specific country. Click a city to see which factors contribute to its air quality."
  );
  backButton.classed("hidden", false).text(`← Back to Global Overview`);

  const countryData = allData
    .filter((d) => d.country_name === selectedCountry)
    .sort((a, b) => b.aqi_value - a.aqi_value)
    .slice(0, 15);

  barchart.selectAll("*").remove();

  const xScale = d3
    .scaleBand()
    .domain(countryData.map((d) => d.city_name))
    .range([0, width])
    .padding(0.2);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(countryData, (d) => d.aqi_value)])
    .range([height, 0])
    .nice();

  const cityColorScale = d3
    .scaleLinear()
    .domain([0, countryData.length - 1])
    .range(["#1a237e", "#bbdefb"]);

  barchart
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-45)");
  barchart.append("g").call(d3.axisLeft(yScale));
  barchart
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", -m_left + 20)
    .attr("x", -height / 2)
    .style("text-anchor", "middle")
    .text("Air Quality Index (AQI)");

  barchart
    .selectAll(".bar")
    .data(countryData)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => xScale(d.city_name))
    .attr("y", (d) => yScale(d.aqi_value))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.aqi_value))
    .attr("fill", (d, i) => cityColorScale(i))
    .on("click", (event, d) => {
      tooltip.classed("hidden", true);
      viewMode = "cityDetail";
      selectedCity = d.city_name;
      mainVis();
    })

    .on("mouseover", function (event, d) {
      d3.select(this).style("stroke", "#333").style("stroke-width", "2px");
      tooltip
        .html(`<strong>${d.city_name}</strong><br/>AQI: ${d.aqi_value}`)
        .classed("hidden", false)
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", null).style("stroke-width", null);
      tooltip.classed("hidden", true);
    });
}

function CityScene() {
  Title.text(`Pollutant Breakdown for ${selectedCity}`);
  description.text(
    `The overall AQI is determined by factors. This chart reveals which specific pollutant is the main contributor to ${selectedCity}'s air quality.`
  );
  backButton
    .classed("hidden", false)
    .text(`← Back to Cities in ${selectedCountry}`);

  const cityData = allData.find(
    (d) => d.city_name === selectedCity && d.country_name === selectedCountry
  );
  const pollutant_Data = [
    { pollutant: "PM2.5", value: cityData.pm2_5_aqi_value },
    { pollutant: "Ozone", value: cityData.ozone_aqi_value },
    { pollutant: "NO2", value: cityData.no2_aqi_value },
    { pollutant: "CO", value: cityData.co_aqi_value },
  ].sort((a, b) => b.value - a.value);

  barchart.selectAll("*").remove();

  const xScale = d3
    .scaleBand()
    .domain(pollutant_Data.map((d) => d.pollutant))
    .range([0, width])
    .padding(0.4);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(pollutant_Data, (d) => d.value)])
    .range([height, 0])
    .nice();

  barchart
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale));
  barchart.append("g").call(d3.axisLeft(yScale));
  barchart
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", -m_left + 20)
    .attr("x", -height / 2)
    .style("text-anchor", "middle")
    .text("Pollutant-Specific AQI Value");

  barchart
    .selectAll(".bar")
    .data(pollutant_Data)
    .join("rect")
    .attr("class", "bar")
    .style("cursor", "default")
    .attr("x", (d) => xScale(d.pollutant))
    .attr("y", (d) => yScale(d.value))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.value))
    .attr("fill", (d) => pollutantColors[d.pollutant] || "#888")
    .on("mouseover", function (event, d) {
      d3.select(this).style("stroke", "#333").style("stroke-width", "2px");
      tooltip
        .html(`<strong>${d.pollutant}</strong><br/>AQI: ${d.value}`)
        .classed("hidden", false)
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", null).style("stroke-width", null);
      tooltip.classed("hidden", true);
    });

  const mainpollu = pollutant_Data[0];
  const annotations = [
    {
      note: {
        label: `In ${selectedCity} is ${mainpollu.pollutant}`,
        title: "Main Contributor",
      },
      x: xScale(mainpollu.pollutant) + xScale.bandwidth() / 2,
      y: yScale(mainpollu.value),
      dy: -10,
      dx: 0,
    },
  ];
  barchart.append("g").call(d3.annotation().annotations(annotations));
}

backButton.on("click", () => {
  if (viewMode === "cityDetail") {
    viewMode = "countryDetail";
  } else if (viewMode === "countryDetail") {
    viewMode = "overview";
  }
  mainVis();
});

prevButton.on("click", () => {
  if (currentPage > 0) {
    currentPage--;
    mainVis();
  }
});

nextButton.on("click", () => {
  currentPage++;
  mainVis();
});
