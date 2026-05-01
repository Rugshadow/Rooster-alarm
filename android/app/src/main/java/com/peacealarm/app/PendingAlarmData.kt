package com.peacealarm.app

object PendingAlarmData {
    @Volatile var channelId: String? = null
    @Volatile var channelName: String? = null
    @Volatile var channelImageUrl: String? = null

    fun set(id: String, name: String, imageUrl: String) {
        channelId = id
        channelName = name
        channelImageUrl = imageUrl
    }

    fun consume(): Triple<String, String, String>? {
        val id = channelId ?: return null
        val name = channelName ?: "Alarm"
        val img = channelImageUrl ?: ""
        channelId = null
        channelName = null
        channelImageUrl = null
        return Triple(id, name, img)
    }

    fun peek(): Triple<String, String, String>? {
        val id = channelId ?: return null
        return Triple(id, channelName ?: "Alarm", channelImageUrl ?: "")
    }
}
