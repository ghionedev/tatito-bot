export async function buildDailyUpdateMessage(update) {
  switch (update.type) {
    case "news_ai":
    case "news":
      return buildNewsUpdate(update);
    case "weather":
      return buildWeatherUpdate(update);
    case "digest": {
      const weather = await buildWeatherUpdate(update);
      const news = await buildNewsUpdate(update);
      return `${weather}\n\n${news}`;
    }
    default:
      return "No tengo claro que tipo de informe diario queres.";
  }
}

async function buildNewsUpdate(update) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return "Para noticias necesito configurar NEWS_API_KEY.";
  }

  const endpoint = process.env.NEWS_API_ENDPOINT || "https://newsapi.org/v2/everything";
  const query = update.query || "inteligencia artificial";
  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("language", "es");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "3");
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return "No pude obtener noticias ahora.";
    }

    const data = await response.json();
    const articles = Array.isArray(data.articles) ? data.articles.slice(0, 3) : [];

    if (articles.length === 0) {
      return "No encontre noticias recientes.";
    }

    const lines = articles.map((article, index) => {
      const source = article.source?.name ? ` (${article.source.name})` : "";
      return `${index + 1}. ${article.title}${source}`;
    });

    return `📰 Noticias${query ? ` sobre ${query}` : ""}:\n${lines.join("\n")}`;
  } catch {
    return "No pude obtener noticias ahora.";
  }
}

async function buildWeatherUpdate(update) {
  const location = update.location || process.env.DEFAULT_LOCATION;
  if (!location) {
    return "Para el clima necesito una ubicacion.";
  }

  try {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.searchParams.set("name", location);
    geoUrl.searchParams.set("count", "1");
    geoUrl.searchParams.set("language", "es");
    geoUrl.searchParams.set("format", "json");

    const geoResponse = await fetch(geoUrl.toString());
    if (!geoResponse.ok) {
      return `No pude obtener el clima para ${location}.`;
    }

    const geoData = await geoResponse.json();
    const place = geoData.results?.[0];
    if (!place) {
      return `No encontre la ubicacion ${location}.`;
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("current", "temperature_2m,precipitation_probability,weathercode");
    forecastUrl.searchParams.set("hourly", "precipitation_probability,temperature_2m");

    const forecastResponse = await fetch(forecastUrl.toString());
    if (!forecastResponse.ok) {
      return `No pude obtener el clima para ${location}.`;
    }

    const forecast = await forecastResponse.json();
    const currentTemp = forecast.current?.temperature_2m;
    const now = new Date();

    let maxPrecip = null;
    const times = forecast.hourly?.time || [];
    const precip = forecast.hourly?.precipitation_probability || [];

    for (let i = 0; i < times.length; i += 1) {
      const time = new Date(times[i]);
      const diffHours = (time - now) / 3600000;
      if (diffHours >= 0 && diffHours <= 3) {
        const value = precip[i];
        if (typeof value === "number") {
          maxPrecip = maxPrecip === null ? value : Math.max(maxPrecip, value);
        }
      }
    }

    const precipText = maxPrecip === null ? "sin datos" : `${maxPrecip}%`;
    const advice = maxPrecip === null
      ? "Si vas a salir, revisa el pronostico."
      : maxPrecip >= 50
        ? "Lleva paraguas."
        : maxPrecip >= 20
          ? "Quizas lleves paraguas por las dudas."
          : "Podes salir tranquilo.";

    const name = place.name;
    const region = place.admin1 ? `, ${place.admin1}` : "";

    return `🌤️ Clima en ${name}${region}: ${currentTemp ?? "?"}°C, lluvia prox 3h ${precipText}. ${advice}`;
  } catch {
    return `No pude obtener el clima para ${location}.`;
  }
}
