import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);
//import { MAPBOX_API_KEY } from './config.js';
mapboxgl.accessToken = "pk.eyJ1Ijoia2V2aW5rY2hlbjEiLCJhIjoiY21hcTU1NWo5MDV0bzJrcHV1cnZlOWVqeiJ9.8RKpbknyw5jqaK6LlZrb2g";

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18, // Maximum allowed zoom
  });


  /*const container = d3.select(map.getContainer());
  const svg = container.append('svg')
    .style('position', 'absolute')
    .style('top', 0)
    .style('left', 0)
    .style('width', '100%')
    .style('height', '100%')
    .style('pointer-events', 'none');*/
//const svg = d3.select('#map').select('svg');
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
function computeStationTraffic(stations, timeFilter = -1) {
  // Compute departures
  const departures = d3.rollup(
    //trips,
    filterByMinute(departuresByMinute, timeFilter),
    (v) => v.length,
    (d) => d.start_station_id,
  );

  // Computed arrivals as you did in step 4.2
  const arrivals = d3.rollup(
    //trips,
    filterByMinute(arrivalsByMinute, timeFilter),
    (v) => v.length,
    (d) => d.end_station_id
  );
  // Update each station..
  return stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    // what you updated in step 4.2
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips // If no filter is applied (-1), return all trips
    : trips.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);

        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) {
    return tripsByMinute.flat(); // No filtering, return all trips
  }

  // Normalize both min and max minutes to the valid range [0, 1439]
  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;

  // Handle time filtering across midnight
  if (minMinute > maxMinute) {
    let beforeMidnight = tripsByMinute.slice(minMinute);
    let afterMidnight = tripsByMinute.slice(0, maxMinute);
    return beforeMidnight.concat(afterMidnight).flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute).flat();
  }
}

const svg = d3.select('#map').select('svg');
// Ensure SVG is styled correctly in case CSS doesn't load yet
svg
  .style('position', 'absolute')
  .style('top', 0)
  .style('left', 0)
  .style('width', '100%')
  .style('height', '100%')
  .style('pointer-events', 'none');

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
  // Wait for the map to fully load
map.on('load', async () => {
    // Step 1: Add the data source
    map.addSource('boston_route', {
      type: 'geojson',
      data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });

    map.addSource('cambridge_route', {
      type: 'geojson',
      data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  
    // Step 2: Add a layer to visualize the data
    map.addLayer({
      id: 'bike-lanes',
      type: 'line',
      source: 'boston_route',
      paint: {
        'line-color': '#32D400',   // Bright green
        'line-width': 5,           // Thicker lines
        'line-opacity': 0.6        // Slightly less transparent
      }
     
    });

    map.addLayer({
      id: 'cambridge-bike-lanes',
      type: 'line',
      source: 'cambridge_route',
      paint: {
        'line-color': 'blue',
        'line-width': 3,
        'line-opacity': 0.4,
      },
    });

    let jsonData;

    try {
        
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
        //const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv"

        // Await JSON fetch
        jsonData = await d3.json(jsonurl);

        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
  }
    
  let trips = await d3.csv(
    'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      let startedMinutes = minutesSinceMidnight(trip.started_at);
      departuresByMinute[startedMinutes].push(trip);

      let endedMinutes = minutesSinceMidnight(trip.ended_at);
      arrivalsByMinute[endedMinutes].push(trip);

      return trip;
    }
  );
  console.log("Loaded trips:", trips);
  
  
  //let stations = jsonData.data.stations;
  //let stations = computeStationTraffic(jsonData.data.stations, trips);
  const stations = computeStationTraffic(jsonData.data.stations);

  console.log('Stations Array:', stations);
    /*stations.forEach(station => {
        new mapboxgl.Marker({ color: 'blue' })
          .setLngLat([station.lon, station.lat])
          .setPopup(new mapboxgl.Popup().setText(station.name))
          .addTo(map);
      });*/
    //const trips = await d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv");
    


    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
      );
      
      // Step 3: Calculate arrivals by end_station_id
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
      );
    /*stations = stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
      });*/
    stations.forEach((station) => {
      let id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
    });
    console.log("Stations with traffic info:", stations);
  

    const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic)])
      .range([0, 25]);
    
    
    var circles = svg
      .selectAll('circle')
      .data(stations, (d) => d.short_name)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .each(function(d) {
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
      
      /*.style('--departure-ratio', (d) =>
        stationFlow(d.departures / d.totalTraffic),
      );*/
    
    circles.each(function (d) {
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
      
    
    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }
    function getCoords(station) {
      const point = new mapboxgl.LngLat(+station.lon, +station.lat);
      const { x, y } = map.project(point);
      return { cx: x, cy: y };
  }
    updatePositions();
    map.on('move', updatePositions); // Update during map movement
    map.on('zoom', updatePositions); // Update during zooming
    map.on('resize', updatePositions); // Update on window resize
    map.on('moveend', updatePositions); // Final adjustment after movement ends

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
  }

  function updateTimeDisplay() {
    var timeFilter = Number(timeSlider.value); // Get slider value
  
    if (timeFilter === -1) {
      selectedTime.textContent = ''; // Clear time display
      anyTimeLabel.style.display = 'block'; // Show "(any time)"
    } else {
      selectedTime.textContent = formatTime(timeFilter); // Display formatted time
      anyTimeLabel.style.display = 'none'; // Hide "(any time)"
    }
   
    // Trigger filtering logic which will be implemented in the next step
    updateScatterPlot(timeFilter);
    
  }

  function updateScatterPlot(timeFilter) {
    // Get only the trips that match the selected time filter
    //const filteredTrips = filterTripsbyTime(trips, timeFilter);
  
    // Recompute station traffic based on the filtered trips
    const filteredStations = computeStationTraffic(stations, timeFilter);
    timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
  
    // Update the scatterplot by adjusting the radius of circles
    circles
      .data(filteredStations, (d) => d.short_name)
      .join('circle') // Ensure the data is bound correctly
      .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
      .style('--departure-ratio', (d) =>
        stationFlow(d.departures / d.totalTraffic),
      );
  }
  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();

    

});
