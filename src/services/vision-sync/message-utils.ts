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
import { VISION_SYNC_CONSTANTS } from "./constants"
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
		partial?: boolean,
	): AIConversationMessage {
		return {
			...createBaseMessage(VisionMessageType.AI_CONVERSATION),
			payload: {
				sessionId,
				role,
				content,
				metadata,
				...(partial !== undefined && { partial }),
			},
		}
	},

	askResponse(
		sessionId: string,
		askResponse: "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse",
		text?: string,
		images?: readonly string[],
	): AskResponseMessage {
		return {
			...createBaseMessage(VisionMessageType.ASK_RESPONSE),
			payload: {
				sessionId,
				askResponse,
				...(text && { text }),
				...(images && { images }),
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
 * Deserialize a JSON string to a message with payload format support
 */
export function deserializeMessage(data: string): VisionMessage {
	try {
		const parsed = JSON.parse(data)

		// Basic validation - only type is required
		if (!parsed.type) {
			throw new Error("Invalid message format: missing type field")
		}

		// Validate message type
		if (!Object.values(VisionMessageType).includes(parsed.type)) {
			throw new Error(`Invalid message type: ${parsed.type}`)
		}

		// Add default timestamp and id if missing
		if (!parsed.timestamp) {
			parsed.timestamp = Date.now()
		}
		if (!parsed.id) {
			parsed.id = `${VISION_SYNC_CONSTANTS.MESSAGE.CLIENT_INFO.TYPE}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		}

		// 现代化 ClientHandshake 处理 - 完全支持 payload 格式
		if (parsed.type === VisionMessageType.CLIENT_HANDSHAKE) {
			if (parsed.payload) {
				// 标准 payload 格式 - 客户端使用的格式
				return {
					type: parsed.type,
					timestamp: parsed.timestamp,
					id: parsed.id,
					clientType: parsed.payload.clientType || "visionOS",
					version: parsed.payload.version || "1.0.0",
					capabilities: parsed.payload.capabilities || [],
				} as VisionMessage
			} else if (parsed.clientType && parsed.version && parsed.capabilities) {
				// 直接格式 - 向后兼容
				return parsed as VisionMessage
			} else {
				// 默认值处理
				return {
					type: parsed.type,
					timestamp: parsed.timestamp,
					id: parsed.id,
					clientType: "visionOS",
					version: "1.0.0",
					capabilities: [],
				} as VisionMessage
			}
		}

		// Handle AIConversation - normalize session_id to sessionId
		if (parsed.type === VisionMessageType.AI_CONVERSATION && parsed.payload) {
			if (parsed.payload.session_id && !parsed.payload.sessionId) {
				parsed.payload.sessionId = parsed.payload.session_id
			}
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

	// 现代化类型验证
	switch (msg.type) {
		case VisionMessageType.CLIENT_HANDSHAKE:
			// 优先验证 payload 格式，兼容直接格式
			if (msg.payload) {
				return !!(msg.payload.clientType && msg.payload.version && Array.isArray(msg.payload.capabilities))
			}
			return !!(msg.clientType && msg.version && Array.isArray(msg.capabilities))

		case VisionMessageType.CONNECTION_ACCEPTED:
			return !!(msg.payload?.connectionId && msg.payload?.serverInfo)

		case VisionMessageType.CONNECTION_REJECTED:
			return !!msg.reason

		case VisionMessageType.AI_CONVERSATION: {
			// Support both sessionId and session_id formats
			const sessionId = msg.payload?.sessionId || msg.payload?.session_id
			return !!(sessionId && msg.payload?.role && msg.payload?.content)
		}

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
	return [VisionMessageType.AI_CONVERSATION, VisionMessageType.ASK_RESPONSE, VisionMessageType.TRIGGER_SEND].includes(
		message.type,
	)
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
