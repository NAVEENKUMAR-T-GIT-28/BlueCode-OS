import api, { setToken, clearToken } from "./client";

export async function register({ name, email, password }) {
  const { data } = await api.post("/auth/register", { name, email, password });
  setToken(data.token);
  return data.user;
}

export async function login({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  setToken(data.token);
  return data.user;
}

export const getMe = async () => (await api.get("/auth/me")).data.user;
export const signOut = () => clearToken();
