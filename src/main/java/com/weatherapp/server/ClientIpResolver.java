package com.weatherapp.server;

import spark.Request;

final class ClientIpResolver {

    private static final String UNKNOWN_IP = "unknown";

    private ClientIpResolver() {
    }

    static String resolve(Request req) {
        return resolve(req, trustProxyHeaders());
    }

    static String resolve(Request req, boolean trustProxyHeaders) {
        if (trustProxyHeaders) {
            String trueClientIp = sanitizeIp(req.headers("True-Client-Ip"));
            if (trueClientIp != null) {
                return trueClientIp;
            }

            String cfConnectingIp = sanitizeIp(req.headers("CF-Connecting-IP"));
            if (cfConnectingIp != null) {
                return cfConnectingIp;
            }
        }

        String remoteIp = sanitizeIp(req.ip());
        if (remoteIp != null) {
            return remoteIp;
        }

        return UNKNOWN_IP;
    }

    private static boolean trustProxyHeaders() {
        return "true".equalsIgnoreCase(System.getenv("RENDER"));
    }

    private static String sanitizeIp(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String ip = raw.trim();
        if (ip.startsWith("[") && ip.contains("]")) {
            ip = ip.substring(1, ip.indexOf(']'));
        }

        if (ip.isEmpty() || ip.length() > 45 || ip.contains(",") || ip.contains(" ")) {
            return null;
        }

        return ip;
    }
}
