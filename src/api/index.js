import axios from "@/utils/request";
import fetchJsonp from "fetch-jsonp";

/**
 * 获取天气
 * https://lbs.amap.com/api/webservice/guide/api/weatherinfo
 */
// 获取高德地理位置信息
// 不传 ip 时由高德按请求来源 IP 定位；纯 IPv6 网络下高德会返回空数组，
// 此时可先取到公网 IPv4 再显式传入 ip 兜底
export const getAdcode = async (key, ip) => {
  return axios({
    method: "GET",
    url: "https://restapi.amap.com/v3/ip",
    params: ip ? { key, ip } : { key },
    timeout: 10000,
  });
};

// 获取高德地理天气信息
export const getWeather = async (key, city) => {
  return axios({
    method: "GET",
    url: "https://restapi.amap.com/v3/weather/weatherInfo",
    params: { key, city, extensions: "base" },
    timeout: 10000,
  });
};

// 高德行政区划查询：城市名 → adcode / 中心坐标
export const getDistrict = async (key, keywords) => {
  return axios({
    method: "GET",
    url: "https://restapi.amap.com/v3/config/district",
    params: { key, keywords, subdistrict: 0 },
    timeout: 10000,
  });
};

// 获取本机公网 IPv4
// 用原生 fetch：axios 全局带了 X-Requested-With，该服务预检不放行会直接被浏览器拦截
export const getIpv4 = async () => {
  const response = await fetch("https://ipv4.icanhazip.com");
  if (!response.ok) throw new Error(`获取公网 IP 失败：${response.status}`);
  const ip = (await response.text()).trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : "";
};

// Open-Meteo 实时天气（免费、无需 Key，作为高德天气的兜底）
// https://open-meteo.com/en/docs
export const getOpenMeteoWeather = async (longitude, latitude) => {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo 请求失败：${response.status}`);
  return response.json();
};

// 无 Key 的 IP 定位（高德 Key 不可用时兜底，只提供坐标）
export const getIpGeo = async () => {
  const response = await fetch("https://ipwho.is/");
  if (!response.ok) throw new Error(`IP 定位失败：${response.status}`);
  const data = await response.json();
  const lng = Number(data?.longitude);
  const lat = Number(data?.latitude);
  if (!data?.success || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error("IP 定位失败");
  }
  return { city: data.city || "", center: { lng, lat } };
};

// Open-Meteo 地理编码：城市名 → 坐标（无需 Key）
export const searchCityCenter = async (keyword) => {
  const params = new URLSearchParams({
    name: keyword,
    count: "1",
    language: "zh",
    format: "json",
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!response.ok) throw new Error(`城市查询失败：${response.status}`);
  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) return null;
  return {
    name: result.name,
    center: { lng: Number(result.longitude), lat: Number(result.latitude) },
  };
};

/**
 * 获取搜索建议
 * https://suggestion.baidu.com
 * @param {String} keyWord - 搜索关键字
 */
export const getSearchSuggestions = async (keyWord) => {
  try {
    const encodedKeyword = encodeURIComponent(keyWord);
    const response = await fetchJsonp(
      `https://suggestion.baidu.com/su?wd=${encodedKeyword}&cb=json`,
      {
        // 回调参数
        jsonpCallback: "cb",
      },
    );
    const data = await response.json();
    return data.s;
  } catch (error) {
    console.error("处理搜索建议发生错误：", error);
    return null;
  }
};
