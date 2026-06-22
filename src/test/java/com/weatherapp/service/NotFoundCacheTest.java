package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class NotFoundCacheTest {

    @Test
    void isBlockedReturnsFalseForUnknownKey() {
        NotFoundCache cache = new NotFoundCache(60);

        assertFalse(cache.isBlocked("paris"));
    }

    @Test
    void markBlocksUntilExpiry() throws Exception {
        NotFoundCache cache = new NotFoundCache(1);

        cache.mark("paris");
        assertTrue(cache.isBlocked("paris"));

        Thread.sleep(1100);

        assertFalse(cache.isBlocked("paris"));
    }

    @Test
    void expiredEntryIsRemovedOnRead() throws Exception {
        NotFoundCache cache = new NotFoundCache(1);

        cache.mark("paris");
        Thread.sleep(1100);

        assertFalse(cache.isBlocked("paris"));
        assertFalse(cache.isBlocked("paris"));
    }

    @Test
    void keysAreIndependent() {
        NotFoundCache cache = new NotFoundCache(60);

        cache.mark("a");

        assertTrue(cache.isBlocked("a"));
        assertFalse(cache.isBlocked("b"));
    }
}
