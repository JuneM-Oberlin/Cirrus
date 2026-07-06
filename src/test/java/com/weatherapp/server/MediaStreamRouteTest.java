package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import spark.Request;
import spark.Response;

class MediaStreamRouteTest {

    /* ── resolveRange: the header parsing that Safari playback depends on ── */

    @Test
    void noRangeHeaderServesFullFile() {
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange(null, 1000);
        assertEquals(200, r.status);
        assertEquals(0, r.start);
        assertEquals(999, r.end);
    }

    @Test
    void safariProbeRangeReturns206() {
        // iOS Safari opens every video with "Range: bytes=0-1"
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange("bytes=0-1", 1000);
        assertEquals(206, r.status);
        assertEquals(0, r.start);
        assertEquals(1, r.end);
    }

    @Test
    void openEndedRangeServesThroughEndOfFile() {
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange("bytes=200-", 1000);
        assertEquals(206, r.status);
        assertEquals(200, r.start);
        assertEquals(999, r.end);
    }

    @Test
    void endBeyondFileLengthIsClamped() {
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange("bytes=0-999999", 1000);
        assertEquals(206, r.status);
        assertEquals(0, r.start);
        assertEquals(999, r.end);
    }

    @Test
    void suffixRangeServesLastBytes() {
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange("bytes=-100", 1000);
        assertEquals(206, r.status);
        assertEquals(900, r.start);
        assertEquals(999, r.end);
    }

    @Test
    void suffixLongerThanFileServesWholeFile() {
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange("bytes=-5000", 1000);
        assertEquals(206, r.status);
        assertEquals(0, r.start);
        assertEquals(999, r.end);
    }

    @Test
    void startBeyondFileLengthIsUnsatisfiable() {
        MediaStreamRoute.ByteRange r = MediaStreamRoute.resolveRange("bytes=1000-", 1000);
        assertEquals(416, r.status);
    }

    @Test
    void malformedRangesAreIgnoredAndServeFullFile() {
        assertEquals(200, MediaStreamRoute.resolveRange("bytes=abc", 1000).status);
        assertEquals(200, MediaStreamRoute.resolveRange("chunks=0-1", 1000).status);
        assertEquals(200, MediaStreamRoute.resolveRange("bytes=5-2", 1000).status);
        assertEquals(200, MediaStreamRoute.resolveRange("bytes=", 1000).status);
        assertEquals(200, MediaStreamRoute.resolveRange("bytes=0-1,5-6", 1000).status);
    }

    /* ── handle: routing, headers, and body slicing ── */

    private static final class CapturingOutputStream extends ServletOutputStream {
        final ByteArrayOutputStream captured = new ByteArrayOutputStream();

        @Override
        public void write(int b) {
            captured.write(b);
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setWriteListener(WriteListener listener) {
        }
    }

    @Test
    void unknownFileReturns404(@TempDir Path dir) throws IOException {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        when(req.params(":file")).thenReturn("../../touch.env");

        MediaStreamRoute.handle(req, res, dir);

        verify(res).status(404);
    }

    @Test
    void rangeRequestWritesOnlyRequestedSlice(@TempDir Path dir) throws IOException {
        Files.write(dir.resolve("rain-overlay.mp4"),
                "0123456789".getBytes(StandardCharsets.UTF_8));

        Request req = mock(Request.class);
        Response res = mock(Response.class);
        HttpServletResponse raw = mock(HttpServletResponse.class);
        CapturingOutputStream out = new CapturingOutputStream();
        when(req.params(":file")).thenReturn("rain-overlay.mp4");
        when(req.headers("Range")).thenReturn("bytes=2-5");
        when(res.raw()).thenReturn(raw);
        when(raw.getOutputStream()).thenReturn(out);

        MediaStreamRoute.handle(req, res, dir);

        verify(res).status(206);
        verify(res).type("video/mp4");
        verify(res).header("Accept-Ranges", "bytes");
        verify(res).header("Content-Range", "bytes 2-5/10");
        verify(res).header("Content-Length", "4");
        assertEquals("2345", out.captured.toString(StandardCharsets.UTF_8));
    }

    @Test
    void fullRequestWritesWholeFileWithVideoContentType(@TempDir Path dir) throws IOException {
        Files.write(dir.resolve("rain-overlay.mp4"),
                "0123456789".getBytes(StandardCharsets.UTF_8));

        Request req = mock(Request.class);
        Response res = mock(Response.class);
        HttpServletResponse raw = mock(HttpServletResponse.class);
        CapturingOutputStream out = new CapturingOutputStream();
        when(req.params(":file")).thenReturn("rain-overlay.mp4");
        when(req.headers("Range")).thenReturn(null);
        when(res.raw()).thenReturn(raw);
        when(raw.getOutputStream()).thenReturn(out);

        MediaStreamRoute.handle(req, res, dir);

        verify(res).status(200);
        verify(res).type("video/mp4");
        verify(res).header("Accept-Ranges", "bytes");
        verify(res).header("Content-Length", "10");
        assertEquals("0123456789", out.captured.toString(StandardCharsets.UTF_8));
    }

    @Test
    void unsatisfiableRangeReturns416WithTotalLength(@TempDir Path dir) throws IOException {
        Files.write(dir.resolve("rain-overlay.mp4"),
                "0123456789".getBytes(StandardCharsets.UTF_8));

        Request req = mock(Request.class);
        Response res = mock(Response.class);
        when(req.params(":file")).thenReturn("rain-overlay.mp4");
        when(req.headers("Range")).thenReturn("bytes=50-");

        MediaStreamRoute.handle(req, res, dir);

        verify(res).status(416);
        verify(res).header("Content-Range", "bytes */10");
    }
}
