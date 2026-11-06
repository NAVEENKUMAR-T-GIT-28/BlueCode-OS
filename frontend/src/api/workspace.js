import api from "./client";

export const fetchWorkspace = async () => (await api.get("/workspace")).data;
export const saveWorkspace = async (state) => (await api.put("/workspace", { state })).data;
