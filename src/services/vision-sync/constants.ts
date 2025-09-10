/**
 * VisionSync Configuration Constants
 * Centralized configuration for optimal maintainability
 */

export const VISION_SYNC_CONSTANTS = {
	// Task Configuration
	TASK: {
		CONSECUTIVE_MISTAKE_LIMIT: Number.MAX_SAFE_INTEGER,
		DEFAULT_SESSION_ID: "current-session",
		MESSAGE_ID_PREFIX: "msg",
	},

	// Network Configuration
	NETWORK: {
		DEFAULT_PORTS: {
			WEBSOCKET: 8765,
			DISCOVERY: 8766,
		},
		MAX_CONNECTIONS: 10,
		TIMEOUT: {
			REQUEST: 15000,
			RESOURCE: 30000,
		},
	},

	// Message Configuration
	MESSAGE: {
		CLIENT_INFO: {
			TYPE: "visionOS",
			VERSION: "1.0",
			CAPABILITIES: ["ai_conversation"] as const,
		},
		RETRY: {
			MAX_ATTEMPTS: 3,
			DELAY_MS: 1000,
		},
	},

	// Logging
	LOG: {
		PREFIX: {
			VISION_SYNC: "[VisionSync]",
			AI_BRIDGE: "[VisionAIBridge]",
			WEBSOCKET: "[VisionWebSocket]",
			DISCOVERY: "[VisionDiscovery]",
		},
	},
} as const

export type VisionSyncConstants = typeof VISION_SYNC_CONSTANTS
