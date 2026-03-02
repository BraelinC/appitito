import { httpRouter } from "convex/server";
import { verify, receive } from "./instagram/webhook";

const http = httpRouter();

// Instagram DM webhook
http.route({ path: "/instagram/webhook", method: "GET", handler: verify });
http.route({ path: "/instagram/webhook", method: "POST", handler: receive });

export default http;
