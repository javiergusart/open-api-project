# Open API Project

This is a browser app built with HTML CSS and JavaScript.
It uses Open Meteo APIs to show weather and air quality data for cities.

## What it shows

1. Weather tab shows current temperature feels like humidity wind and condition
2. Air Quality tab shows current US AQI PM2.5 PM10 CO NO2 and O3
3. Local time and time zone are shown for each city card

## How requests work

1. When Weather is active the app requests only weather fields from the weather endpoint
2. When Air Quality is active the app requests only air quality fields from the air quality endpoint
3. Switching tabs sends a new GET request for the selected tab
4. City search uses Open Meteo geocoding to find city coordinates before adding a city

## Search and city controls

1. The app starts with 4 default cities
2. You can search and add any city
3. Search suggestions appear while typing
4. Suggestions close when you click outside the search area
5. You can delete a city card
6. Undo delete restores the last city removed

## How to run it

1. Open the OAP folder
2. Open index.html in your browser
3. Use the Weather and Air Quality tabs to switch datasets
4. Type a city name in the search box and click Add City
5. Use Delete to remove a city and Undo delete to bring it back

## API endpoints used

1. Weather endpoint
   https://api.open-meteo.com/v1/forecast

2. Air quality endpoint
   https://air-quality-api.open-meteo.com/v1/air-quality

3. Geocoding endpoint for search and suggestions
   https://geocoding-api.open-meteo.com/v1/search
