package com.megaradio.tv

/** Android media key codes differ from the Samsung/LG browser key codes. */
object TvRemoteCommands {
    fun playerCommand(keyCode: Int): String? = when (keyCode) {
        126 -> "resume"
        127 -> "pause"
        85 -> "togglePlayPause"
        86 -> "stop"
        else -> null
    }

    fun script(command: String): String {
        require(command in setOf("resume", "pause", "togglePlayPause", "stop"))
        return "(function(){var p=window.globalPlayer;if(p&&typeof p.$command==='function')p.$command();})();"
    }
}
