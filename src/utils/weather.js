import {
  getAdcode,
  getDistrict,
  getIpGeo,
  getIpv4,
  getOpenMeteoWeather,
  getWeather,
  searchCityCenter,
} from "@/api";

// 高德接口在「没有数据」时会返回空数组而不是空字符串
const toText = (value) => (typeof value === "string" ? value.trim() : "");

// Open-Meteo 使用的 WMO 天气代码 → 中文描述
const WMO_TEXT = {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "毛毛雨",
  53: "毛毛雨",
  55: "浓毛毛雨",
  56: "冻毛毛雨",
  57: "浓冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "大阵雪",
  95: "雷阵雨",
  96: "雷阵雨伴冰雹",
  99: "雷阵雨伴强冰雹",
};

// 蒲福风级上限（km/h），用于把风速换算成风力等级
const BEAUFORT_LIMITS = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];

const WIND_DIR_TEXT = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];

// 风速（km/h）→ 风力等级
const getWindLevel = (speed) => {
  const kmh = Number(speed);
  if (!Number.isFinite(kmh)) return "";
  const level = BEAUFORT_LIMITS.findIndex((limit) => kmh < limit);
  return String(level === -1 ? 12 : level);
};

// 风向角度 → 中文方位
const getWindDir = (degree) => {
  const deg = Number(degree);
  if (!Number.isFinite(deg)) return "";
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return `${WIND_DIR_TEXT[index]}风`;
};

// "lng,lat" → { lng, lat }
export const parseCenter = (center) => {
  const text = toText(center);
  const [lng, lat] = text.split(",").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
};

// 高德 rectangle（"lng,lat;lng,lat"）→ 中心点
const getRectangleCenter = (rectangle) => {
  const text = toText(rectangle);
  const [leftTop, rightBottom] = text.split(";");
  const [lng1, lat1] = (leftTop || "").split(",").map(Number);
  const [lng2, lat2] = (rightBottom || "").split(",").map(Number);
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return null;
  return { lng: (lng1 + lng2) / 2, lat: (lat1 + lat2) / 2 };
};

// 高德 IP 定位结果 → 位置信息
const formatAmapLocation = (result) => {
  const adcode = toText(result?.adcode);
  if (!adcode) return null;
  return {
    adcode,
    city: toText(result.city) || toText(result.province),
    center: getRectangleCenter(result.rectangle),
  };
};

// 自动定位：先直接按来源 IP，失败再取公网 IPv4 重试（IPv6 网络兜底），
// 最后用无 Key 的 IP 定位服务兜底（此时只有坐标，天气走 Open-Meteo）
export const detectLocation = async (key) => {
  if (key) {
    try {
      const location = formatAmapLocation(await getAdcode(key));
      if (location) return location;
    } catch (error) {
      console.warn("高德 IP 定位失败：", error?.message || error);
    }
    try {
      const ip = await getIpv4();
      if (ip) {
        const location = formatAmapLocation(await getAdcode(key, ip));
        if (location) return location;
      }
    } catch (error) {
      console.warn("公网 IPv4 兜底定位失败：", error?.message || error);
    }
  }
  try {
    const geo = await getIpGeo();
    if (geo.center) {
      return { adcode: "", city: geo.city, center: geo.center };
    }
  } catch (error) {
    console.warn("无 Key IP 定位失败：", error?.message || error);
  }
  return null;
};

// 城市名 → { name, adcode, center }
// 优先用高德（能拿到 adcode，天气更准），失败则用 Open-Meteo 地理编码兜底
export const resolveCity = async (key, keyword) => {
  if (key) {
    try {
      const result = await getDistrict(key, keyword);
      const district = result?.districts?.[0];
      if (district?.adcode) {
        return {
          name: toText(district.name) || keyword,
          adcode: toText(district.adcode),
          center: parseCenter(district.center),
        };
      }
    } catch (error) {
      console.warn("高德城市查询失败：", error?.message || error);
    }
  }
  const geo = await searchCityCenter(keyword);
  if (!geo?.center) return null;
  return { name: geo.name || keyword, adcode: "", center: geo.center };
};

// 高德天气 → 统一格式
const formatAmapWeather = (result) => {
  const live = result?.lives?.[0];
  if (result?.infocode !== "10000" || !live) return null;
  return {
    condition: live.weather,
    temp: live.temperature,
    windDir: `${live.winddirection}风`,
    windLevel: live.windpower,
    city: live.city,
  };
};

// Open-Meteo 天气 → 统一格式
const formatOpenMeteoWeather = (result) => {
  const current = result?.current;
  if (!current) return null;
  return {
    condition: WMO_TEXT[current.weather_code] || "未知",
    temp: String(Math.round(current.temperature_2m)),
    windDir: getWindDir(current.wind_direction_10m),
    windLevel: getWindLevel(current.wind_speed_10m),
    city: "",
  };
};

/**
 * 获取天气：定位 → 高德天气 → Open-Meteo 兜底
 * @param {Object} options
 * @param {String} options.key - 高德天气 Key
 * @param {String} options.adcode - 手动指定的城市 adcode
 * @param {String} options.center - 手动指定的中心坐标 "lng,lat"
 * @param {String} options.city - 手动指定的城市名
 */
export const getWeatherReport = async ({ key, adcode, center, city }) => {
  let location = {
    adcode: toText(adcode),
    city: toText(city),
    center: parseCenter(center),
  };
  // 没有手动指定城市时自动定位
  if (!location.adcode && !location.center) {
    location = (await detectLocation(key)) || {};
  }
  let report = null;
  if (location.adcode && key) {
    try {
      report = formatAmapWeather(await getWeather(key, location.adcode));
    } catch (error) {
      console.warn("高德天气获取失败：", error?.message || error);
    }
  }
  if (!report && location.center) {
    try {
      report = formatOpenMeteoWeather(
        await getOpenMeteoWeather(location.center.lng, location.center.lat),
      );
    } catch (error) {
      console.warn("Open-Meteo 天气获取失败：", error?.message || error);
    }
  }
  if (!report) {
    throw new Error("天气获取失败，可在设置中手动指定天气城市");
  }
  return { ...report, city: location.city || report.city || "" };
};
