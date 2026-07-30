import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (
      response?.data &&
      typeof response.data === "object" &&
      Object.hasOwn(response.data, "success") &&
      Object.hasOwn(response.data, "data") &&
      Object.hasOwn(response.data, "error")
    ) {
      if (response.data.success) {
        response.data = response.data.data;
      } else {
        response.data = response.data.error;
      }
    }
    return response;
  },
  (error) => {
    if (
      error?.response?.data &&
      typeof error.response.data === "object" &&
      Object.hasOwn(error.response.data, "success") &&
      Object.hasOwn(error.response.data, "data") &&
      Object.hasOwn(error.response.data, "error")
    ) {
      error.response.data = error.response.data.error;
    }
    return Promise.reject(error);
  },
);

export function formatError(detail) {
  if (detail == null) return "Ocorreu um erro. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail.msg === "string") return detail.msg;
  return JSON.stringify(detail);
}
