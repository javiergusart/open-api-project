const statusEl = document.querySelector("#status");
const cityListEl = document.querySelector("#city-list");
const citySearchFormEl = document.querySelector("#city-search");
const cityInputEl = document.querySelector("#city-input");
const citySuggestionsEl = document.querySelector("#city-suggestions");
const undoBarEl = document.querySelector("#undo-bar");
const undoBtnEl = document.querySelector("#undo-btn");
const unitButtons = document.querySelectorAll(".unit-btn");
const unitToggleEl = document.querySelector(".unit-toggle");
const datasetButtons = document.querySelectorAll(".dataset-btn");

// Cities we want to show in the app.
const CITIES = [
  {
    name: "Houston",
    country: "TX, USA",
    latitude: 29.7604,
    longitude: -95.3698,
  },
  {
    name: "Cartagena",
    country: "Colombia",
    latitude: 10.391,
    longitude: -75.4794,
  },
  {
    name: "Maracaibo",
    country: "Venezuela",
    latitude: 10.6545,
    longitude: -71.6406,
  },
  {
    name: "Miami",
    country: "FL, USA",
    latitude: 25.7617,
    longitude: -80.1918,
  },
];

const WEATHER_CODE_LABELS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

let selectedUnit = "fahrenheit";
let selectedDataset = "weather";
let cityData = [];
let suggestionData = [];
let searchDebounceId = null;
let searchAbortController = null;
let lastDeletedCity = null;
// Cache recent suggestion searches so repeated typing feels instant.
const suggestionCache = new Map();

// Each dataset has its own endpoint and only asks for the fields we need.
const buildWeatherUrl = ({ latitude, longitude }) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

