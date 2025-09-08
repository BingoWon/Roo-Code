/**
 * VisionSync Message Utilities
 * Message creation, validation, and serialization
 */

import { randomUUID } from "crypto"
import type {
	VisionMessage,
	ClientHandshakeMessage,
	ConnectionAcceptedMessage,
	ConnectionRejectedMessage,
	AIConversationMessage,
	TriggerSendMessage,
	PingMessage,
	PongMessage,
	EchoMessage,
} from "./types"
import { VisionMessageType } from "./types"

/**
 * Create a base message with common fields
 */
function createBaseMessage<T extends VisionMessageType>(type: T): { type: T; timestamp: number; id: string } {
	return {
		type,
		timestamp: Date.now(),
		id: randomUUID(),
	}
}

/**
 * Message factory functions
 */
export const MessageFactory = {
	clientHandshake(
		clientType: "visionOS" | "iOS" | "macOS",
		version: string,
		capabilities: readonly string[],
	): ClientHandshakeMessage {
		return {
			...createBaseMessage(VisionMessageType.CLIENT_HANDSHAKE),
			clientType,
			version,
			capabilities,
		}
	},

	connectionAccepted(
		connectionId: string,
		serverInfo: {
			name: string
			version: string
			platform: string
			capabilities: readonly string[]
		},
	): ConnectionAcceptedMessage {
		return {
			...createBaseMessage(VisionMessageType.CONNECTION_ACCEPTED),
			payload: {
				connectionId,
				serverInfo,
			},
		}
	},

	connectionRejected(reason: string): ConnectionRejectedMessage {
		return {
			...createBaseMessage(VisionMessageType.CONNECTION_REJECTED),
			reason,
		}
	},

	aiConversation(
		sessionId: string,
		role: "user" | "assistant",
		content: string,
		metadata?: Record<string, unknown>,
	): AIConversationMessage {
		return {
			...createBaseMessage(VisionMessageType.AI_CONVERSATION),
			payload: {
				sessionId,
				role,
				content,
				metadata,
			},
		}
	},

	triggerSend(sessionId: string, action: "send" | "cancel"): TriggerSendMessage {
		return {
			...createBaseMessage(VisionMessageType.TRIGGER_SEND),
			payload: {
				sessionId,
				action,
			},
		}
	},

	ping(): PingMessage {
		return {
			...createBaseMessage(VisionMessageType.PING),
		}
	},

	pong(): PongMessage {
		return {
			...createBaseMessage(VisionMessageType.PONG),
		}
	},

	echo(message: string): EchoMessage {
		return {
			...createBaseMessage(VisionMessageType.ECHO),
			payload: {
				message,
			},
		}
	},
}

/**
 * Serialize a message to JSON string
 */
export function serializeMessage(message: VisionMessage): string {
	try {
		return JSON.stringify(message)
	} catch (error) {
		throw new Error(`Failed to serialize message: ${error}`)
	}
}

/**
 * Deserialize a JSON string to a message
 */
export function deserializeMessage(data: string): VisionMessage {
	try {
		const parsed = JSON.parse(data)

		// Basic validation
		if (!parsed.type || !parsed.timestamp || !parsed.id) {
			throw new Error("Invalid message format: missing required fields")
		}

		// Validate message type
		if (!Object.values(VisionMessageType).includes(parsed.type)) {
			throw new Error(`Invalid message type: ${parsed.type}`)
		}

		return parsed as VisionMessage
	} catch (error) {
		throw new Error(`Failed to deserialize message: ${error}`)
	}
}

/**
 * Validate message structure
 */
export function validateMessage(message: unknown): message is VisionMessage {
	if (!message || typeof message !== "object") {
		return false
	}

	const msg = message as any

	// Check required base fields
	if (!msg.type || !msg.timestamp || !msg.id) {
		return false
	}

	// Check message type
	if (!Object.values(VisionMessageType).includes(msg.type)) {
		return false
	}

	// Type-specific validation
	switch (msg.type) {
		case VisionMessageType.CLIENT_HANDSHAKE:
			return !!(msg.clientType && msg.version && Array.isArray(msg.capabilities))

		case VisionMessageType.CONNECTION_ACCEPTED:
			return !!(msg.payload?.connectionId && msg.payload?.serverInfo)

		case VisionMessageType.CONNECTION_REJECTED:
			return !!msg.reason

		case VisionMessageType.AI_CONVERSATION:
			return !!(msg.payload?.sessionId && msg.payload?.role && msg.payload?.content)

		case VisionMessageType.TRIGGER_SEND:
			return !!(msg.payload?.sessionId && msg.payload?.action)

		case VisionMessageType.ECHO:
			return !!msg.payload?.message

		case VisionMessageType.PING:
		case VisionMessageType.PONG:
			return true

		default:
			return false
	}
}

/**
 * Check if a message is a system message (ping, pong, echo)
 */
export function isSystemMessage(message: VisionMessage): boolean {
	return [VisionMessageType.PING, VisionMessageType.PONG, VisionMessageType.ECHO].includes(message.type)
}

/**
 * Check if a message is a connection lifecycle message
 */
export function isConnectionMessage(message: VisionMessage): boolean {
	return [
		VisionMessageType.CLIENT_HANDSHAKE,
		VisionMessageType.CONNECTION_ACCEPTED,
		VisionMessageType.CONNECTION_REJECTED,
	].includes(message.type)
}

/**
 * Check if a message is an AI-related message
 */
export function isAIMessage(message: VisionMessage): boolean {
	return [VisionMessageType.AI_CONVERSATION, VisionMessageType.TRIGGER_SEND].includes(message.type)
}

/**
 * Extract session ID from AI messages
 */
export function extractSessionId(message: VisionMessage): string | null {
	if (message.type === VisionMessageType.AI_CONVERSATION) {
		return message.payload.sessionId
	}
	if (message.type === VisionMessageType.TRIGGER_SEND) {
		return message.payload.sessionId
	}
	return null
}

/**
 * Create an error response message
 */
export function createErrorResponse(reason: string): ConnectionRejectedMessage {
	return MessageFactory.connectionRejected(reason)
}
