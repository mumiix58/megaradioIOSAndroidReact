package com.megaradio.tv

import org.junit.Assert.*
import org.junit.Test

class TvRemoteCommandsTest {
    @Test fun androidMediaKeysUseExistingSharedPlayerMethods() {
        assertEquals("resume", TvRemoteCommands.playerCommand(126))
        assertEquals("pause", TvRemoteCommands.playerCommand(127))
        assertEquals("togglePlayPause", TvRemoteCommands.playerCommand(85))
        assertEquals("stop", TvRemoteCommands.playerCommand(86))
    }
    @Test fun navigationAndVolumeRemainNativeWebViewEvents() {
        listOf(19, 20, 21, 22, 23, 24, 25, 4, 66).forEach {
            assertNull(TvRemoteCommands.playerCommand(it))
        }
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsUnrecognizedScriptCommands() {
        TvRemoteCommands.script("arbitrary();")
    }
}
