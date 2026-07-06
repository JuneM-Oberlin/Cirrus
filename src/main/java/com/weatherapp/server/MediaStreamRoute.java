package com.weatherapp.server;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import spark.Request;
import spark.Response;

/**
 * Serves media files with HTTP Range (206) support. Spark's built-in static
 * file handler always answers 200 with the whole body, and iOS Safari refuses
 * to play any video whose origin cannot answer its "Range: bytes=0-1" probe
 * with a 206 — so videos must be served through this route instead.
 */
public class MediaStreamRoute {

    /** Whitelist doubles as the content-type map; anything else is a 404. */
    private static final Map<String, String> MEDIA_TYPES = Map.of(
            "rain-overlay.mp4", "video/mp4");

    static class ByteRange {

        final int status;
        final long start;
        final long end;

        ByteRange(int status, long start, long end) {
            this.status = status;
            this.start = start;
            this.end = end;
        }
    }

    static Object handle(Request req, Response res, Path mediaDir) throws IOException {
        String fileName = req.params(":file");
        String contentType = fileName == null ? null : MEDIA_TYPES.get(fileName);
        if (contentType == null) {
            res.status(404);
            return "Not found";
        }
        Path file = mediaDir.resolve(fileName);
        if (!Files.isRegularFile(file)) {
            res.status(404);
            return "Not found";
        }

        long length = Files.size(file);
        ByteRange range = resolveRange(req.headers("Range"), length);

        res.header("Accept-Ranges", "bytes");
        if (range.status == 416) {
            res.status(416);
            res.header("Content-Range", "bytes */" + length);
            return "";
        }

        res.status(range.status);
        res.type(contentType);
        long count = range.end - range.start + 1;
        res.header("Content-Length", String.valueOf(count));
        if (range.status == 206) {
            res.header("Content-Range",
                    "bytes " + range.start + "-" + range.end + "/" + length);
        }

        try (InputStream in = Files.newInputStream(file);
                OutputStream out = res.raw().getOutputStream()) {
            in.skipNBytes(range.start);
            copy(in, out, count);
        }
        return res.raw();
    }

    /**
     * Interprets a single-range Range header against a file of the given
     * length. Malformed or multi-range headers are ignored (200, full body)
     * per RFC 7233; a start past end-of-file is unsatisfiable (416).
     */
    static ByteRange resolveRange(String header, long length) {
        ByteRange full = new ByteRange(200, 0, length - 1);
        if (header == null || !header.startsWith("bytes=")) {
            return full;
        }
        String spec = header.substring("bytes=".length());
        int dash = spec.indexOf('-');
        if (dash < 0 || spec.contains(",")) {
            return full;
        }

        String startStr = spec.substring(0, dash).trim();
        String endStr = spec.substring(dash + 1).trim();
        try {
            if (startStr.isEmpty()) {
                // Suffix form "bytes=-N": the last N bytes of the file
                long suffix = Long.parseLong(endStr);
                if (suffix <= 0) {
                    return new ByteRange(416, 0, 0);
                }
                return new ByteRange(206, Math.max(0, length - suffix), length - 1);
            }

            long start = Long.parseLong(startStr);
            if (start >= length) {
                return new ByteRange(416, 0, 0);
            }
            long end = endStr.isEmpty() ? length - 1 : Long.parseLong(endStr);
            if (start > end) {
                return full;
            }
            return new ByteRange(206, start, Math.min(end, length - 1));
        } catch (NumberFormatException e) {
            return full;
        }
    }

    private static void copy(InputStream in, OutputStream out, long count) throws IOException {
        byte[] buffer = new byte[8192];
        long remaining = count;
        while (remaining > 0) {
            int read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read < 0) {
                break;
            }
            out.write(buffer, 0, read);
            remaining -= read;
        }
    }
}