const buildAirQualityUrl = ({ latitude, longitude }) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`;

const buildCitySearchUrl = (query) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;

const buildCitySuggestionsUrl = (query) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;

const formatTemperature = (valueInCelsius) => {
  if (typeof valueInCelsius !== "number") {
    return "--";
  }

  if (selectedUnit === "fahrenheit") {
    const valueInFahrenheit = (valueInCelsius * 9) / 5 + 32;
    return `${valueInFahrenheit.toFixed(1)} &deg;F`;
  }

  return `${valueInCelsius.toFixed(1)} &deg;C`;
};

const formatWindSpeed = (windSpeed, windUnitFromApi) => {
  if (typeof windSpeed !== "number") {
    return "--";
  }

  if (selectedUnit === "fahrenheit") {
    if (windUnitFromApi === "km/h") {
      const mph = windSpeed * 0.621371;
      return `${mph.toFixed(1)} mph`;
    }

    if (windUnitFromApi === "m/s") {
      const mph = windSpeed * 2.23694;
      return `${mph.toFixed(1)} mph`;
    }
  }

  return `${windSpeed.toFixed(1)} ${windUnitFromApi || ""}`.trim();
};

const getConditionTheme = (weatherCode) => {
  if (weatherCode === 0 || weatherCode === 1) {
    return "clear";
  }

  if (
    weatherCode === 2 ||
    weatherCode === 3 ||
    weatherCode === 45 ||
    weatherCode === 48
  ) {
    return "cloudy";
  }

  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)
  ) {
    return "rain";
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return "snow";
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return "storm";
  }

  return "cloudy";
};

const formatCityTime = (timezone) => {
  if (!timezone) {
    return "--";
  }

  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date());
};

const formatTimezoneLabel = (timezone, timezoneAbbreviation) => {
  if (!timezone) {
    return "--";
  }

  const formattedTimezone = timezone.replaceAll("_", " ");

  if (!timezoneAbbreviation) {
    return formattedTimezone;
  }

  return `${timezoneAbbreviation} (${formattedTimezone})`;
};

const getAqiCategory = (aqi) => {
  if (typeof aqi !== "number") {
    return "Unknown";
  }

  if (aqi <= 50) {
    return "Good";
  }

  if (aqi <= 100) {
    return "Moderate";
  }

  if (aqi <= 150) {
    return "Unhealthy for Sensitive Groups";
  }

  if (aqi <= 200) {
    return "Unhealthy";
  }

  if (aqi <= 300) {
    return "Very Unhealthy";
  }

  return "Hazardous";
};

const formatValue = (value, unit) => {
  if (typeof value !== "number") {
    return "--";
  }

  const numberLabel = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1);
  return `${numberLabel} ${unit || ""}`.trim();
};

const toCityKey = (name, country) =>
  `${(name || "").trim().toLowerCase()}|${(country || "")
    .trim()
    .toLowerCase()}`;

const cityExists = (name, country) => {
  const nextKey = toCityKey(name, country);
  return CITIES.some((city) => toCityKey(city.name, city.country) === nextKey);
};

const cityMatchesByKey = (city, key) =>
  toCityKey(city.name, city.country) === key;

// Reset the floating suggestions list.
const clearSuggestions = () => {
  suggestionData = [];
  citySuggestionsEl.innerHTML = "";
};

// Hide undo state once it is used or replaced by a new action.
const clearUndo = () => {
  lastDeletedCity = null;
  undoBarEl.hidden = true;
};

const showUndo = () => {
  undoBarEl.hidden = false;
};

const getLoadingMessage = () =>
  selectedDataset === "weather"
    ? "Loading weather..."
    : "Loading air quality...";

const setDatasetControls = () => {
  unitToggleEl.hidden = selectedDataset !== "weather";
};

const setLastRefreshedStatus = () => {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  statusEl.textContent = `Last refreshed at ${timeLabel}`;
};

const renderCityWeather = (
  city,
  current,
  currentUnits,
  timezone,
  timezoneAbbreviation,
) => {
  if (!current) {
    return `
      <li class="city-card">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-country">${city.country}</p>
        <p class="row"><span class="label">Status</span><span class="value">No data</span></p>
      </li>
    `;
  }

  const condition = WEATHER_CODE_LABELS[current.weather_code] || "Unknown";
  const conditionTheme = getConditionTheme(current.weather_code);
  const humidityUnit = currentUnits?.relative_humidity_2m || "%";
  const windUnit = currentUnits?.wind_speed_10m || "";
  const cityTime = formatCityTime(timezone);
  const timezoneLabel = formatTimezoneLabel(timezone, timezoneAbbreviation);

  return `
    <li class="city-card">
      <div class="city-top">
        <h2 class="city-name">${city.name}</h2>
        <button type="button" class="delete-city-btn" data-city-key="${toCityKey(city.name, city.country)}">Delete</button>
      </div>
      <p class="city-country">${city.country}</p>
      <p class="row"><span class="label">Condition</span><span class="weather-pill ${conditionTheme}">${condition}</span></p>
      <p class="city-time">Local time: ${cityTime}</p>
      <p class="row"><span class="label">Time Zone</span><span class="value">${timezoneLabel}</span></p>
      <p class="row"><span class="label">Temperature</span><span class="value">${formatTemperature(current.temperature_2m)}</span></p>
      <p class="row"><span class="label">Feels Like</span><span class="value">${formatTemperature(current.apparent_temperature)}</span></p>
      <p class="row"><span class="label">Humidity</span><span class="value">${current.relative_humidity_2m}${humidityUnit}</span></p>
      <p class="row"><span class="label">Wind</span><span class="value">${formatWindSpeed(current.wind_speed_10m, windUnit)}</span></p>
    </li>
  `;
};

const renderCityAirQuality = (
  city,
  current,
  currentUnits,
  timezone,
  timezoneAbbreviation,
) => {
  if (!current) {
    return `
      <li class="city-card">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-country">${city.country}</p>
        <p class="row"><span class="label">Status</span><span class="value">No data</span></p>
      </li>
    `;
  }

  const cityTime = formatCityTime(timezone);
  const timezoneLabel = formatTimezoneLabel(timezone, timezoneAbbreviation);
  const aqiCategory = getAqiCategory(current.us_aqi);

  return `
    <li class="city-card">
      <div class="city-top">
        <h2 class="city-name">${city.name}</h2>
        <button type="button" class="delete-city-btn" data-city-key="${toCityKey(city.name, city.country)}">Delete</button>
      </div>
      <p class="city-country">${city.country}</p>
      <p class="row"><span class="label">AQI Category</span><span class="aqi-pill">${aqiCategory}</span></p>
      <p class="city-time">Local time: ${cityTime}</p>
      <p class="row"><span class="label">Time Zone</span><span class="value">${timezoneLabel}</span></p>
      <p class="row"><span class="label">US AQI</span><span class="value">${formatValue(current.us_aqi, currentUnits?.us_aqi)}</span></p>
      <p class="row"><span class="label">PM2.5</span><span class="value">${formatValue(current.pm2_5, currentUnits?.pm2_5)}</span></p>
      <p class="row"><span class="label">PM10</span><span class="value">${formatValue(current.pm10, currentUnits?.pm10)}</span></p>
      <p class="row"><span class="label">CO</span><span class="value">${formatValue(current.carbon_monoxide, currentUnits?.carbon_monoxide)}</span></p>
      <p class="row"><span class="label">NO<sub>2</sub></span><span class="value">${formatValue(current.nitrogen_dioxide, currentUnits?.nitrogen_dioxide)}</span></p>
      <p class="row"><span class="label">O<sub>3</sub></span><span class="value">${formatValue(current.ozone, currentUnits?.ozone)}</span></p>
    </li>
  `;
};

const renderAllCities = () => {
  cityListEl.innerHTML = cityData
    .map(({ city, current, currentUnits, timezone, timezoneAbbreviation }) => {
      if (selectedDataset === "weather") {
        return renderCityWeather(
          city,
          current,
          currentUnits,
          timezone,
          timezoneAbbreviation,
        );
      }

      return renderCityAirQuality(
        city,
        current,
        currentUnits,
        timezone,
        timezoneAbbreviation,
      );
    })
    .join("");
};

// Weather and air quality use different endpoints but return a shared shape.
const fetchCityWeather = async (city) => {
  const response = await fetch(buildWeatherUrl(city));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    city,
    current: data.current,
    currentUnits: data.current_units,
    timezone: data.timezone,
    timezoneAbbreviation: data.timezone_abbreviation,
  };
};

const fetchCityAirQuality = async (city) => {
  const response = await fetch(buildAirQualityUrl(city));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    city,
    current: data.current,
    currentUnits: data.current_units,
    timezone: data.timezone,
    timezoneAbbreviation: data.timezone_abbreviation,
  };
};

const searchCity = async (query) => {
  const response = await fetch(buildCitySearchUrl(query));

  if (!response.ok) {
    throw new Error(`City search failed: ${response.status}`);
  }

  const data = await response.json();
  const [match] = data.results || [];

  if (!match) {
    return null;
  }

  const locationLabel = [match.admin1, match.country]
    .filter(Boolean)
    .join(", ");

  return {
    name: match.name,
    country: locationLabel || match.country || "Unknown",
    latitude: match.latitude,
    longitude: match.longitude,
  };
};

// Suggestion requests cancel the previous call to avoid racing older results.
const searchCitySuggestions = async (query) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (suggestionCache.has(normalizedQuery)) {
    return suggestionCache.get(normalizedQuery);
  }

  if (searchAbortController) {
    searchAbortController.abort();
  }

  searchAbortController = new AbortController();

  const response = await fetch(buildCitySuggestionsUrl(query), {
    signal: searchAbortController.signal,
  });

  if (!response.ok) {
    throw new Error(`Suggestion search failed: ${response.status}`);
  }

  const data = await response.json();
  const matches = data.results || [];

  const mappedMatches = matches.map((match) => {
    const locationLabel = [match.admin1, match.country]
      .filter(Boolean)
      .join(", ");

    return {
      name: match.name,
      country: locationLabel || match.country || "Unknown",
      latitude: match.latitude,
      longitude: match.longitude,
    };
  });

  suggestionCache.set(normalizedQuery, mappedMatches);
  return mappedMatches;
};

const renderSuggestions = () => {
  citySuggestionsEl.innerHTML = suggestionData
    .map(
      (city, index) =>
        `<li><button type="button" data-suggestion-index="${index}">${city.name}, ${city.country}</button></li>`,
    )
    .join("");
};

// Add a city and immediately refresh the currently selected dataset view.
const addCity = async (city) => {
  if (cityExists(city.name, city.country)) {
    statusEl.textContent = `${city.name} is already in the list.`;
    return false;
  }

  CITIES.unshift(city);
  cityInputEl.value = "";
  clearSuggestions();
  clearUndo();
  await fetchSelectedDataset();
  return true;
};

// Remove card data locally first, then offer one click undo.
const removeCityByKey = async (cityKey) => {
  const cityIndex = CITIES.findIndex((city) => cityMatchesByKey(city, cityKey));

  if (cityIndex === -1) {
    return;
  }

  const [removedCity] = CITIES.splice(cityIndex, 1);

  if (!removedCity) {
    return;
  }

  lastDeletedCity = {
    city: removedCity,
    index: cityIndex,
  };

  cityData = cityData.filter(({ city }) => !cityMatchesByKey(city, cityKey));
  renderAllCities();
  statusEl.textContent = `${removedCity.name} removed.`;
  showUndo();
};

const fetchSelectedDataset = async () => {
  statusEl.textContent = getLoadingMessage();

  try {
    // When the active tab changes we request fresh data for that tab.
    cityData = await Promise.all(
      CITIES.map((city) => {
        if (selectedDataset === "weather") {
          return fetchCityWeather(city);
        }

        return fetchCityAirQuality(city);
      }),
    );

    renderAllCities();
    setLastRefreshedStatus();
  } catch (error) {
    console.error("Data fetch error:", error);
    statusEl.textContent =
      selectedDataset === "weather"
        ? "Failed to load weather."
        : "Failed to load air quality.";
    cityListEl.innerHTML = "";
  }
};

unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Unit buttons only change formatting for weather values.
    selectedUnit = button.dataset.unit;
    unitButtons.forEach((unitButton) => {
      unitButton.classList.toggle("active", unitButton === button);
    });
    if (selectedDataset === "weather") {
      renderAllCities();
    }
  });
});

datasetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Dataset buttons trigger a new request for weather or air quality.
    selectedDataset = button.dataset.dataset;

    datasetButtons.forEach((datasetButton) => {
      datasetButton.classList.toggle("active", datasetButton === button);
    });

    setDatasetControls();
    fetchSelectedDataset();
  });
});

citySearchFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = cityInputEl.value.trim();

  if (!query) {
    statusEl.textContent = "Type a city name first.";
    return;
  }

  statusEl.textContent = `Searching for ${query}...`;

  try {
    const city = await searchCity(query);

    if (!city) {
      statusEl.textContent = "City not found. Try a different name.";
      return;
    }

    await addCity(city);
  } catch (error) {
    console.error("City search error:", error);
    statusEl.textContent = "Could not search city right now.";
  }
});

cityInputEl.addEventListener("input", () => {
  const query = cityInputEl.value.trim();

  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
  }

  if (query.length < 2) {
    clearSuggestions();
    return;
  }

  const normalizedQuery = query.toLowerCase();

  if (suggestionCache.has(normalizedQuery)) {
    // Cached suggestions render right away without waiting for debounce.
    suggestionData = suggestionCache.get(normalizedQuery);
    renderSuggestions();
    return;
  }

  // Small debounce keeps requests responsive but avoids one call per keypress.
  searchDebounceId = window.setTimeout(async () => {
    try {
      suggestionData = await searchCitySuggestions(query);
      renderSuggestions();
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("Suggestion error:", error);
      clearSuggestions();
    }
  }, 100);
});

citySuggestionsEl.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-suggestion-index]");

  if (!target) {
    return;
  }

  const index = Number(target.dataset.suggestionIndex);
  const selectedCity = suggestionData[index];

  if (!selectedCity) {
    return;
  }

  cityInputEl.value = `${selectedCity.name}`;
  await addCity(selectedCity);
});

document.addEventListener("click", (event) => {
  // Clicking outside the search area closes the floating suggestion list.
  if (citySearchFormEl.contains(event.target)) {
    return;
  }

  clearSuggestions();
});

cityListEl.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-city-key]");

  if (!target) {
    return;
  }

  await removeCityByKey(target.dataset.cityKey);
});

undoBtnEl.addEventListener("click", async () => {
  if (!lastDeletedCity) {
    return;
  }

  CITIES.splice(lastDeletedCity.index, 0, lastDeletedCity.city);
  const restoredName = lastDeletedCity.city.name;
  clearUndo();
  statusEl.textContent = `${restoredName} restored.`;
  await fetchSelectedDataset();
});

setDatasetControls();
fetchSelectedDataset();
