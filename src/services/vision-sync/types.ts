/**
 * VisionSync - Modern visionOS integration for Roo Code
 * Unified message protocol and type definitions
 */

export interface VisionSyncConfig {
	readonly serviceName: string
	readonly port: number
	readonly discoveryPort: number
	readonly enabled: boolean
	readonly maxConnections: number
}

export const DEFAULT_VISION_SYNC_CONFIG: VisionSyncConfig = {
	serviceName: `RooCode-${require("os").hostname()}`,
	port: 8765,
	discoveryPort: 8766,
	enabled: true,
	maxConnections: 10,
}

// Connection States
export enum ConnectionState {
	DISCONNECTED = "disconnected",
	CONNECTING = "connecting",
	CONNECTED = "connected",
	RECONNECTING = "reconnecting",
	FAILED = "failed",
}

// Message Protocol
export enum VisionMessageType {
	// Connection lifecycle
	CLIENT_HANDSHAKE = "ClientHandshake",
	CONNECTION_ACCEPTED = "ConnectionAccepted",
	CONNECTION_REJECTED = "ConnectionRejected",

	// AI conversation
	AI_CONVERSATION = "AIConversation",
	ASK_RESPONSE = "AskResponse",
	TRIGGER_SEND = "TriggerSend",

	// System
	PING = "Ping",
	PONG = "Pong",
	ECHO = "Echo",
}

// Base message interface
export interface BaseVisionMessage {
	readonly type: VisionMessageType
	readonly timestamp: number
	readonly id: string
}

// Specific message types
export interface ClientHandshakeMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.CLIENT_HANDSHAKE
	readonly clientType: "visionOS" | "iOS" | "macOS"
	readonly version: string
	readonly capabilities: readonly string[]
}

export interface ConnectionAcceptedMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.CONNECTION_ACCEPTED
	readonly payload: {
		readonly connectionId: string
		readonly serverInfo: {
			readonly name: string
			readonly version: string
			readonly platform: string
			readonly capabilities: readonly string[]
		}
	}
}

export interface ConnectionRejectedMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.CONNECTION_REJECTED
	readonly reason: string
}

export interface AIConversationMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.AI_CONVERSATION
	readonly payload: {
		readonly sessionId: string
		readonly role: "user" | "assistant"
		readonly content: string
		readonly metadata?: Record<string, unknown>
		readonly partial?: boolean
	}
}

export interface AskResponseMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.ASK_RESPONSE
	readonly payload: {
		readonly sessionId: string
		readonly askResponse: "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse"
		readonly text?: string
		readonly images?: readonly string[]
	}
}

export interface TriggerSendMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.TRIGGER_SEND
	readonly payload: {
		readonly sessionId: string
		readonly action: "send" | "cancel"
	}
}

export interface PingMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.PING
}

export interface PongMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.PONG
}

export interface EchoMessage extends BaseVisionMessage {
	readonly type: VisionMessageType.ECHO
	readonly payload: {
		readonly message: string
	}
}

// Union type for all messages
export type VisionMessage =
	| ClientHandshakeMessage
	| ConnectionAcceptedMessage
	| ConnectionRejectedMessage
	| AIConversationMessage
	| AskResponseMessage
	| TriggerSendMessage
	| PingMessage
	| PongMessage
	| EchoMessage

// Connection info
export interface VisionConnection {
	readonly id: string
	readonly clientType: string
	readonly version: string
	readonly capabilities: readonly string[]
	readonly connectedAt: Date
	readonly lastActivity: Date
	readonly state: ConnectionState
}

// Service events
export enum VisionServiceEvent {
	SERVICE_STARTED = "serviceStarted",
	SERVICE_STOPPED = "serviceStopped",
	CLIENT_CONNECTED = "clientConnected",
	CLIENT_DISCONNECTED = "clientDisconnected",
	MESSAGE_RECEIVED = "messageReceived",
	MESSAGE_SENT = "messageSent",
	ERROR = "error",
}

export interface VisionServiceEventData {
	[VisionServiceEvent.SERVICE_STARTED]: { port: number; discoveryPort: number }
	[VisionServiceEvent.SERVICE_STOPPED]: Record<string, never>
	[VisionServiceEvent.CLIENT_CONNECTED]: { connection: VisionConnection }
	[VisionServiceEvent.CLIENT_DISCONNECTED]: { connectionId: string; reason?: string }
	[VisionServiceEvent.MESSAGE_RECEIVED]: { connectionId: string; message: VisionMessage }
	[VisionServiceEvent.MESSAGE_SENT]: { connectionId: string; message: VisionMessage }
	[VisionServiceEvent.ERROR]: { error: Error; context?: string }
}

// Network info
export interface NetworkInfo {
	readonly localIP: string
	readonly networkSegment: string
	readonly interfaceName: string
	readonly isOnline: boolean
}

// Service discovery response
export interface ServiceDiscoveryResponse {
	readonly name: string
	readonly websocket_url: string
	readonly version: string
	readonly platform: string
	readonly app: string
	readonly capabilities: readonly string[]
}
