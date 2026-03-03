const statusEl = document.querySelector("#status");
const cityListEl = document.querySelector("#city-list");
const unitButtons = document.querySelectorAll(".unit-btn");

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
let cityWeatherData = [];

const buildForecastUrl = ({ latitude, longitude }) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

const formatTemperature = (valueInCelsius) => {
  if (typeof valueInCelsius !== "number") {
    return "--";
  }

  if (selectedUnit === "fahrenheit") {
    const valueInFahrenheit = (valueInCelsius * 9) / 5 + 32;
    return `${valueInFahrenheit.toFixed(1)} °F`;
  }

  return `${valueInCelsius.toFixed(1)} °C`;
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

  if (!timezoneAbbreviation) {
    return timezone;
  }

  return `${timezoneAbbreviation} (${timezone})`;
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
        <span class="weather-pill ${conditionTheme}">${condition}</span>
      </div>
      <p class="city-country">${city.country}</p>
      <p class="city-time">Local time: ${cityTime}</p>
      <p class="row"><span class="label">Time Zone</span><span class="value">${timezoneLabel}</span></p>
      <p class="row"><span class="label">Temperature</span><span class="value">${formatTemperature(current.temperature_2m)}</span></p>
      <p class="row"><span class="label">Feels Like</span><span class="value">${formatTemperature(current.apparent_temperature)}</span></p>
      <p class="row"><span class="label">Humidity</span><span class="value">${current.relative_humidity_2m}${humidityUnit}</span></p>
      <p class="row"><span class="label">Wind</span><span class="value">${formatWindSpeed(current.wind_speed_10m, windUnit)}</span></p>
    </li>
  `;
};

const renderAllCities = () => {
  cityListEl.innerHTML = cityWeatherData
    .map(({ city, current, currentUnits, timezone, timezoneAbbreviation }) =>
      renderCityWeather(
        city,
        current,
        currentUnits,
        timezone,
        timezoneAbbreviation,
      ),
    )
    .join("");
};

const fetchCityWeather = async (city) => {
  const response = await fetch(buildForecastUrl(city));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`${city.name} response:`, data);
  return {
    city,
    current: data.current,
    currentUnits: data.current_units,
    timezone: data.timezone,
    timezoneAbbreviation: data.timezone_abbreviation,
  };
};

const fetchWeather = async () => {
  statusEl.textContent = "Loading cities...";

  try {
    cityWeatherData = await Promise.all(
      CITIES.map((city) => fetchCityWeather(city)),
    );
    renderAllCities();
    setLastRefreshedStatus();
  } catch (error) {
    console.error("Weather fetch error:", error);
    statusEl.textContent = "Failed to load weather.";
    cityListEl.innerHTML = "";
  }
};

unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedUnit = button.dataset.unit;
    unitButtons.forEach((unitButton) => {
      unitButton.classList.toggle("active", unitButton === button);
    });
    renderAllCities();
  });
});

fetchWeather();
