package com.weatherapp.server;

import spark.Request;

/**
 * Resolves the real client IP for rate limiting. Behind the EC2 Caddy
 * reverse proxy every request's remote address is Caddy itself, so with
 * TRUST_PROXY=true we read Caddy's X-Forwarded-For header instead. Only
 * the rightmost entry is used — it's the hop appended by our own proxy;
 * anything to its left could be client-supplied and spoofed.
 */
final class ClientIpResolver {

    private static final String UNKNOWN_IP = "unknown";

    private ClientIpResolver() {
    }

    static String resolve(Request req) {
        return resolve(req, trustProxyHeaders());
    }

    static String resolve(Request req, boolean trustProxyHeaders) {
        if (trustProxyHeaders) {
            String forwardedFor = lastForwardedHop(req.headers("X-Forwarded-For"));
            if (forwardedFor != null) {
                return forwardedFor;
            }
        }

        String remoteIp = sanitizeIp(req.ip());
        if (remoteIp != null) {
            return remoteIp;
        }

        return UNKNOWN_IP;
    }

    private static boolean trustProxyHeaders() {
        return "true".equalsIgnoreCase(System.getenv("TRUST_PROXY"));
    }

    private static String lastForwardedHop(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        String[] hops = header.split(",");
        return sanitizeIp(hops[hops.length - 1]);
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
