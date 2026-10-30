# Air-quality data providers

The dashboard uses the Open-Meteo CAMS air-quality model when no station-data
token is configured. Nearby points can share one model-grid value because the
provider reports modeled cells, not an independent sensor reading for every
coordinate.

For live monitoring-station readings, create a WAQI API token and set
`WAQI_API_TOKEN` in the server's local `.env` file. Keep the token server-side
and do not commit `.env`. Restart the server after changing environment
variables. When WAQI returns station data, the map shows its measured station
locations. A selected point uses a WAQI station reading only when that station
has valid coordinates within 75 km of the requested point; the dashboard
identifies the monitor by name. If the nearest station is farther away, the
point uses Open-Meteo instead of displaying a distant city's AQI.

If WAQI is not configured or its station feed is unavailable, the server falls
back to Open-Meteo. Readings from the fallback are model estimates, and nearby
pins may share a value at the model's spatial resolution. IQAir also requires
an API key and is not queried unless a separately supported provider adapter
is configured.
