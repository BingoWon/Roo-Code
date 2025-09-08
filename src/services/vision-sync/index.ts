/**
 * VisionSync - Modern visionOS integration for Roo Code
 * Entry point and public API
 */

// Core service
export { VisionSyncService } from "./vision-sync-service"

// Types
export type {
	VisionSyncConfig,
	VisionConnection,
	VisionMessage,
	VisionServiceEvent,
	VisionServiceEventData,
	NetworkInfo,
	ServiceDiscoveryResponse,
	ConnectionState,
	VisionMessageType,
	ClientHandshakeMessage,
	ConnectionAcceptedMessage,
	ConnectionRejectedMessage,
	AIConversationMessage,
	TriggerSendMessage,
	PingMessage,
	PongMessage,
	EchoMessage,
} from "./types"

export { DEFAULT_VISION_SYNC_CONFIG, ConnectionState, VisionMessageType, VisionServiceEvent } from "./types"

// Utilities
export {
	getLocalIP,
	getPrimaryInterfaceName,
	calculateNetworkSegment,
	checkNetworkConnectivity,
	getNetworkInfo,
	isPortAvailable,
	findAvailablePort,
	isValidIPAddress,
	getAllNetworkInterfaces,
	createWebSocketURL,
	createHTTPURL,
} from "./network-utils"

export {
	MessageFactory,
	serializeMessage,
	deserializeMessage,
	validateMessage,
	isSystemMessage,
	isConnectionMessage,
	isAIMessage,
	extractSessionId,
	createErrorResponse,
} from "./message-utils"

// Individual components (for advanced usage)
export { VisionWebSocketServer } from "./websocket-server"
export { VisionDiscoveryServer } from "./discovery-server"
export { VisionAIBridge } from "./ai-bridge"
